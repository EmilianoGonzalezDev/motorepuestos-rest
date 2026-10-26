namespace MotoRepuestos.Api.Infrastructure;

internal static class Policies
{
    /// <summary>Admin or SuperAdmin.</summary>
    public const string Staff = "Staff";

    public const string SuperAdmin = "SuperAdmin";
}

internal static class RateLimitPolicies
{
    public const string Auth = "auth";
    public const string Writes = "writes";
    public const string DemoReset = "demo-reset";
}
