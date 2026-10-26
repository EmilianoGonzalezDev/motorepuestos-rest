using Microsoft.EntityFrameworkCore;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Catalog;
using MotoRepuestos.Application.Features.Settings;
using MotoRepuestos.Domain.Favorites;

namespace MotoRepuestos.Application.Features.Favorites;

public sealed class FavoriteService(
    IAppDbContext db,
    ICurrentUser currentUser,
    SettingsService settings,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<ProductCardDto>> ListAsync(CancellationToken ct = default)
    {
        var userId = currentUser.UserId ?? 0;
        var threshold = await settings.GetLowStockThresholdAsync(ct);

        var favorites = await db.Favorites.AsNoTracking()
            .Where(f => f.UserId == userId && f.Product!.IsActive && f.Product.Category!.IsActive)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new
            {
                f.Product!.Id,
                f.Product.Name,
                f.Product.Price,
                f.Product.ImageFileName,
                f.Product.Stock,
                CategoryId = f.Product.Category!.Id,
                CategoryName = f.Product.Category.Name
            })
            .ToListAsync(ct);

        return favorites
            .Select(p => new ProductCardDto(
                p.Id, p.Name, p.Price, ProductImages.Url(p.ImageFileName), p.Stock,
                IsLowStock: p.Stock > 0 && p.Stock <= threshold,
                IsAvailable: p.Stock > 0,
                new CategoryRefDto(p.CategoryId, p.CategoryName)))
            .ToList();
    }

    public async Task<IReadOnlyList<int>> GetIdsAsync(CancellationToken ct = default)
    {
        var userId = currentUser.UserId ?? 0;
        return await db.Favorites.AsNoTracking()
            .Where(f => f.UserId == userId)
            .Select(f => f.ProductId)
            .ToListAsync(ct);
    }

    public async Task<Result> AddAsync(int productId, CancellationToken ct = default)
    {
        if (currentUser.UserId is not int userId)
            return Error.Unauthorized("auth.required", "Iniciá sesión para guardar favoritos.");

        if (!await db.Products.AnyAsync(p => p.Id == productId && p.IsActive, ct))
            return Error.NotFound("product.not_found", "El producto no existe o no está disponible.");

        // Idempotent PUT: adding an existing favorite is a no-op.
        if (await db.Favorites.AnyAsync(f => f.UserId == userId && f.ProductId == productId, ct))
            return Result.Success();

        db.Favorites.Add(new Favorite(userId, productId, clock.GetUtcNow().UtcDateTime));
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }

    public async Task RemoveAsync(int productId, CancellationToken ct = default)
    {
        var userId = currentUser.UserId ?? 0;
        await db.Favorites
            .Where(f => f.UserId == userId && f.ProductId == productId)
            .ExecuteDeleteAsync(ct);
    }
}
