using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MotoRepuestos.Domain.Catalog;

namespace MotoRepuestos.Infrastructure.Persistence.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("Categories");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Name).HasMaxLength(Category.NameMaxLength).IsRequired();
        builder.Property(c => c.IsActive).HasDefaultValue(true);
        builder.HasIndex(c => c.Name).IsUnique();
    }
}

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("Products");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name).HasMaxLength(Product.NameMaxLength).IsRequired();
        builder.Property(p => p.Description).HasMaxLength(Product.DescriptionMaxLength).IsRequired();
        builder.Property(p => p.SearchText).HasMaxLength(Product.DescriptionMaxLength + Product.NameMaxLength + 1).IsRequired();
        builder.Property(p => p.Price).HasPrecision(12, 2);
        builder.Property(p => p.ImageFileName).HasMaxLength(100);
        builder.Property(p => p.IsActive).HasDefaultValue(true);
        builder.Property(p => p.RowVersion).IsRowVersion();

        builder.HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // Covers the storefront listing (active + stock filter, newest first) and admin filters.
        builder.HasIndex(p => new { p.IsActive, p.CategoryId, p.Stock });
        builder.HasIndex(p => p.Name);

        builder.Ignore(p => p.IsSellable);
    }
}
