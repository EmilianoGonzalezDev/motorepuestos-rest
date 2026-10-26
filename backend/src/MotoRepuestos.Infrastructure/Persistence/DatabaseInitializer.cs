using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MotoRepuestos.Infrastructure.Persistence.Seed;

namespace MotoRepuestos.Infrastructure.Persistence;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    /// <summary>Apply pending EF Core migrations on startup (handy for demos/containers).</summary>
    public bool ApplyMigrationsOnStartup { get; set; } = true;
}

public static class DatabaseInitializer
{
    /// <summary>
    /// Applies migrations and seeds demo data. Retries while SQL Server is still starting
    /// (typical when the API and the database container boot together).
    /// </summary>
    public static async Task InitializeDatabaseAsync(this IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseInitializer");
        var options = scope.ServiceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        const int maxAttempts = 10;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                if (options.ApplyMigrationsOnStartup)
                    await db.Database.MigrateAsync(ct);

                await scope.ServiceProvider.GetRequiredService<DataSeeder>().SeedAsync(ct);
                return;
            }
            catch (Exception ex) when (attempt < maxAttempts && ex is Microsoft.Data.SqlClient.SqlException or TimeoutException)
            {
                logger.LogWarning("Database not ready (attempt {Attempt}/{Max}): {Message}", attempt, maxAttempts, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(3 * attempt), ct);
            }
        }
    }
}
