using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Domain.Catalog;
using MotoRepuestos.Domain.Ordering;
using MotoRepuestos.Domain.Users;
using MotoRepuestos.Infrastructure.Storage;

namespace MotoRepuestos.Infrastructure.Persistence.Seed;

public sealed class SeedOptions
{
    public const string SectionName = "Seed";

    public bool Enabled { get; set; } = true;

    /// <summary>Generates ~2 months of historical orders so the dashboard has data to show.</summary>
    public bool DemoOrders { get; set; } = true;

    /// <summary>Folder with the demo product images shipped with the API.</summary>
    public string ImagesPath { get; set; } = "SeedData/images";

    public string DemoPassword { get; set; } = "Demo1234!";
}

/// <summary>
/// Seeds the same catalog the MVC version shipped with (19 categories, 48 products + images),
/// demo accounts and, optionally, historical orders. Idempotent: every block checks before inserting.
/// </summary>
internal sealed class DataSeeder(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    LocalImageStorage imageStorage,
    IOptions<SeedOptions> options,
    TimeProvider clock,
    ILogger<DataSeeder> logger)
{
    private sealed record SeedCategory(int Id, string Name, bool IsActive);
    private sealed record SeedProduct(int Id, int CategoryId, string Name, string Description, decimal Price, int Stock, bool IsActive, string? Image);
    private sealed record SeedCatalog(List<SeedCategory> Categories, List<SeedProduct> Products);

    public async Task SeedAsync(CancellationToken ct = default)
    {
        var seed = options.Value;
        if (!seed.Enabled) return;

        CopyMissingImages(seed.ImagesPath);
        await SeedUsersAsync(seed.DemoPassword, ct);
        await SeedCatalogAsync(ct);
        if (seed.DemoOrders) await SeedOrdersAsync(ct);
    }

    private void CopyMissingImages(string imagesPath)
    {
        var source = Path.IsPathRooted(imagesPath) ? imagesPath : Path.Combine(AppContext.BaseDirectory, imagesPath);
        if (!Directory.Exists(source))
        {
            logger.LogWarning("Seed images folder not found: {Path}", source);
            return;
        }

        foreach (var file in Directory.EnumerateFiles(source))
        {
            var target = Path.Combine(imageStorage.RootPath, Path.GetFileName(file));
            if (!File.Exists(target)) File.Copy(file, target);
        }
    }

    private async Task SeedUsersAsync(string demoPassword, CancellationToken ct)
    {
        if (await db.Users.AnyAsync(ct)) return;

        var users = new (string Name, string Email, UserRole Role)[]
        {
            ("Super Admin", "superadmin@motorepuestos.com", UserRole.SuperAdmin),
            ("Raúl Gómez", "admin@motorepuestos.com", UserRole.Admin),
            ("Cliente Demo", "cliente@motorepuestos.com", UserRole.Client),
            ("Juan Pérez", "juan.perez@example.com", UserRole.Client),
            ("Daniela Smith", "daniela.smith@example.com", UserRole.Client),
            ("Martín Fernández", "martin.fernandez@example.com", UserRole.Client),
            ("Lucía Romero", "lucia.romero@example.com", UserRole.Client),
            ("Sofía Acosta", "sofia.acosta@example.com", UserRole.Client)
        };

        foreach (var (name, email, role) in users)
        {
            var user = User.Create(name, email, role);
            user.SetPasswordHash(passwordHasher.Hash(user, demoPassword));
            db.Users.Add(user);
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} demo users (password: {Password})", users.Length, demoPassword);
    }

    private async Task SeedCatalogAsync(CancellationToken ct)
    {
        if (await db.Categories.AnyAsync(ct)) return;

        await using var stream = typeof(DataSeeder).Assembly
            .GetManifestResourceStream("MotoRepuestos.Infrastructure.Persistence.Seed.catalog-seed.json")
            ?? throw new InvalidOperationException("Embedded catalog seed not found.");

        var catalog = await JsonSerializer.DeserializeAsync<SeedCatalog>(stream, JsonSerializerOptions.Web, ct)
            ?? throw new InvalidOperationException("Invalid catalog seed.");

        var categories = catalog.Categories.ToDictionary(c => c.Id, c =>
        {
            var category = Category.Create(c.Name);
            if (!c.IsActive) category.Deactivate(hasActiveProducts: false);
            return category;
        });
        db.Categories.AddRange(categories.Values);
        await db.SaveChangesAsync(ct);

        foreach (var p in catalog.Products.OrderBy(p => p.Id))
        {
            var product = Product.Create(categories[p.CategoryId].Id, p.Name, p.Description, p.Price, p.Stock);
            product.SetImage(p.Image);
            if (!p.IsActive) product.Deactivate();
            db.Products.Add(product);
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded catalog: {Categories} categories, {Products} products", categories.Count, catalog.Products.Count);
    }

    private async Task SeedOrdersAsync(CancellationToken ct)
    {
        if (await db.Orders.AnyAsync(ct)) return;

        var customers = await db.Users.Where(u => u.Role == UserRole.Client).ToListAsync(ct);
        var products = await db.Products.Include(p => p.Category).Where(p => p.IsActive).ToListAsync(ct);
        if (customers.Count == 0 || products.Count == 0) return;

        var originalStock = products.ToDictionary(p => p.Id, p => p.Stock);
        foreach (var product in products) product.SetStock(Product.MaxStock);

        var random = new Random(20261006);
        var now = clock.GetUtcNow().UtcDateTime;
        const int orderCount = 70;

        for (var i = 0; i < orderCount; i++)
        {
            var daysAgo = (int)Math.Round(Math.Pow(random.NextDouble(), 1.4) * 75);
            var createdAt = now.AddDays(-daysAgo).AddHours(-random.Next(0, 12)).AddMinutes(-random.Next(0, 60));
            var customer = customers[random.Next(customers.Count)];

            var lines = products
                .OrderBy(_ => random.Next())
                .Take(random.Next(1, 4))
                .Select(p => (Product: p, Quantity: random.Next(1, 3)))
                .ToList();

            var payment = (PaymentType)random.Next(0, 3);
            var order = Order.Place(customer.Id, payment, null, lines, createdAt);
            AdvanceStatus(order, daysAgo, createdAt, random);
            db.Orders.Add(order);
        }

        // Historical orders must not eat the real stock of the demo catalog.
        foreach (var product in products) product.SetStock(originalStock[product.Id]);

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} demo orders", orderCount);
    }

    private static void AdvanceStatus(Order order, int daysAgo, DateTime createdAt, Random random)
    {
        var roll = random.NextDouble();

        if (daysAgo <= 1)
        {
            if (roll < 0.4) order.ChangeStatus(OrderStatus.Prepared, null, null, createdAt.AddHours(3));
            return;
        }

        if (daysAgo <= 4)
        {
            if (roll < 0.35) return;
            order.ChangeStatus(OrderStatus.Prepared, null, null, createdAt.AddHours(5));
            if (roll > 0.75) order.ChangeStatus(OrderStatus.Delivered, null, null, createdAt.AddDays(1));
            return;
        }

        if (roll < 0.08)
        {
            order.ChangeStatus(OrderStatus.Cancelled, null, "Cancelado por falta de pago", createdAt.AddDays(1));
            return;
        }

        order.ChangeStatus(OrderStatus.Prepared, null, null, createdAt.AddHours(6));
        order.ChangeStatus(OrderStatus.Delivered, null, null, createdAt.AddDays(random.Next(1, 3)));
    }
}
