using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Hybrid;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Features.Catalog;
using MotoRepuestos.Application.Features.Dashboard;
using MotoRepuestos.Application.Features.Settings;
using MotoRepuestos.Infrastructure.Persistence;

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

[ApiController]
[Route("api/backups")]
[Authorize(Policy = Policies.Staff)]
public sealed class BackupsController(
    IDatabaseBackupService backupService,
    SettingsService settingsService,
    HybridCache cache,
    ILogger<BackupsController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<BackupInfo>> List(CancellationToken ct) => await backupService.ListAsync(ct);

    /// <summary>Creates a native SQL Server backup (COPY_ONLY).</summary>
    [HttpPost]
    [ProducesResponseType<BackupInfo>(StatusCodes.Status201Created)]
    public async Task<ActionResult<BackupInfo>> Create(CancellationToken ct)
    {
        var backup = await backupService.CreateAsync(ct);
        return Created("/api/backups", backup);
    }

    /// <summary>Restores a backup created by this app. Destructive: super admin only.</summary>
    [HttpPost("{fileName}/restore")]
    [Authorize(Policy = Policies.SuperAdmin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Restore(string fileName, CancellationToken ct)
    {
        try
        {
            await backupService.RestoreAsync(fileName, ct);
        }
        catch (FileNotFoundException)
        {
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "No existe un backup con ese nombre.");
        }

        // An older backup may predate recent migrations; bring the schema up to date and drop stale caches.
        await HttpContext.RequestServices.InitializeDatabaseAsync(ct);
        await settingsService.InvalidateAsync(ct);
        await cache.RemoveByTagAsync(CatalogService.CacheTag, ct);
        logger.LogWarning("Database restored from {FileName} by {User}", fileName, User.Identity?.Name);
        return NoContent();
    }
}
