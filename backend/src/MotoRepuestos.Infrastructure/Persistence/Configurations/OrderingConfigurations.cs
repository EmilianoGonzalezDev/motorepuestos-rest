using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MotoRepuestos.Domain.Catalog;
using MotoRepuestos.Domain.Ordering;

namespace MotoRepuestos.Infrastructure.Persistence.Configurations;

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders");
        builder.HasKey(o => o.Id);

        builder.Property(o => o.Total).HasPrecision(14, 2);
        builder.Property(o => o.Notes).HasMaxLength(Order.NotesMaxLength);
        builder.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(o => o.PaymentType).HasConversion<string>().HasMaxLength(20);

        builder.HasOne(o => o.User)
            .WithMany()
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(o => o.Items).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(o => o.StatusHistory)
            .WithOne()
            .HasForeignKey(h => h.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(o => o.StatusHistory).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(o => new { o.UserId, o.CreatedAt });
        builder.HasIndex(o => new { o.Status, o.CreatedAt });

        builder.Ignore(o => o.IsCancellableByCustomer);
    }
}

internal sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("OrderItems");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.ProductName).HasMaxLength(Product.NameMaxLength).IsRequired();
        builder.Property(i => i.ImageFileName).HasMaxLength(100);
        builder.Property(i => i.UnitPrice).HasPrecision(12, 2);
        builder.Ignore(i => i.Subtotal);

        // Product rows are never deleted (only deactivated), but keep the history safe anyway.
        builder.HasOne<Product>()
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class OrderStatusChangeConfiguration : IEntityTypeConfiguration<OrderStatusChange>
{
    public void Configure(EntityTypeBuilder<OrderStatusChange> builder)
    {
        builder.ToTable("OrderStatusChanges");
        builder.HasKey(h => h.Id);
        builder.Property(h => h.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(h => h.Note).HasMaxLength(OrderStatusChange.NoteMaxLength);
    }
}
