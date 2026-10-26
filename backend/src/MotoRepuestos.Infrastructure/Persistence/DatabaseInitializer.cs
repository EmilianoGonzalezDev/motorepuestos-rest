using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MotoRepuestos.Infrastructure.Demo;
using MotoRepuestos.Infrastructure.Persistence.Seed;

namespace MotoRepuestos.Infrastructure.Persistence;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    /// <summary>Apply pending EF Core migrations on startup (handy for demos/containers).</summary>
    public bool ApplyMigrationsOnStartup { get; set; } = true;

    /// <summary>
    /// Start serving right away and initialize the database in the background; until it is ready /api
    /// answers 503 and the SPA shows a "waking up" screen. Meant for hosts that sleep (free plans with a
    /// serverless database), where waiting for the database would leave visitors with a blank page.
    /// </summary>
    public bool InitializeInBackground { get; set; }

    /// <summary>After this long without success the app reports itself as unavailable (and keeps retrying).</summary>
    public int WarmupTimeoutSeconds { get; set; } = 180;
}

public static class DatabaseInitializer
{
    /// <summary>
    /// Applies migrations, seeds demo data and, in demo mode, resets the data if it is due. Retries while
    /// SQL Server is still starting (typical when the API and the database container boot together).
    /// </summary>
    public static async Task InitializeDatabaseAsync(this IServiceProvider services, CancellationToken ct = default)
    {
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseInitializer");

        const int maxAttempts = 10;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await InitializeOnceAsync(services, ct);
                return;
            }
            catch (Exception ex) when (attempt < maxAttempts && IsTransient(ex))
            {
                logger.LogWarning("Database not ready (attempt {Attempt}/{Max}): {Message}", attempt, maxAttempts, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(3 * attempt), ct);
            }
        }
    }

    internal static async Task InitializeOnceAsync(IServiceProvider services, CancellationToken ct)
    {
        await using var scope = services.CreateAsyncScope();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;

        if (options.ApplyMigrationsOnStartup)
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync(ct);

        await scope.ServiceProvider.GetRequiredService<DataSeeder>().SeedAsync(ct);
        await scope.ServiceProvider.GetRequiredService<DemoResetService>().EnsureFreshAsync(ct);
        services.GetRequiredService<AppReadiness>().MarkReady();
    }

    /// <summary>
    /// Connection problems worth retrying: a server still booting, or a serverless Azure SQL database
    /// resuming (error 40613), which EF's retry strategy surfaces as RetryLimitExceededException.
    /// </summary>
    internal static bool IsTransient(Exception ex) =>
        ex is SqlException or TimeoutException or RetryLimitExceededException
        || ex.InnerException is SqlException or TimeoutException;
}
