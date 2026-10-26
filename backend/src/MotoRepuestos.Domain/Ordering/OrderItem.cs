namespace MotoRepuestos.Domain.Ordering;

public sealed class OrderItem
{
    private OrderItem() { }

    internal OrderItem(int productId, string productName, string? imageFileName, decimal unitPrice, int quantity)
    {
        ProductId = productId;
        ProductName = productName;
        ImageFileName = imageFileName;
        UnitPrice = unitPrice;
        Quantity = quantity;
    }

    public int Id { get; private set; }
    public int OrderId { get; private set; }
    public int ProductId { get; private set; }

    /// <summary>Snapshot taken at checkout so later product edits don't rewrite order history.</summary>
    public string ProductName { get; private set; } = string.Empty;

    public string? ImageFileName { get; private set; }
    public decimal UnitPrice { get; private set; }
    public int Quantity { get; private set; }

    public decimal Subtotal => UnitPrice * Quantity;
}
