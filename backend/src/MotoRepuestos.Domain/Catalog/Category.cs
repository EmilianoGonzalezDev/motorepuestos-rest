using MotoRepuestos.Domain.Common;

namespace MotoRepuestos.Domain.Catalog;

public sealed class Category : AuditableEntity
{
    public const int NameMaxLength = 100;

    private Category() { }

    public int Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;

    public ICollection<Product> Products { get; private set; } = [];

    public static Category Create(string name) => new()
    {
        Name = Guard.NotEmpty(name, "nombre", NameMaxLength),
        IsActive = true
    };

    public void Rename(string name) => Name = Guard.NotEmpty(name, "nombre", NameMaxLength);

    public void Activate() => IsActive = true;

    /// <summary>
    /// A category can only be retired once none of its products are on sale,
    /// otherwise those products would silently disappear from the catalog.
    /// </summary>
    public void Deactivate(bool hasActiveProducts)
    {
        if (hasActiveProducts)
            throw new DomainException("category.has_active_products",
                "No se puede dar de baja la categoría porque tiene productos activos asociados.");

        IsActive = false;
    }
}
