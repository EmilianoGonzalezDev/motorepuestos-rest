using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MotoRepuestos.Infrastructure.Persistence;

namespace MotoRepuestos.Infrastructure.BackgroundJobs;

/// <summary>
/// With Database:InitializeInBackground, initializes the database after the app starts listening, so the
/// SPA loads immediately while a sleeping serverless database resumes. Retries until it succeeds.
/// </summary>
internal sealed class DatabaseInitializationService(
    IServiceProvider services,
    AppReadiness readiness,
    IOptions<DatabaseOptions> options,
    TimeProvider clock,
    ILogger<DatabaseInitializationService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.InitializeInBackground) return;
        await Task.Yield();

        var startedAt = clock.GetUtcNow();
        var timeout = TimeSpan.FromSeconds(options.Value.WarmupTimeoutSeconds);

        for (var attempt = 1; !stoppingToken.IsCancellationRequested; attempt++)
        {
            try
            {
                await DatabaseInitializer.InitializeOnceAsync(services, stoppingToken);
                logger.LogInformation("Database ready after {Elapsed:0.0} s", (clock.GetUtcNow() - startedAt).TotalSeconds);
                return;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                if (DatabaseInitializer.IsTransient(ex))
                    logger.LogWarning("Database not ready (attempt {Attempt}): {Message}", attempt, ex.Message);
                else
                    logger.LogError(ex, "Database initialization failed (attempt {Attempt})", attempt);
            }

            if (clock.GetUtcNow() - startedAt >= timeout) readiness.MarkUnavailable();
            await Task.Delay(TimeSpan.FromSeconds(Math.Min(5 * attempt, 60)), clock, stoppingToken);
        }
    }
}
