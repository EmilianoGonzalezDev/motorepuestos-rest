namespace MotoRepuestos.Infrastructure.Demo;

/// <summary>
/// Public demo settings (section "Demo"). When enabled, the demo accounts are listed on the login page,
/// cannot be edited or disabled, and the data goes back to the seed periodically or on demand.
/// </summary>
public sealed class DemoOptions
{
    public const string SectionName = "Demo";

    public bool Enabled { get; set; }

    /// <summary>Secret expected in the X-Demo-Reset-Token header by the token-protected reset. Empty disables it.</summary>
    public string ResetToken { get; set; } = string.Empty;

    /// <summary>The data is reset when it is older than this (checked at start-up and periodically).</summary>
    public int ResetIntervalHours { get; set; } = 24;

    /// <summary>How often the in-memory "is a reset due?" check runs. It only touches the database when one is.</summary>
    public int CheckIntervalMinutes { get; set; } = 10;

    /// <summary>Shared accounts shown on the login page; all of them use Seed:DemoPassword. Defaults live in appsettings.json.</summary>
    public List<DemoAccountOptions> Accounts { get; set; } = [];
}

public sealed class DemoAccountOptions
{
    public string Label { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}
