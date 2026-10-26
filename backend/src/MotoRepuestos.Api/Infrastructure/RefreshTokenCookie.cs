namespace MotoRepuestos.Api.Infrastructure;

/// <summary>
/// The refresh token lives in an HttpOnly cookie scoped to /api/auth: JavaScript can't read it
/// (XSS can't steal it) and the browser only sends it to the auth endpoints.
/// </summary>
internal static class RefreshTokenCookie
{
    public const string Name = "mr_refresh";
    private const string Path = "/api/auth";

    public static void Append(HttpResponse response, string token, DateTime expiresAt, bool secure) =>
        response.Cookies.Append(Name, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = Path,
            Expires = expiresAt,
            IsEssential = true
        });

    public static void Delete(HttpResponse response, bool secure) =>
        response.Cookies.Delete(Name, new CookieOptions { HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = Path });

    public static string? Read(HttpRequest request) =>
        request.Cookies.TryGetValue(Name, out var value) ? value : null;
}
