using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MotoRepuestos.Infrastructure.Demo;

/// <summary>
/// Resets the demo data once it is older than Demo:ResetIntervalHours while the app stays up. The check
/// is in memory, so the database is only touched when a reset is actually due. There is deliberately no
/// external cron: waking a serverless database every night would burn its free monthly quota.
/// </summary>
internal sealed class DemoResetScheduler(
    DemoResetService resetService,
    IOptions<DemoOptions> options,
    TimeProvider clock,
    ILogger<DemoResetScheduler> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled) return;

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(options.Value.CheckIntervalMinutes), clock);
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                if (!resetService.IsDue()) continue;
                try
                {
                    await resetService.TryResetAsync("scheduled");
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Scheduled demo data reset failed");
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Shutting down.
        }
    }
}
