using MotoRepuestos.Domain.Common;

namespace MotoRepuestos.Domain.Carts;

/// <summary>
/// Shopping cart. Guests get a cart identified by a client-generated GUID (sent in the
/// X-Cart-Id header); authenticated users own exactly one cart, and the guest cart is merged
/// into it on login.
/// </summary>
public sealed class Cart
{
    public const int MaxDistinctItems = 50;

    private readonly List<CartItem> _items = [];

    private Cart() { }

    public Guid Id { get; private set; }
    public int? UserId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public IReadOnlyCollection<CartItem> Items => _items.AsReadOnly();

    public static Cart CreateForGuest(Guid id, DateTime utcNow) => new() { Id = id, CreatedAt = utcNow, UpdatedAt = utcNow };

    public static Cart CreateForUser(int userId, DateTime utcNow) =>
        new() { Id = Guid.NewGuid(), UserId = userId, CreatedAt = utcNow, UpdatedAt = utcNow };

    public int QuantityOf(int productId) => _items.FirstOrDefault(i => i.ProductId == productId)?.Quantity ?? 0;

    /// <summary>Adds units of a product, never exceeding the available stock.</summary>
    public void Add(int productId, int quantity, int availableStock, DateTime utcNow)
    {
        if (quantity <= 0)
            throw new DomainException("cart.invalid_quantity", "La cantidad debe ser mayor a cero.");

        var item = _items.FirstOrDefault(i => i.ProductId == productId);
        var newQuantity = (item?.Quantity ?? 0) + quantity;

        if (newQuantity > availableStock)
            throw new DomainException("cart.insufficient_stock",
                availableStock - (item?.Quantity ?? 0) <= 0
                    ? "No hay más unidades disponibles para agregar al carrito."
                    : $"Solo podés agregar {availableStock - (item?.Quantity ?? 0)} unidad(es) más de este producto.");

        if (item is null)
        {
            if (_items.Count >= MaxDistinctItems)
                throw new DomainException("cart.full", $"El carrito admite hasta {MaxDistinctItems} productos distintos.");
            _items.Add(new CartItem(productId, quantity, utcNow));
        }
        else
        {
            item.SetQuantity(newQuantity);
        }

        UpdatedAt = utcNow;
    }

    public void SetQuantity(int productId, int quantity, int availableStock, DateTime utcNow)
    {
        var item = _items.FirstOrDefault(i => i.ProductId == productId)
            ?? throw new DomainException("cart.item_not_found", "El producto no está en el carrito.");

        if (quantity <= 0)
            throw new DomainException("cart.invalid_quantity", "La cantidad mínima es 1.");

        if (quantity > availableStock)
            throw new DomainException("cart.insufficient_stock", $"Solo hay {availableStock} unidad(es) disponibles.");

        item.SetQuantity(quantity);
        UpdatedAt = utcNow;
    }

    public bool Remove(int productId, DateTime utcNow)
    {
        var removed = _items.RemoveAll(i => i.ProductId == productId) > 0;
        if (removed) UpdatedAt = utcNow;
        return removed;
    }

    public void RemoveMany(IEnumerable<int> productIds, DateTime utcNow)
    {
        var ids = productIds.ToHashSet();
        if (_items.RemoveAll(i => ids.Contains(i.ProductId)) > 0) UpdatedAt = utcNow;
    }

    public void Clear(DateTime utcNow)
    {
        _items.Clear();
        UpdatedAt = utcNow;
    }

    /// <summary>
    /// Moves the guest cart items into this cart. Quantities are capped to the stock available
    /// (as the MVC version did); products that cannot be sold are skipped.
    /// </summary>
    public void MergeFrom(Cart guest, IReadOnlyDictionary<int, int> sellableStockByProduct, DateTime utcNow)
    {
        foreach (var guestItem in guest.Items)
        {
            if (!sellableStockByProduct.TryGetValue(guestItem.ProductId, out var stock) || stock <= 0) continue;

            var current = QuantityOf(guestItem.ProductId);
            var toAdd = Math.Min(guestItem.Quantity, stock - current);
            if (toAdd <= 0) continue;
            if (current == 0 && _items.Count >= MaxDistinctItems) continue;

            Add(guestItem.ProductId, toAdd, stock, utcNow);
        }

        guest.Clear(utcNow);
    }
}

public sealed class CartItem
{
    private CartItem() { }

    internal CartItem(int productId, int quantity, DateTime addedAt)
    {
        ProductId = productId;
        Quantity = quantity;
        AddedAt = addedAt;
    }

    public int Id { get; private set; }
    public Guid CartId { get; private set; }
    public int ProductId { get; private set; }
    public int Quantity { get; private set; }
    public DateTime AddedAt { get; private set; }

    internal void SetQuantity(int quantity) => Quantity = quantity;
}
