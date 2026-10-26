using MotoRepuestos.Domain.Common;

namespace MotoRepuestos.Domain.Users;

public enum UserRole
{
    Client = 0,
    Admin = 1,

    /// <summary>Admin that can also manage other administrators.</summary>
    SuperAdmin = 2
}

public sealed class User : AuditableEntity
{
    public const int FullNameMaxLength = 150;
    public const int EmailMaxLength = 150;

    private readonly List<RefreshToken> _refreshTokens = [];

    private User() { }

    public int Id { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public UserRole Role { get; private set; }
    public bool IsActive { get; private set; } = true;
    public DateTime? LastLoginAt { get; private set; }

    public IReadOnlyCollection<RefreshToken> RefreshTokens => _refreshTokens.AsReadOnly();

    public bool IsStaff => Role is UserRole.Admin or UserRole.SuperAdmin;

    public static User Create(string fullName, string email, UserRole role) => new()
    {
        FullName = Guard.NotEmpty(fullName, "nombre", FullNameMaxLength),
        Email = NormalizeEmail(email),
        Role = role,
        IsActive = true
    };

    public static string NormalizeEmail(string email) =>
        Guard.NotEmpty(email, "email", EmailMaxLength).ToLowerInvariant();

    public void SetPasswordHash(string passwordHash) => PasswordHash = passwordHash;

    public void UpdateProfile(string fullName, string email)
    {
        FullName = Guard.NotEmpty(fullName, "nombre", FullNameMaxLength);
        Email = NormalizeEmail(email);
    }

    public void RecordLogin(DateTime utcNow) => LastLoginAt = utcNow;

    public void Activate() => IsActive = true;

    public void Deactivate()
    {
        if (Role == UserRole.SuperAdmin)
            throw new DomainException("user.superadmin_locked", "No se puede desactivar un super administrador.");
        IsActive = false;
    }

    public RefreshToken AddRefreshToken(string tokenHash, DateTime expiresAt, DateTime utcNow, string? createdByIp)
    {
        var token = new RefreshToken(tokenHash, expiresAt, utcNow, createdByIp);
        _refreshTokens.Add(token);
        return token;
    }

    public void RevokeAllRefreshTokens(DateTime utcNow)
    {
        foreach (var token in _refreshTokens.Where(t => t.RevokedAt is null))
            token.Revoke(utcNow, replacedByTokenHash: null);
    }

    /// <summary>Drops expired/revoked tokens older than the retention window to keep the table small.</summary>
    public void PruneRefreshTokens(DateTime utcNow, TimeSpan retention) =>
        _refreshTokens.RemoveAll(t => !t.IsActive(utcNow) && t.CreatedAt < utcNow - retention);
}
