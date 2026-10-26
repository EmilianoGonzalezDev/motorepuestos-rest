using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MotoRepuestos.Application.Features.Catalog;
using MotoRepuestos.Application.Features.Settings;
using MotoRepuestos.Infrastructure.Persistence;
using MotoRepuestos.Infrastructure.Persistence.Seed;

namespace MotoRepuestos.Infrastructure.Demo;

/// <summary>
/// Puts the public demo back to its initial state. Every trigger (start-up, the periodic check, the
/// admin button and the token-protected endpoint) goes through here, so only one reset runs at a time.
/// The lock is per process, which is enough because the demo runs on a single instance.
/// </summary>
public sealed class DemoResetService(
    IServiceScopeFactory scopeFactory,
    DemoResetState state,
    IOptions<DemoOptions> options,
    TimeProvider clock,
    HybridCache cache,
    IHostApplicationLifetime lifetime,
    ILogger<DemoResetService> logger) : IDisposable
{
    private readonly SemaphoreSlim _lock = new(1, 1);

    public void Dispose() => _lock.Dispose();

    private TimeSpan Interval => TimeSpan.FromHours(options.Value.ResetIntervalHours);

    public bool IsResetting => _lock.CurrentCount == 0;

    /// <summary>In-memory check: true when the data is older than Demo:ResetIntervalHours.</summary>
    public bool IsDue() =>
        options.Value.Enabled && state.LastResetAt is { } last && clock.GetUtcNow().UtcDateTime - last >= Interval;

    /// <summary>Resets the data and returns the new reset time, or null if another reset is already running.</summary>
    public async Task<DateTime?> TryResetAsync(string trigger)
    {
        if (!await _lock.WaitAsync(0)) return null;
        try
        {
            // Not tied to the HTTP request: closing the browser tab must not abort a reset half-way.
            var ct = lifetime.ApplicationStopping;
            var resetAt = clock.GetUtcNow().UtcDateTime;

            await using var scope = scopeFactory.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<DemoDataResetter>().ResetAsync(resetAt, ct);
            state.Set(resetAt);

            await scope.ServiceProvider.GetRequiredService<SettingsService>().InvalidateAsync(ct);
            await cache.RemoveByTagAsync(CatalogService.CacheTag, ct);
            var removedImages = scope.ServiceProvider.GetRequiredService<DataSeeder>().RemoveNonSeedImages();

            logger.LogWarning("Demo data reset ({Trigger}); {Images} uploaded images removed", trigger, removedImages);
            return resetAt;
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <summary>
    /// Runs at start-up after migrations and seeding: loads the last reset time and resets the data if it is
    /// due. A database without a recorded reset was just seeded, so "now" becomes the baseline.
    /// </summary>
    public async Task EnsureFreshAsync(CancellationToken ct = default)
    {
        if (!options.Value.Enabled) return;

        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var lastReset = await DemoDataResetter.ReadLastResetAsync(db, ct);

        if (lastReset is null)
        {
            var now = clock.GetUtcNow().UtcDateTime;
            await DemoDataResetter.WriteLastResetAsync(db, now, ct);
            state.Set(now);
            return;
        }

        state.Set(lastReset.Value);
        if (IsDue()) await TryResetAsync("startup");
    }
}
