namespace MotoRepuestos.Infrastructure.Persistence;

public enum ReadinessState
{
    /// <summary>Migrations/seed still running (e.g. a serverless database resuming).</summary>
    Starting,
    Ready,
    /// <summary>Initialization keeps failing past the warm-up timeout; still retrying in the background.</summary>
    Unavailable
}

/// <summary>Whether the database has been initialized, so requests that need it can be answered.</summary>
public sealed class AppReadiness
{
    private readonly TaskCompletionSource _ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private volatile ReadinessState _state = ReadinessState.Starting;

    public ReadinessState State => _state;
    public bool IsReady => _state == ReadinessState.Ready;

    public Task WaitUntilReadyAsync(CancellationToken ct) => _ready.Task.WaitAsync(ct);

    internal void MarkReady()
    {
        _state = ReadinessState.Ready;
        _ready.TrySetResult();
    }

    internal void MarkUnavailable()
    {
        if (_state == ReadinessState.Starting) _state = ReadinessState.Unavailable;
    }
}
