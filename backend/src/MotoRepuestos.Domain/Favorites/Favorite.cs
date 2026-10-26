using MotoRepuestos.Domain.Catalog;

namespace MotoRepuestos.Domain.Favorites;

/// <summary>Product saved by a customer in their wish list.</summary>
public sealed class Favorite
{
    private Favorite() { }

    public Favorite(int userId, int productId, DateTime createdAt)
    {
        UserId = userId;
        ProductId = productId;
        CreatedAt = createdAt;
    }

    public int UserId { get; private set; }
    public int ProductId { get; private set; }
    public Product? Product { get; private set; }
    public DateTime CreatedAt { get; private set; }
}
