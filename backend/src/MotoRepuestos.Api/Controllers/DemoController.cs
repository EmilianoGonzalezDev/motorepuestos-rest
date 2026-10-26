using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
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

[ApiController]
[Route("api/demo")]
public sealed class DemoController(IOptions<DemoOptions> demoOptions, IOptions<SeedOptions> seedOptions) : ControllerBase
{
    /// <summary>Public demo settings for the SPA: banner, quick-login accounts and reset times.</summary>
    [HttpGet]
    [AllowAnonymous]
    public DemoStatusResponse Status()
    {
        var demo = demoOptions.Value;
        if (!demo.Enabled) return new DemoStatusResponse(false, null, [], null, null, demo.ResetIntervalHours);

        return new DemoStatusResponse(
            true,
            seedOptions.Value.DemoPassword,
            demo.Accounts.Select(a => new DemoAccountResponse(a.Label, a.Email)).ToList(),
            null,
            null,
            demo.ResetIntervalHours);
    }
}
