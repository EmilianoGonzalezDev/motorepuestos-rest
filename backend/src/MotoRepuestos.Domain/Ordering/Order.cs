using MotoRepuestos.Domain.Catalog;
using MotoRepuestos.Domain.Common;
using MotoRepuestos.Domain.Users;

namespace MotoRepuestos.Domain.Ordering;

public sealed class Order
{
    public const int NotesMaxLength = 500;

    /// <summary>Allowed status transitions. Delivered and Cancelled are final.</summary>
    private static readonly Dictionary<OrderStatus, OrderStatus[]> Transitions = new()
    {
        [OrderStatus.Pending] = [OrderStatus.Prepared, OrderStatus.Cancelled],
        [OrderStatus.Prepared] = [OrderStatus.Delivered, OrderStatus.Cancelled, OrderStatus.Pending],
        [OrderStatus.Delivered] = [],
        [OrderStatus.Cancelled] = []
    };

    private readonly List<OrderItem> _items = [];
    private readonly List<OrderStatusChange> _statusHistory = [];

    private Order() { }

    public int Id { get; private set; }
    public int UserId { get; private set; }
    public User? User { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public PaymentType PaymentType { get; private set; }
    public OrderStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public decimal Total { get; private set; }

    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
    public IReadOnlyCollection<OrderStatusChange> StatusHistory => _statusHistory.AsReadOnly();

    public static IReadOnlyCollection<OrderStatus> AllowedNextStatuses(OrderStatus from) => Transitions[from];

    /// <summary>
    /// Creates the order and takes the units out of stock. Prices are copied from the products,
    /// never trusted from the client.
    /// </summary>
    public static Order Place(
        int userId,
        PaymentType paymentType,
        string? notes,
        IReadOnlyCollection<(Product Product, int Quantity)> lines,
        DateTime utcNow)
    {
        if (lines.Count == 0)
            throw new DomainException("order.empty", "El pedido no tiene productos.");

        if (!Enum.IsDefined(paymentType))
            throw new DomainException("order.invalid_payment", "Medio de pago inválido.");

        var order = new Order
        {
            UserId = userId,
            PaymentType = paymentType,
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            CreatedAt = utcNow,
            Status = OrderStatus.Pending
        };

        if (order.Notes?.Length > NotesMaxLength)
            throw new DomainException("order.notes_too_long", $"Las notas no pueden superar los {NotesMaxLength} caracteres.");

        foreach (var (product, quantity) in lines)
        {
            product.DecreaseStock(quantity);
            order._items.Add(new OrderItem(product.Id, product.Name, product.ImageFileName, product.Price, quantity));
        }

        order.Total = order._items.Sum(i => i.Subtotal);
        order._statusHistory.Add(new OrderStatusChange(OrderStatus.Pending, utcNow, userId, "Pedido recibido"));
        return order;
    }

    public bool CanTransitionTo(OrderStatus next) => Transitions[Status].Contains(next);

    public bool IsCancellableByCustomer => Status == OrderStatus.Pending;

    /// <summary>
    /// Moves the order forward/backward in its lifecycle. Returns true when the change
    /// requires returning stock (cancellation), so the caller can restock the products.
    /// </summary>
    public bool ChangeStatus(OrderStatus next, int? changedByUserId, string? note, DateTime utcNow)
    {
        if (next == Status)
            throw new DomainException("order.same_status", "El pedido ya se encuentra en ese estado.");

        if (!CanTransitionTo(next))
            throw new DomainException("order.invalid_transition",
                $"No se puede pasar un pedido de '{Status}' a '{next}'.");

        Status = next;
        _statusHistory.Add(new OrderStatusChange(next, utcNow, changedByUserId, note));
        return next == OrderStatus.Cancelled;
    }

    public void CancelByCustomer(int userId, string? reason, DateTime utcNow)
    {
        if (userId != UserId)
            throw new DomainException("order.not_owner", "El pedido no pertenece al usuario.");

        if (!IsCancellableByCustomer)
            throw new DomainException("order.not_cancellable", "Solo se pueden cancelar pedidos pendientes.");

        ChangeStatus(OrderStatus.Cancelled, userId, string.IsNullOrWhiteSpace(reason) ? "Cancelado por el cliente" : reason, utcNow);
    }
}
