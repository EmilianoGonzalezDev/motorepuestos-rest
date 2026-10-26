namespace MotoRepuestos.Domain.Common;

/// <summary>
/// Entities whose creation/modification timestamps are stamped automatically on SaveChanges.
/// </summary>
public interface IAuditable
{
    DateTime CreatedAt { get; }
    DateTime? UpdatedAt { get; }
    void SetCreated(DateTime utcNow);
    void SetUpdated(DateTime utcNow);
}

public abstract class AuditableEntity : IAuditable
{
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public void SetCreated(DateTime utcNow) => CreatedAt = utcNow;
    public void SetUpdated(DateTime utcNow) => UpdatedAt = utcNow;
}
