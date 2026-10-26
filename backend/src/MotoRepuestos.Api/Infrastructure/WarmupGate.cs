using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using MotoRepuestos.Infrastructure.Persistence;

namespace MotoRepuestos.Api.Infrastructure;

/// <summary>
/// While the database is still initializing in the background, /api requests get a 503 with
/// Retry-After and a code the SPA recognizes ("app.warming_up") to show its waking-up screen and retry.
/// Nothing has been processed at that point, so retrying is safe even for writes.
/// Static files and the SPA are served before this middleware, so the page itself loads instantly.
/// </summary>
internal sealed class WarmupGateMiddleware(RequestDelegate next, AppReadiness readiness)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (readiness.IsReady || !context.Request.Path.StartsWithSegments("/api"))
        {
            await next(context);
            return;
        }

        var starting = readiness.State == ReadinessState.Starting;
        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        context.Response.Headers.RetryAfter = starting ? "5" : "60";

        await context.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = starting
                    ? "Estamos iniciando el servidor. Intentá nuevamente en unos segundos."
                    : "La demo no está disponible en este momento. Intentá nuevamente más tarde.",
                Type = "https://httpstatuses.io/503",
                Extensions = { ["code"] = starting ? "app.warming_up" : "app.unavailable" }
            }
        });
    }
}

internal sealed class AppReadinessHealthCheck(AppReadiness readiness) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        Task.FromResult(readiness.IsReady
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy($"Database initialization: {readiness.State}"));
}
