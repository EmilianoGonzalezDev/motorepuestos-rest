using MotoRepuestos.Domain.Carts;
using MotoRepuestos.Domain.Common;

namespace MotoRepuestos.UnitTests.Domain;

public class CartTests
{
    private static readonly DateTime Now = new(2026, 10, 6, 12, 0, 0, DateTimeKind.Utc);

    private static Cart GuestCart() => Cart.CreateForGuest(Guid.NewGuid(), Now);

    [Fact]
    public void Adding_the_same_product_twice_accumulates_quantity()
    {
        var cart = GuestCart();

        cart.Add(productId: 1, quantity: 2, availableStock: 10, Now);
        cart.Add(productId: 1, quantity: 3, availableStock: 10, Now);

        cart.Items.ShouldHaveSingleItem().Quantity.ShouldBe(5);
    }

    [Fact]
    public void Cannot_add_more_units_than_the_available_stock()
    {
        var cart = GuestCart();
        cart.Add(1, 4, availableStock: 5, Now);

        Should.Throw<DomainException>(() => cart.Add(1, 2, availableStock: 5, Now))
            .Code.ShouldBe("cart.insufficient_stock");
        cart.QuantityOf(1).ShouldBe(4);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Quantity_must_be_positive(int quantity)
    {
        Should.Throw<DomainException>(() => GuestCart().Add(1, quantity, 10, Now))
            .Code.ShouldBe("cart.invalid_quantity");
    }

    [Fact]
    public void SetQuantity_replaces_the_quantity_and_validates_stock()
    {
        var cart = GuestCart();
        cart.Add(1, 1, 10, Now);

        cart.SetQuantity(1, 7, availableStock: 10, Now);
        cart.QuantityOf(1).ShouldBe(7);

        Should.Throw<DomainException>(() => cart.SetQuantity(1, 11, availableStock: 10, Now))
            .Code.ShouldBe("cart.insufficient_stock");
    }

    [Fact]
    public void Merge_moves_guest_items_into_the_user_cart_capping_to_stock()
    {
        var guest = GuestCart();
        guest.Add(productId: 1, quantity: 4, availableStock: 10, Now);
        guest.Add(productId: 2, quantity: 1, availableStock: 10, Now);
        guest.Add(productId: 3, quantity: 2, availableStock: 10, Now);

        var user = Cart.CreateForUser(userId: 5, Now);
        user.Add(productId: 1, quantity: 3, availableStock: 10, Now);

        // product 1: stock 5 → only 2 more fit; product 2: not sellable; product 3: stock 10
        var stock = new Dictionary<int, int> { [1] = 5, [3] = 10 };
        user.MergeFrom(guest, stock, Now);

        user.QuantityOf(1).ShouldBe(5);
        user.QuantityOf(2).ShouldBe(0);
        user.QuantityOf(3).ShouldBe(2);
        guest.Items.ShouldBeEmpty();
    }

    [Fact]
    public void Remove_returns_whether_something_was_removed()
    {
        var cart = GuestCart();
        cart.Add(1, 1, 5, Now);

        cart.Remove(1, Now).ShouldBeTrue();
        cart.Remove(1, Now).ShouldBeFalse();
    }

    [Fact]
    public void Cart_limits_the_number_of_distinct_products()
    {
        var cart = GuestCart();
        for (var id = 1; id <= Cart.MaxDistinctItems; id++) cart.Add(id, 1, 5, Now);

        Should.Throw<DomainException>(() => cart.Add(999, 1, 5, Now)).Code.ShouldBe("cart.full");
    }
}
