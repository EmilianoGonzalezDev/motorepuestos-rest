using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MotoRepuestos.Infrastructure.Persistence;

namespace MotoRepuestos.Infrastructure.BackgroundJobs;

/// <summary>
/// Guest carts are created for every anonymous visitor that adds a product; this job deletes the
/// ones abandoned for more than 30 days so the table doesn't grow forever.
/// </summary>
internal sealed class GuestCartCleanupService(
    IServiceScopeFactory scopeFactory,
    TimeProvider clock,
    ILogger<GuestCartCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(6);
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let the app finish starting (migrations/seed) before the first run.
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        using var timer = new PeriodicTimer(Interval, clock);
        do
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var threshold = clock.GetUtcNow().UtcDateTime - MaxAge;

                var deleted = await db.Carts
                    .Where(c => c.UserId == null && c.UpdatedAt < threshold)
                    .ExecuteDeleteAsync(stoppingToken);

                if (deleted > 0) logger.LogInformation("Deleted {Count} abandoned guest carts", deleted);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Guest cart cleanup failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
