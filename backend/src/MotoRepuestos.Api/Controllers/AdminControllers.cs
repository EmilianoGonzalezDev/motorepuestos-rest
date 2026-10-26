using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Features.Dashboard;
using MotoRepuestos.Application.Features.Settings;

namespace MotoRepuestos.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = Policies.Staff)]
public sealed class DashboardController(DashboardService dashboardService) : ControllerBase
{
    /// <summary>KPIs, daily sales, top products and stock alerts for the back-office home.</summary>
    [HttpGet]
    public async Task<DashboardDto> Get([FromQuery] int days = 30, CancellationToken ct = default) =>
        await dashboardService.GetAsync(days, ct);
}

[ApiController]
[Route("api/settings")]
[Authorize(Policy = Policies.Staff)]
public sealed class SettingsController(SettingsService settingsService) : ControllerBase
{
    [HttpGet]
    public async Task<SettingsDto> Get(CancellationToken ct) => await settingsService.GetAsync(ct);

    [HttpPut]
    [ProducesResponseType<SettingsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SettingsDto>> Update(UpdateSettingsRequest request, CancellationToken ct) =>
        this.ToActionResult(await settingsService.UpdateAsync(request, ct));
}
