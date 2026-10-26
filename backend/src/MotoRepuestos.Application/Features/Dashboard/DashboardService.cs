using Microsoft.EntityFrameworkCore;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Settings;
using MotoRepuestos.Domain.Ordering;
using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Application.Features.Dashboard;

public sealed record DashboardKpisDto(
    decimal RevenueThisMonth,
    decimal RevenuePreviousMonth,
    int OrdersThisMonth,
    decimal AverageTicket,
    int PendingOrders,
    int PreparedOrders,
    int LowStockProducts,
    int ActiveProducts,
    int Customers);

public sealed record DailySalesDto(DateOnly Date, decimal Revenue, int Orders);

public sealed record TopProductDto(int ProductId, string Name, int Quantity, decimal Revenue);

public sealed record StatusCountDto(OrderStatus Status, int Count);

public sealed record LowStockProductDto(int Id, string Name, int Stock, string? ImageUrl);

public sealed record RecentOrderDto(int Id, string CustomerName, decimal Total, OrderStatus Status, DateTime CreatedAt);

public sealed record DashboardDto(
    DashboardKpisDto Kpis,
    IReadOnlyList<DailySalesDto> SalesByDay,
    IReadOnlyList<TopProductDto> TopProducts,
    IReadOnlyList<StatusCountDto> OrdersByStatus,
    IReadOnlyList<LowStockProductDto> LowStock,
    IReadOnlyList<RecentOrderDto> RecentOrders,
    int LowStockThreshold);

public sealed class DashboardService(IAppDbContext db, SettingsService settings, TimeProvider clock)
{
    public async Task<DashboardDto> GetAsync(int days, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 7, 90);
        var threshold = await settings.GetLowStockThresholdAsync(ct);

        var today = StoreTime.Today(clock);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var windowStart = today.AddDays(-(days - 1));
        var queryFromUtc = StoreTime.ToUtcStart(windowStart < monthStart.AddMonths(-1) ? windowStart : monthStart.AddMonths(-1));

        // A small shop has at most a few thousand orders in this window: aggregate in memory so
        // days are computed in the store's time zone, not UTC.
        var orders = await db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= queryFromUtc && o.Status != OrderStatus.Cancelled)
            .Select(o => new { o.CreatedAt, o.Total })
            .ToListAsync(ct);

        var withLocalDate = orders.Select(o => (Date: DateOnly.FromDateTime(StoreTime.ToLocal(o.CreatedAt)), o.Total)).ToList();
        var thisMonth = withLocalDate.Where(o => o.Date >= monthStart).ToList();
        // Compare against the same elapsed days of the previous month (a partial month vs. a full one is misleading).
        var previousMonthStart = monthStart.AddMonths(-1);
        var previousMonthEnd = previousMonthStart.AddDays(Math.Min(today.Day, DateTime.DaysInMonth(previousMonthStart.Year, previousMonthStart.Month)) - 1);
        var previousMonth = withLocalDate.Where(o => o.Date >= previousMonthStart && o.Date <= previousMonthEnd).ToList();

        var salesByDay = Enumerable.Range(0, days)
            .Select(offset => windowStart.AddDays(offset))
            .GroupJoin(withLocalDate, day => day, o => o.Date, (day, dayOrders) =>
            {
                var list = dayOrders.ToList();
                return new DailySalesDto(day, list.Sum(o => o.Total), list.Count);
            })
            .ToList();

        var windowStartUtc = StoreTime.ToUtcStart(windowStart);
        var topProductsRaw = await db.OrderItems.AsNoTracking()
            .Where(i => db.Orders.Any(o => o.Id == i.OrderId && o.CreatedAt >= windowStartUtc && o.Status != OrderStatus.Cancelled))
            .GroupBy(i => new { i.ProductId, i.ProductName })
            .Select(g => new { g.Key.ProductId, g.Key.ProductName, Quantity = g.Sum(i => i.Quantity), Revenue = g.Sum(i => i.UnitPrice * i.Quantity) })
            .OrderByDescending(t => t.Quantity)
            .Take(5)
            .ToListAsync(ct);
        var topProducts = topProductsRaw
            .Select(t => new TopProductDto(t.ProductId, t.ProductName, t.Quantity, t.Revenue))
            .ToList();

        var statusCounts = await db.Orders.AsNoTracking()
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var ordersByStatus = Enum.GetValues<OrderStatus>()
            .Select(s => new StatusCountDto(s, statusCounts.FirstOrDefault(c => c.Status == s)?.Count ?? 0))
            .ToList();

        var lowStockRaw = await db.Products.AsNoTracking()
            .Where(p => p.IsActive && p.Stock <= threshold)
            .OrderBy(p => p.Stock).ThenBy(p => p.Name)
            .Take(8)
            .Select(p => new { p.Id, p.Name, p.Stock, p.ImageFileName })
            .ToListAsync(ct);

        var recentOrders = await db.Orders.AsNoTracking()
            .OrderByDescending(o => o.CreatedAt)
            .Take(6)
            .Select(o => new RecentOrderDto(o.Id, o.User!.FullName, o.Total, o.Status, o.CreatedAt))
            .ToListAsync(ct);

        var revenueThisMonth = thisMonth.Sum(o => o.Total);
        var kpis = new DashboardKpisDto(
            RevenueThisMonth: revenueThisMonth,
            RevenuePreviousMonth: previousMonth.Sum(o => o.Total),
            OrdersThisMonth: thisMonth.Count,
            AverageTicket: thisMonth.Count == 0 ? 0 : Math.Round(revenueThisMonth / thisMonth.Count, 2),
            PendingOrders: ordersByStatus.First(s => s.Status == OrderStatus.Pending).Count,
            PreparedOrders: ordersByStatus.First(s => s.Status == OrderStatus.Prepared).Count,
            LowStockProducts: await db.Products.CountAsync(p => p.IsActive && p.Stock <= threshold, ct),
            ActiveProducts: await db.Products.CountAsync(p => p.IsActive, ct),
            Customers: await db.Users.CountAsync(u => u.Role == UserRole.Client, ct));

        return new DashboardDto(
            kpis,
            salesByDay,
            topProducts,
            ordersByStatus,
            lowStockRaw.Select(p => new LowStockProductDto(p.Id, p.Name, p.Stock, ProductImages.Url(p.ImageFileName))).ToList(),
            recentOrders,
            threshold);
    }
}
