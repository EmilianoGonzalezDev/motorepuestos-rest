namespace MotoRepuestos.Infrastructure.Demo;

/// <summary>
/// In-memory copy of the last demo reset time, so the JWT check and the periodic "is a reset due?"
/// check never query the database (that would keep a serverless database awake).
/// </summary>
public sealed class DemoResetState
{
    private long _lastResetTicks;

    /// <summary>Null until start-up has read it (or when demo mode is off).</summary>
    public DateTime? LastResetAt
    {
        get
        {
            var ticks = Interlocked.Read(ref _lastResetTicks);
            return ticks == 0 ? null : new DateTime(ticks, DateTimeKind.Utc);
        }
    }

    /// <summary>
    /// Access tokens issued before this instant belong to users that may no longer exist (ids are reseeded).
    /// Truncated to whole seconds because the JWT "iat" claim has that precision.
    /// </summary>
    public DateTime? TokensValidFrom => LastResetAt is { } last
        ? new DateTime(last.Ticks - last.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Utc)
        : null;

    internal void Set(DateTime resetAtUtc) => Interlocked.Exchange(ref _lastResetTicks, resetAtUtc.Ticks);
}
