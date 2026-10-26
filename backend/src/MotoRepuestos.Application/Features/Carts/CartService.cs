using FluentValidation;
using Microsoft.EntityFrameworkCore;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Domain.Carts;

namespace MotoRepuestos.Application.Features.Carts;

public sealed record CartItemDto(
    int ProductId,
    string Name,
    string? ImageUrl,
    decimal UnitPrice,
    int Quantity,
    int Stock,
    bool IsAvailable,
    bool ExceedsStock,
    decimal Subtotal);

/// <summary>
/// Cart with live product data. Only available items count towards the total; items that are no
/// longer sold stay visible (flagged) so the customer understands why they are excluded.
/// </summary>
public sealed record CartDto(
    IReadOnlyList<CartItemDto> Items,
    int TotalQuantity,
    decimal Total,
    bool HasUnavailableItems,
    bool CanCheckout);

public sealed record AddCartItemRequest(int ProductId, int Quantity);

public sealed record UpdateCartItemRequest(int Quantity);

public sealed record MergeCartRequest(Guid GuestCartId);

public sealed class AddCartItemRequestValidator : AbstractValidator<AddCartItemRequest>
{
    public AddCartItemRequestValidator()
    {
        RuleFor(x => x.ProductId).GreaterThan(0);
        RuleFor(x => x.Quantity).InclusiveBetween(1, 999).WithMessage("La cantidad debe estar entre 1 y 999.");
    }
}

public sealed class CartService(
    IAppDbContext db,
    ICurrentUser currentUser,
    TimeProvider clock,
    IValidator<AddCartItemRequest> addValidator)
{
    private static readonly CartDto EmptyCart = new([], 0, 0, false, false);

    public async Task<CartDto> GetAsync(CancellationToken ct = default)
    {
        var cart = await FindCartAsync(ct);
        return cart is null ? EmptyCart : await ToDtoAsync(cart, ct);
    }

    public async Task<Result<CartDto>> AddItemAsync(AddCartItemRequest request, CancellationToken ct = default)
    {
        if (await addValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == request.ProductId)
            .Select(p => new { p.Id, p.Stock, Sellable = p.IsActive && p.Category!.IsActive })
            .FirstOrDefaultAsync(ct);

        if (product is null || !product.Sellable)
            return Error.Conflict("cart.product_unavailable", "El producto no está disponible para la venta en este momento.");

        var cartResult = await GetOrCreateCartAsync(ct);
        if (cartResult.IsFailure) return cartResult.Error!;

        var cart = cartResult.Value;
        cart.Add(product.Id, request.Quantity, product.Stock, clock.GetUtcNow().UtcDateTime);
        await db.SaveChangesAsync(ct);

        return await ToDtoAsync(cart, ct);
    }

    public async Task<Result<CartDto>> UpdateItemAsync(int productId, UpdateCartItemRequest request, CancellationToken ct = default)
    {
        var cart = await FindCartAsync(ct);
        if (cart is null || cart.QuantityOf(productId) == 0)
            return Error.NotFound("cart.item_not_found", "El producto no está en el carrito.");

        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == productId)
            .Select(p => new { p.Stock, Sellable = p.IsActive && p.Category!.IsActive })
            .FirstOrDefaultAsync(ct);

        if (product is null || !product.Sellable)
            return Error.Conflict("cart.product_unavailable", "Este producto fue dado de baja y no puede modificarse.");

        cart.SetQuantity(productId, request.Quantity, product.Stock, clock.GetUtcNow().UtcDateTime);
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(cart, ct);
    }

    public async Task<CartDto> RemoveItemAsync(int productId, CancellationToken ct = default)
    {
        var cart = await FindCartAsync(ct);
        if (cart is null) return EmptyCart;

        if (cart.Remove(productId, clock.GetUtcNow().UtcDateTime))
            await db.SaveChangesAsync(ct);

        return await ToDtoAsync(cart, ct);
    }

    public async Task ClearAsync(CancellationToken ct = default)
    {
        var cart = await FindCartAsync(ct);
        if (cart is null) return;

        cart.Clear(clock.GetUtcNow().UtcDateTime);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Called by the SPA right after login: moves the guest cart into the user's cart
    /// (quantities capped to stock) and deletes the guest cart.
    /// </summary>
    public async Task<Result<CartDto>> MergeGuestCartAsync(Guid guestCartId, CancellationToken ct = default)
    {
        if (currentUser.UserId is not int userId)
            return Error.Unauthorized("auth.required", "Iniciá sesión para continuar.");

        var guest = await db.Carts.Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == guestCartId && c.UserId == null, ct);

        var userCart = await LoadUserCartAsync(userId, ct);
        var now = clock.GetUtcNow().UtcDateTime;

        if (guest is null || guest.Items.Count == 0)
        {
            if (guest is not null) db.Carts.Remove(guest);
            await db.SaveChangesAsync(ct);
            return userCart is null ? EmptyCart : await ToDtoAsync(userCart, ct);
        }

        if (userCart is null)
        {
            userCart = Cart.CreateForUser(userId, now);
            db.Carts.Add(userCart);
        }

        var productIds = guest.Items.Select(i => i.ProductId).ToList();
        var sellableStock = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id) && p.IsActive && p.Category!.IsActive)
            .ToDictionaryAsync(p => p.Id, p => p.Stock, ct);

        userCart.MergeFrom(guest, sellableStock, now);
        db.Carts.Remove(guest);
        await db.SaveChangesAsync(ct);

        return await ToDtoAsync(userCart, ct);
    }

    private async Task<Cart?> FindCartAsync(CancellationToken ct)
    {
        if (currentUser.UserId is int userId)
            return await LoadUserCartAsync(userId, ct);

        if (currentUser.GuestCartId is Guid guestId)
            return await db.Carts.Include(c => c.Items).FirstOrDefaultAsync(c => c.Id == guestId && c.UserId == null, ct);

        return null;
    }

    private Task<Cart?> LoadUserCartAsync(int userId, CancellationToken ct) =>
        db.Carts.Include(c => c.Items).FirstOrDefaultAsync(c => c.UserId == userId, ct);

    private async Task<Result<Cart>> GetOrCreateCartAsync(CancellationToken ct)
    {
        var cart = await FindCartAsync(ct);
        if (cart is not null) return cart;

        var now = clock.GetUtcNow().UtcDateTime;
        if (currentUser.UserId is int userId)
        {
            cart = Cart.CreateForUser(userId, now);
        }
        else if (currentUser.GuestCartId is Guid guestId)
        {
            // The id may belong to a user cart; never let a guest attach to it.
            if (await db.Carts.AnyAsync(c => c.Id == guestId, ct))
                return Error.Conflict("cart.id_in_use", "Identificador de carrito inválido. Generá uno nuevo.");
            cart = Cart.CreateForGuest(guestId, now);
        }
        else
        {
            return Error.Validation("cart.missing_id", "Falta el identificador del carrito (encabezado X-Cart-Id).");
        }

        db.Carts.Add(cart);
        return cart;
    }

    internal async Task<CartDto> ToDtoAsync(Cart cart, CancellationToken ct)
    {
        if (cart.Items.Count == 0) return EmptyCart;

        var productIds = cart.Items.Select(i => i.ProductId).ToList();
        var products = await db.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Price,
                p.Stock,
                p.ImageFileName,
                Sellable = p.IsActive && p.Category!.IsActive
            })
            .ToDictionaryAsync(p => p.Id, ct);

        var items = cart.Items
            .Select(item =>
            {
                products.TryGetValue(item.ProductId, out var p);
                var available = p is not null && p.Sellable && p.Stock > 0;
                var price = p?.Price ?? 0;
                return new CartItemDto(
                    item.ProductId,
                    p?.Name ?? "Producto no disponible",
                    ProductImages.Url(p?.ImageFileName),
                    price,
                    item.Quantity,
                    p?.Stock ?? 0,
                    available,
                    ExceedsStock: available && item.Quantity > p!.Stock,
                    Subtotal: price * item.Quantity);
            })
            .OrderBy(i => i.Name, StringComparer.CurrentCulture)
            .ToList();

        var purchasable = items.Where(i => i.IsAvailable).ToList();
        return new CartDto(
            items,
            TotalQuantity: items.Sum(i => i.Quantity),
            Total: purchasable.Sum(i => i.Subtotal),
            HasUnavailableItems: purchasable.Count < items.Count,
            CanCheckout: purchasable.Count > 0 && purchasable.All(i => !i.ExceedsStock));
    }
}
