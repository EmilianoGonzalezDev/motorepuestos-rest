using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Api.Infrastructure;

internal sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public const string CartIdHeader = "X-Cart-Id";

    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public int? UserId =>
        IsAuthenticated && int.TryParse(Principal!.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : null;

    public UserRole? Role =>
        IsAuthenticated && Enum.TryParse<UserRole>(Principal!.FindFirstValue("role"), out var role) ? role : null;

    public bool IsStaff => Role is UserRole.Admin or UserRole.SuperAdmin;

    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();

    public Guid? GuestCartId =>
        Guid.TryParse(accessor.HttpContext?.Request.Headers[CartIdHeader].ToString(), out var id) && id != Guid.Empty ? id : null;
}
