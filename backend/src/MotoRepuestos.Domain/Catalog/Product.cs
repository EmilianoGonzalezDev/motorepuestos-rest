using MotoRepuestos.Domain.Common;

namespace MotoRepuestos.Domain.Catalog;

public sealed class Product : AuditableEntity
{
    public const int NameMaxLength = 150;
    public const int DescriptionMaxLength = 20_000;
    public const decimal MaxPrice = 9_999_999_999m;
    public const int MaxStock = 9_999_999;

    private Product() { }

    public int Id { get; private set; }
    public int CategoryId { get; private set; }
    public Category? Category { get; private set; }
    public string Name { get; private set; } = string.Empty;

    /// <summary>Sanitized HTML (rich text edited in the back office).</summary>
    public string Description { get; private set; } = string.Empty;

    public decimal Price { get; private set; }
    public int Stock { get; private set; }
    public string? ImageFileName { get; private set; }
    public bool IsActive { get; private set; } = true;

    /// <summary>Name + description without HTML, lowercased and without accents. Used by catalog search.</summary>
    public string SearchText { get; private set; } = string.Empty;

    /// <summary>Optimistic concurrency token (SQL Server rowversion) protecting stock updates.</summary>
    public byte[] RowVersion { get; private set; } = [];

    public static Product Create(int categoryId, string name, string description, decimal price, int stock)
    {
        var product = new Product { IsActive = true };
        product.Update(categoryId, name, description, price, stock);
        return product;
    }

    public void Update(int categoryId, string name, string description, decimal price, int stock)
    {
        if (categoryId <= 0)
            throw new DomainException("product.category_required", "Seleccioná una categoría.");
        if (price > MaxPrice)
            throw new DomainException("product.price_too_high", "El precio supera el máximo permitido.");
        if (stock > MaxStock)
            throw new DomainException("product.stock_too_high", "El stock supera el máximo permitido.");

        CategoryId = categoryId;
        Name = Guard.NotEmpty(name, "nombre", NameMaxLength);
        Description = Guard.NotEmpty(description, "descripción", DescriptionMaxLength);
        Price = Guard.NotNegative(price, "precio");
        Stock = Guard.NotNegative(stock, "stock");
        SearchText = Common.SearchText.ForProduct(Name, Description);
    }

    public void SetStock(int stock)
    {
        if (stock > MaxStock)
            throw new DomainException("product.stock_too_high", "El stock supera el máximo permitido.");
        Stock = Guard.NotNegative(stock, "stock");
    }

    public void SetImage(string? imageFileName) => ImageFileName = imageFileName;

    public void Activate() => IsActive = true;

    public void Deactivate() => IsActive = false;

    /// <summary>Only active products with stock, inside an active category, can be sold.</summary>
    public bool IsSellable => IsActive && Stock > 0 && (Category is null || Category.IsActive);

    public void DecreaseStock(int quantity)
    {
        Guard.Positive(quantity, "cantidad");

        if (!IsActive)
            throw new DomainException("product.inactive", $"El producto '{Name}' no está disponible para la venta.");

        if (Stock < quantity)
            throw new DomainException("product.insufficient_stock",
                $"No hay stock suficiente de '{Name}'. Disponible: {Stock}, solicitado: {quantity}.");

        Stock -= quantity;
    }

    public void IncreaseStock(int quantity)
    {
        Guard.Positive(quantity, "cantidad");
        Stock = Math.Min(MaxStock, Stock + quantity);
    }
}
