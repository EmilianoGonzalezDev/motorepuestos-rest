using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using MotoRepuestos.Domain.Carts;
using MotoRepuestos.Domain.Catalog;
using MotoRepuestos.Domain.Favorites;
using MotoRepuestos.Domain.Ordering;
using MotoRepuestos.Domain.Settings;
using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Application.Abstractions;

/// <summary>
/// Unit of work over the application database. Use cases compose LINQ queries (projections,
/// filters, paging) that EF Core translates to SQL, instead of going through generic repositories.
/// </summary>
public interface IAppDbContext
{
    DbSet<Category> Categories { get; }
    DbSet<Product> Products { get; }
    DbSet<User> Users { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<Cart> Carts { get; }
    DbSet<CartItem> CartItems { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<OrderStatusChange> OrderStatusChanges { get; }
    DbSet<Favorite> Favorites { get; }
    DbSet<AppSetting> AppSettings { get; }

    ChangeTracker ChangeTracker { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
