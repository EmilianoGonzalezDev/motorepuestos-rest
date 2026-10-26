using System.Text.RegularExpressions;
using Microsoft.AspNetCore.StaticFiles;

namespace MotoRepuestos.Api.Infrastructure;

/// <summary>
/// Serves the compiled Angular app from wwwroot when it is there (the Azure deployment copies it in),
/// so the SPA and the API share one origin and the SameSite=Strict refresh cookie just works. In Docker
/// nginx serves the SPA instead and wwwroot stays empty.
/// </summary>
internal static partial class SpaHosting
{
    // Angular build output with a content hash in the name (main-ABCD1234.js, styles-XYZ98765.css, media/...).
    [GeneratedRegex(@"-[A-Za-z0-9]{8,}\.[a-z0-9]+$")]
    private static partial Regex HashedAsset();

    public static bool HasSpa(this WebApplication app) =>
        app.Environment.WebRootFileProvider.GetFileInfo("index.html").Exists;

    public static WebApplication UseSpaStaticFiles(this WebApplication app)
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl =
                HashedAsset().IsMatch(ctx.File.Name) ? "public,max-age=31536000,immutable" : "no-cache"
        });
        return app;
    }

    /// <summary>Unknown /api routes get a ProblemDetails 404 instead of falling through to index.html.</summary>
    public static WebApplication MapApiNotFound(this WebApplication app)
    {
        app.MapFallback("/api/{**path}", () => Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "El recurso solicitado no existe.",
                type: "https://httpstatuses.io/404",
                extensions: new Dictionary<string, object?> { ["code"] = "not_found" }))
            .ExcludeFromDescription();
        return app;
    }

    /// <summary>Client-side routes (/productos/12, /admin/...) are answered with index.html.</summary>
    public static WebApplication MapSpaFallback(this WebApplication app)
    {
        // The default {*path:nonfile} pattern skips paths with a file extension, so missing assets stay 404.
        app.MapFallbackToFile("index.html", new StaticFileOptions
        {
            OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache"
        });
        return app;
    }
}
