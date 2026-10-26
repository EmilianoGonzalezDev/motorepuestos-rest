using System.Globalization;
using System.Linq.Expressions;
using System.Text;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Logging;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Catalog;
using MotoRepuestos.Domain.Ordering;

namespace MotoRepuestos.Application.Features.Orders;

public sealed class OrderService(
    IAppDbContext db,
    ICurrentUser currentUser,
    TimeProvider clock,
    HybridCache cache,
    IValidator<PlaceOrderRequest> placeValidator,
    IValidator<ChangeOrderStatusRequest> statusValidator,
    ILogger<OrderService> logger)
{
    /// <summary>Checkout/restock retries when another request changed the same products (rowversion conflict).</summary>
    private const int MaxConcurrencyAttempts = 3;

    private static readonly Expression<Func<Order, OrderSummaryDto>> SummaryProjection = o => new OrderSummaryDto(
        o.Id,
        o.CreatedAt,
        o.Status,
        o.PaymentType,
        o.Total,
        o.Items.Sum(i => i.Quantity),
        new OrderCustomerDto(o.UserId, o.User!.FullName, o.User.Email),
        o.Items.Select(i => new OrderItemDto(i.ProductId, i.ProductName, i.ImageFileName, i.UnitPrice, i.Quantity)).ToList());

    /// <summary>
    /// Turns the user's cart into an order. Stock is decremented inside the same SaveChanges;
    /// if a concurrent checkout touched the same products the whole operation is retried.
    /// </summary>
    public async Task<Result<OrderDetailDto>> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken ct = default)
    {
        if (await placeValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        if (currentUser.UserId is not int userId)
            return Error.Unauthorized("auth.required", "Iniciá sesión para finalizar la compra.");

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var cart = await db.Carts.Include(c => c.Items).FirstOrDefaultAsync(c => c.UserId == userId, ct);
                if (cart is null || cart.Items.Count == 0)
                    return Error.Validation("order.empty_cart", "No hay productos en el carrito para finalizar la compra.");

                var productIds = cart.Items.Select(i => i.ProductId).ToList();
                var products = await db.Products
                    .Include(p => p.Category)
                    .Where(p => productIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, ct);

                var lines = cart.Items
                    .Where(i => products.TryGetValue(i.ProductId, out var p) && p.IsSellable)
                    .Select(i => (Product: products[i.ProductId], i.Quantity))
                    .ToList();

                if (lines.Count == 0)
                    return Error.Conflict("order.nothing_available", "No hay productos disponibles para finalizar la compra.");

                var insufficient = lines.Where(l => l.Quantity > l.Product.Stock).ToList();
                if (insufficient.Count > 0)
                {
                    var detail = string.Join(", ", insufficient.Select(l => $"{l.Product.Name} (disponible: {l.Product.Stock})"));
                    return Error.Conflict("order.insufficient_stock",
                        $"Algunos productos ya no cuentan con el stock requerido: {detail}. Ajustá las cantidades e intentá nuevamente.");
                }

                var now = clock.GetUtcNow().UtcDateTime;
                var order = Order.Place(userId, request.PaymentType, request.Notes, lines, now);
                db.Orders.Add(order);

                // Unavailable items stay in the cart (flagged) so the customer can buy them once restocked.
                cart.RemoveMany(lines.Select(l => l.Product.Id), now);

                await db.SaveChangesAsync(ct);
                await cache.RemoveByTagAsync(CatalogService.CacheTag, ct);

                logger.LogInformation("Order {OrderId} placed by user {UserId}: {Items} items, total {Total}",
                    order.Id, userId, lines.Count, order.Total);

                return (await LoadDetailAsync(order.Id, ct))!;
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxConcurrencyAttempts)
            {
                logger.LogWarning("Concurrency conflict placing order for user {UserId}, attempt {Attempt}", userId, attempt);
                db.ChangeTracker.Clear();
            }
        }
    }

    public async Task<PagedResponse<OrderSummaryDto>> GetMyOrdersAsync(MyOrdersQuery query, CancellationToken ct = default)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize);
        var userId = currentUser.UserId ?? 0;

        var orders = db.Orders.AsNoTracking().Where(o => o.UserId == userId);
        if (query.Status is { } status) orders = orders.Where(o => o.Status == status);

        return await orders
            .OrderByDescending(o => o.CreatedAt)
            .Select(SummaryProjection)
            .ToPagedAsync(page, pageSize, ct);
    }

    /// <summary>Order detail for its owner or staff. Other users get 404 (existence is not leaked).</summary>
    public async Task<Result<OrderDetailDto>> GetAsync(int orderId, CancellationToken ct = default)
    {
        var detail = await LoadDetailAsync(orderId, ct);
        if (detail is null || (!currentUser.IsStaff && detail.Customer.Id != currentUser.UserId))
            return OrderNotFound();

        return detail;
    }

    public async Task<Result<OrderDetailDto>> CancelMyOrderAsync(int orderId, CancelOrderRequest request, CancellationToken ct = default)
    {
        if (currentUser.UserId is not int userId)
            return Error.Unauthorized("auth.required", "Iniciá sesión para continuar.");

        return await WithConcurrencyRetryAsync(async () =>
        {
            var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId && o.UserId == userId, ct);
            if (order is null) return OrderNotFound();

            order.CancelByCustomer(userId, request.Reason, clock.GetUtcNow().UtcDateTime);
            await RestockAsync(order, ct);
            await db.SaveChangesAsync(ct);

            logger.LogInformation("Order {OrderId} cancelled by its customer", orderId);
            return Result<OrderDetailDto>.Success((await LoadDetailAsync(orderId, ct))!);
        }, ct);
    }

    public async Task<PagedResponse<OrderSummaryDto>> ListAsync(AdminOrdersQuery query, CancellationToken ct = default)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize);

        return await ApplyAdminFilters(query)
            .OrderByDescending(o => o.CreatedAt)
            .Select(SummaryProjection)
            .ToPagedAsync(page, pageSize, ct);
    }

    public async Task<Result<OrderDetailDto>> ChangeStatusAsync(int orderId, ChangeOrderStatusRequest request, CancellationToken ct = default)
    {
        if (await statusValidator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        return await WithConcurrencyRetryAsync(async () =>
        {
            var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId, ct);
            if (order is null) return OrderNotFound();

            var requiresRestock = order.ChangeStatus(request.Status, currentUser.UserId, request.Note, clock.GetUtcNow().UtcDateTime);
            if (requiresRestock) await RestockAsync(order, ct);

            await db.SaveChangesAsync(ct);
            logger.LogInformation("Order {OrderId} moved to {Status} by {UserId}", orderId, request.Status, currentUser.UserId);
            return Result<OrderDetailDto>.Success((await LoadDetailAsync(orderId, ct))!);
        }, ct);
    }

    /// <summary>CSV export (semicolon separated + BOM so Excel in es-AR opens it correctly).</summary>
    public async Task<byte[]> ExportCsvAsync(AdminOrdersQuery query, CancellationToken ct = default)
    {
        var rows = await ApplyAdminFilters(query)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new
            {
                o.Id,
                o.CreatedAt,
                Customer = o.User!.FullName,
                o.User.Email,
                o.Status,
                o.PaymentType,
                Items = o.Items.Sum(i => i.Quantity),
                o.Total
            })
            .Take(10_000)
            .ToListAsync(ct);

        var culture = CultureInfo.GetCultureInfo("es-AR");
        var sb = new StringBuilder();
        sb.AppendLine("Pedido;Fecha;Cliente;Email;Estado;Pago;Unidades;Total");
        foreach (var r in rows)
        {
            sb.Append(r.Id).Append(';')
              .Append(StoreTime.ToLocal(r.CreatedAt).ToString("dd/MM/yyyy HH:mm", culture)).Append(';')
              .Append(Csv(r.Customer)).Append(';')
              .Append(Csv(r.Email)).Append(';')
              .Append(OrderLabels.Status(r.Status)).Append(';')
              .Append(OrderLabels.Payment(r.PaymentType)).Append(';')
              .Append(r.Items).Append(';')
              .Append(r.Total.ToString("0.00", culture))
              .AppendLine();
        }

        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(sb.ToString())];
    }

    private IQueryable<Order> ApplyAdminFilters(AdminOrdersQuery query)
    {
        var orders = db.Orders.AsNoTracking();

        if (query.Statuses is { Length: > 0 } statuses)
            orders = orders.Where(o => statuses.Contains(o.Status));

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().TrimStart('#').ToLower();
            if (int.TryParse(term, out var orderId))
                orders = orders.Where(o => o.Id == orderId);
            else
                orders = orders.Where(o => o.User!.FullName.ToLower().Contains(term) || o.User.Email.Contains(term));
        }

        if (query.From is { } from)
        {
            var fromUtc = StoreTime.ToUtcStart(from);
            orders = orders.Where(o => o.CreatedAt >= fromUtc);
        }

        if (query.To is { } to)
        {
            var toUtc = StoreTime.ToUtcStart(to.AddDays(1));
            orders = orders.Where(o => o.CreatedAt < toUtc);
        }

        return orders;
    }

    private async Task<OrderDetailDto?> LoadDetailAsync(int orderId, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking()
            .Where(o => o.Id == orderId)
            .Select(o => new
            {
                o.Id,
                o.CreatedAt,
                o.Status,
                o.PaymentType,
                o.Notes,
                o.Total,
                Customer = new OrderCustomerDto(o.UserId, o.User!.FullName, o.User.Email),
                Items = o.Items.Select(i => new OrderItemDto(i.ProductId, i.ProductName, i.ImageFileName, i.UnitPrice, i.Quantity)).ToList(),
                History = o.StatusHistory
                    .OrderBy(h => h.ChangedAt)
                    .Select(h => new
                    {
                        h.Status,
                        h.ChangedAt,
                        h.Note,
                        h.ChangedByUserId,
                        ChangedByName = db.Users.Where(u => u.Id == h.ChangedByUserId).Select(u => u.FullName).FirstOrDefault()
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (order is null) return null;

        var isStaff = currentUser.IsStaff;
        var history = order.History
            .Select(h => new OrderStatusChangeDto(
                h.Status,
                h.ChangedAt,
                h.Note,
                h.ChangedByUserId == order.Customer.Id ? "Cliente" : isStaff ? h.ChangedByName : "MotoRepuestos"))
            .ToList();

        return new OrderDetailDto(
            order.Id,
            order.CreatedAt,
            order.Status,
            order.PaymentType,
            order.Notes,
            order.Total,
            order.Customer,
            order.Items,
            history,
            isStaff ? Order.AllowedNextStatuses(order.Status).ToList() : [],
            CanCancel: order.Status == OrderStatus.Pending);
    }

    private async Task RestockAsync(Order order, CancellationToken ct)
    {
        var ids = order.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await db.Products.Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);

        foreach (var item in order.Items)
        {
            if (products.TryGetValue(item.ProductId, out var product))
                product.IncreaseStock(item.Quantity);
        }

        await cache.RemoveByTagAsync(CatalogService.CacheTag, ct);
    }

    private async Task<Result<OrderDetailDto>> WithConcurrencyRetryAsync(
        Func<Task<Result<OrderDetailDto>>> operation, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                return await operation();
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxConcurrencyAttempts)
            {
                db.ChangeTracker.Clear();
            }
        }
    }

    private static string Csv(string value) =>
        value.Contains(';') || value.Contains('"') ? $"\"{value.Replace("\"", "\"\"")}\"" : value;

    private static Error OrderNotFound() => Error.NotFound("order.not_found", "Pedido no encontrado.");
}

public static class OrderLabels
{
    public static string Status(OrderStatus status) => status switch
    {
        OrderStatus.Pending => "Pendiente",
        OrderStatus.Prepared => "Preparado",
        OrderStatus.Delivered => "Entregado",
        OrderStatus.Cancelled => "Cancelado",
        _ => status.ToString()
    };

    public static string Payment(PaymentType payment) => payment switch
    {
        PaymentType.Store => "En local",
        PaymentType.Card => "Tarjeta",
        PaymentType.BankTransfer => "Transferencia",
        _ => payment.ToString()
    };
}
