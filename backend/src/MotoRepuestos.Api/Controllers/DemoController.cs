using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Infrastructure.Demo;
using MotoRepuestos.Infrastructure.Persistence.Seed;

namespace MotoRepuestos.Api.Controllers;

public sealed record DemoAccountResponse(string Label, string Email);

public sealed record DemoStatusResponse(
    bool Enabled,
    string? Password,
    IReadOnlyList<DemoAccountResponse> Accounts,
    DateTime? LastResetAt,
    DateTime? NextResetAt,
    int ResetIntervalHours);

public sealed record DemoResetResponse(DateTime ResetAt);

[ApiController]
[Route("api/demo")]
public sealed class DemoController(
    IOptions<DemoOptions> demoOptions,
    IOptions<SeedOptions> seedOptions,
    DemoResetState resetState,
    DemoResetService resetService,
    ILogger<DemoController> logger) : ControllerBase
{
    private const string ResetTokenHeader = "X-Demo-Reset-Token";

    /// <summary>Public demo settings for the SPA: banner, quick-login accounts and reset times.</summary>
    [HttpGet]
    [AllowAnonymous]
    public DemoStatusResponse Status()
    {
        var demo = demoOptions.Value;
        if (!demo.Enabled) return new DemoStatusResponse(false, null, [], null, null, demo.ResetIntervalHours);

        var lastReset = resetState.LastResetAt;
        return new DemoStatusResponse(
            true,
            seedOptions.Value.DemoPassword,
            demo.Accounts.Select(a => new DemoAccountResponse(a.Label, a.Email)).ToList(),
            lastReset,
            lastReset?.AddHours(demo.ResetIntervalHours),
            demo.ResetIntervalHours);
    }

    /// <summary>
    /// Resets the demo data on demand from automation (GitHub Actions), authenticated by a shared secret
    /// in the X-Demo-Reset-Token header instead of a user session.
    /// </summary>
    [HttpPost("reset")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.DemoReset)]
    [ProducesResponseType<DemoResetResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DemoResetResponse>> Reset([FromHeader(Name = ResetTokenHeader)] string? token)
    {
        var demo = demoOptions.Value;
        if (!demo.Enabled || string.IsNullOrEmpty(demo.ResetToken)) return this.ToProblem(DemoDisabled);
        if (!TokensMatch(token, demo.ResetToken))
            return this.ToProblem(Error.Unauthorized("demo.invalid_token", "El token de restablecimiento no es válido."));

        return await ResetAsync("token");
    }

    /// <summary>"Restablecer datos demo" button of the back office. Signs everybody out, including the caller.</summary>
    [HttpPost("reset-now")]
    [Authorize(Policy = Policies.Staff)]
    [EnableRateLimiting(RateLimitPolicies.DemoReset)]
    [ProducesResponseType<DemoResetResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DemoResetResponse>> ResetNow()
    {
        if (!demoOptions.Value.Enabled) return this.ToProblem(DemoDisabled);

        logger.LogInformation("Demo data reset requested by {User}", User.Identity?.Name);
        return await ResetAsync("admin");
    }

    private async Task<ActionResult<DemoResetResponse>> ResetAsync(string trigger)
    {
        var resetAt = await resetService.TryResetAsync(trigger);
        return resetAt is { } at
            ? Ok(new DemoResetResponse(at))
            : this.ToProblem(Error.Conflict("demo.reset_in_progress",
                "Ya hay un restablecimiento en curso. Intentá nuevamente en unos segundos."));
    }

    private static readonly Error DemoDisabled = Error.NotFound("demo.disabled", "El modo demo no está activo.");

    private static bool TokensMatch(string? provided, string expected) =>
        !string.IsNullOrEmpty(provided) && CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(provided)),
            SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
}
