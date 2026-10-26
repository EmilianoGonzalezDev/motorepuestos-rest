namespace MotoRepuestos.Domain.Ordering;

public enum OrderStatus
{
    /// <summary>Received, waiting to be prepared.</summary>
    Pending = 0,

    /// <summary>Packed and ready for pickup / delivery.</summary>
    Prepared = 1,

    /// <summary>Handed over to the customer (final).</summary>
    Delivered = 2,

    /// <summary>Cancelled by the customer or the store; stock is returned (final).</summary>
    Cancelled = 3
}

public enum PaymentType
{
    /// <summary>Pays at the store when picking up.</summary>
    Store = 0,
    Card = 1,
    BankTransfer = 2
}
