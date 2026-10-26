using Microsoft.EntityFrameworkCore;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Domain.Carts;
using MotoRepuestos.Domain.Catalog;
using MotoRepuestos.Domain.Favorites;
using MotoRepuestos.Domain.Ordering;
using MotoRepuestos.Domain.Settings;
using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Cart> Carts => Set<Cart>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderStatusChange> OrderStatusChanges => Set<OrderStatusChange>();
    public DbSet<Favorite> Favorites => Set<Favorite>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);

        // Everything is stored in UTC; mark values read back as UTC so they serialize with "Z".
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();
    }
}
