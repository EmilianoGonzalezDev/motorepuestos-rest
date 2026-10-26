namespace MotoRepuestos.Domain.Ordering;

/// <summary>
/// Audit trail of every status an order went through; drives the tracking timeline in the UI.
/// </summary>
public sealed class OrderStatusChange
{
    public const int NoteMaxLength = 500;

    private OrderStatusChange() { }

    internal OrderStatusChange(OrderStatus status, DateTime changedAt, int? changedByUserId, string? note)
    {
        Status = status;
        ChangedAt = changedAt;
        ChangedByUserId = changedByUserId;
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim()[..Math.Min(note.Trim().Length, NoteMaxLength)];
    }

    public int Id { get; private set; }
    public int OrderId { get; private set; }
    public OrderStatus Status { get; private set; }
    public DateTime ChangedAt { get; private set; }
    public int? ChangedByUserId { get; private set; }
    public string? Note { get; private set; }
}
