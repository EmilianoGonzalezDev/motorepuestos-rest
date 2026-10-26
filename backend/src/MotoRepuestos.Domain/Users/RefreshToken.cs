namespace MotoRepuestos.Domain.Users;

/// <summary>
/// Long-lived token used to obtain new access tokens. Only a SHA-256 hash is stored,
/// and tokens are rotated on every use (a reused token revokes the whole family).
/// </summary>
public sealed class RefreshToken
{
    private RefreshToken() { }

    internal RefreshToken(string tokenHash, DateTime expiresAt, DateTime createdAt, string? createdByIp)
    {
        TokenHash = tokenHash;
        ExpiresAt = expiresAt;
        CreatedAt = createdAt;
        CreatedByIp = createdByIp;
    }

    public int Id { get; private set; }
    public int UserId { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public DateTime? RevokedAt { get; private set; }
    public string? ReplacedByTokenHash { get; private set; }
    public string? CreatedByIp { get; private set; }

    public bool IsActive(DateTime utcNow) => RevokedAt is null && ExpiresAt > utcNow;

    public void Revoke(DateTime utcNow, string? replacedByTokenHash)
    {
        RevokedAt ??= utcNow;
        ReplacedByTokenHash ??= replacedByTokenHash;
    }
}
