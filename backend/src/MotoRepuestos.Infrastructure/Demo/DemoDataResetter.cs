using System.Globalization;
using Microsoft.EntityFrameworkCore;
using MotoRepuestos.Domain.Settings;
using MotoRepuestos.Infrastructure.Persistence;
using MotoRepuestos.Infrastructure.Persistence.Seed;

namespace MotoRepuestos.Infrastructure.Demo;

/// <summary>Deletes every row created by visitors and seeds the demo data again, in one transaction.</summary>
internal sealed class DemoDataResetter(AppDbContext db, DataSeeder seeder)
{
    // Tables with identity columns. Reseeding keeps ids (and URLs like /productos/12) stable across resets.
    private static readonly string[] IdentityTables =
        ["Categories", "Products", "Users", "RefreshTokens", "CartItems", "Orders", "OrderItems", "OrderStatusChanges"];

    // Built from the constant list above, never from input. The guard skips tables that never had a row,
    // where RESEED 0 would make the first id 0 instead of 1.
    private static readonly string ReseedSql = string.Concat(IdentityTables.Select(table =>
        $"IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(N'dbo.{table}') AND last_value IS NOT NULL) " +
        $"DBCC CHECKIDENT (N'dbo.{table}', RESEED, 0);\n"));

    public static async Task<DateTime?> ReadLastResetAsync(AppDbContext db, CancellationToken ct)
    {
        var value = await db.AppSettings.AsNoTracking()
            .Where(s => s.Key == AppSettingKeys.DemoLastResetAt)
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct);

        return DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed)
            ? parsed
            : null;
    }

    public static async Task WriteLastResetAsync(AppDbContext db, DateTime resetAtUtc, CancellationToken ct)
    {
        var value = resetAtUtc.ToString("O", CultureInfo.InvariantCulture);
        var setting = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == AppSettingKeys.DemoLastResetAt, ct);
        if (setting is null)
            db.AppSettings.Add(new AppSetting(AppSettingKeys.DemoLastResetAt, value));
        else
            setting.SetValue(value);

        await db.SaveChangesAsync(ct);
    }

    public async Task ResetAsync(DateTime resetAtUtc, CancellationToken ct)
    {
        // EnableRetryOnFailure only allows user transactions inside the execution strategy; on a transient
        // failure the whole block runs again, which is safe because the seed is deterministic.
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async token =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(token);

            await db.Orders.ExecuteDeleteAsync(token); // cascades to items and status history
            await db.Carts.ExecuteDeleteAsync(token);  // guest and user carts, cascades to items
            await db.Favorites.ExecuteDeleteAsync(token);
            await db.RefreshTokens.ExecuteDeleteAsync(token);
            await db.Users.ExecuteDeleteAsync(token);
            await db.Products.ExecuteDeleteAsync(token);
            await db.Categories.ExecuteDeleteAsync(token);
            await db.AppSettings.Where(s => s.Key != AppSettingKeys.DemoLastResetAt).ExecuteDeleteAsync(token);
            await db.Database.ExecuteSqlRawAsync(ReseedSql, token);

            db.AppSettings.Add(new AppSetting(AppSettingKeys.LowStockThreshold, "5"));
            await db.SaveChangesAsync(token);

            await seeder.SeedDataAsync(token);
            await WriteLastResetAsync(db, resetAtUtc, token);

            await transaction.CommitAsync(token);
        }, ct);
    }
}
