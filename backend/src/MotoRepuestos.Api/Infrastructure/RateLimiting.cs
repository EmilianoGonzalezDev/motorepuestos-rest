using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MotoRepuestos.Api.Infrastructure;

/// <summary>Per-IP request limits (section "RateLimiting"). All windows are one minute long.</summary>
internal sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>Any /api request (static files and the SPA are not counted).</summary>
    public int GlobalPermitPerMinute { get; set; } = 300;

    /// <summary>Login and registration (brute force, sign-up spam).</summary>
    public int AuthPermitPerMinute { get; set; } = 10;

    /// <summary>Every non-GET endpoint without a stricter policy.</summary>
    public int WritesPermitPerMinute { get; set; } = 60;

    /// <summary>Demo data reset (destructive and expensive).</summary>
    public int DemoResetPermitPerMinute { get; set; } = 2;
}

/// <summary>
/// The public demo shares its admin credentials, so brute force, spam sign-ups and bulk writes are
/// throttled per client IP (behind App Service / nginx the IP comes from X-Forwarded-For).
/// </summary>
internal static class RateLimiting
{
    public static IServiceCollection AddAppRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        var limits = configuration.GetSection(RateLimitingOptions.SectionName).Get<RateLimitingOptions>() ?? new();

        return services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = WriteProblemAsync;

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http =>
                http.Request.Path.StartsWithSegments("/api")
                    ? FixedWindowPerIp(http, limits.GlobalPermitPerMinute)
                    : RateLimitPartition.GetNoLimiter(string.Empty));

            options.AddPolicy(RateLimitPolicies.Auth, http => FixedWindowPerIp(http, limits.AuthPermitPerMinute));
            options.AddPolicy(RateLimitPolicies.Writes, http => FixedWindowPerIp(http, limits.WritesPermitPerMinute));
            options.AddPolicy(RateLimitPolicies.DemoReset, http => FixedWindowPerIp(http, limits.DemoResetPermitPerMinute));
        });
    }

    /// <summary>
    /// Applies the <see cref="RateLimitPolicies.Writes"/> policy to every endpoint that changes state and
    /// doesn't declare its own policy, so new endpoints are protected without remembering an attribute.
    /// </summary>
    public static TBuilder WithWriteRateLimits<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder
    {
        builder.Add(endpoint =>
        {
            var methods = endpoint.Metadata.OfType<IHttpMethodMetadata>().SelectMany(m => m.HttpMethods).ToList();
            var changesState = methods.Count == 0 || methods.Any(m => !HttpMethods.IsGet(m) && !HttpMethods.IsHead(m) && !HttpMethods.IsOptions(m));
            var hasPolicy = endpoint.Metadata.Any(m => m is EnableRateLimitingAttribute or DisableRateLimitingAttribute);
            if (changesState && !hasPolicy)
                endpoint.Metadata.Add(new EnableRateLimitingAttribute(RateLimitPolicies.Writes));
        });
        return builder;
    }

    private static RateLimitPartition<string> FixedWindowPerIp(HttpContext http, int permitLimit) =>
        RateLimitPartition.GetFixedWindowLimiter(
            http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = permitLimit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 });

    private static async ValueTask WriteProblemAsync(OnRejectedContext context, CancellationToken cancellationToken)
    {
        var http = context.HttpContext;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            http.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);

        await http.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Demasiadas solicitudes. Esperá un momento e intentá nuevamente.",
                Type = "https://httpstatuses.io/429",
                Extensions = { ["code"] = "rate_limited" }
            }
        });
    }
}
