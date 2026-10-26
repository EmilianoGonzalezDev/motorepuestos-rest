using MotoRepuestos.Domain.Catalog;
using MotoRepuestos.Domain.Common;
using MotoRepuestos.Domain.Ordering;

namespace MotoRepuestos.UnitTests.Domain;

public class OrderTests
{
    private static readonly DateTime Now = new(2026, 10, 6, 12, 0, 0, DateTimeKind.Utc);

    private static Product NewProduct(int stock = 10, decimal price = 1000m) =>
        Product.Create(categoryId: 1, "Pastillas de freno", "<p>desc</p>", price, stock);

    private static Order PlaceOrder(Product product, int quantity = 2) =>
        Order.Place(userId: 7, PaymentType.Card, notes: null, [(product, quantity)], Now);

    [Fact]
    public void Place_decrements_stock_and_computes_total_from_product_prices()
    {
        var product = NewProduct(stock: 10, price: 1500m);

        var order = PlaceOrder(product, quantity: 3);

        product.Stock.ShouldBe(7);
        order.Total.ShouldBe(4500m);
        order.Status.ShouldBe(OrderStatus.Pending);
        order.Items.ShouldHaveSingleItem().Quantity.ShouldBe(3);
        order.StatusHistory.ShouldHaveSingleItem().Status.ShouldBe(OrderStatus.Pending);
    }

    [Fact]
    public void Place_snapshots_name_and_price_so_later_edits_do_not_rewrite_history()
    {
        var product = NewProduct(price: 1000m);
        var order = PlaceOrder(product, 1);

        product.Update(1, "Otro nombre", "<p>x</p>", 9999m, 5);

        var item = order.Items.Single();
        item.ProductName.ShouldBe("Pastillas de freno");
        item.UnitPrice.ShouldBe(1000m);
    }

    [Fact]
    public void Place_fails_when_stock_is_insufficient_and_leaves_stock_untouched()
    {
        var product = NewProduct(stock: 1);

        var ex = Should.Throw<DomainException>(() => PlaceOrder(product, 2));

        ex.Code.ShouldBe("product.insufficient_stock");
        product.Stock.ShouldBe(1);
    }

    [Fact]
    public void Place_rejects_empty_orders()
    {
        Should.Throw<DomainException>(() => Order.Place(1, PaymentType.Store, null, [], Now))
            .Code.ShouldBe("order.empty");
    }

    [Fact]
    public void Place_rejects_inactive_products()
    {
        var product = NewProduct();
        product.Deactivate();

        Should.Throw<DomainException>(() => PlaceOrder(product, 1)).Code.ShouldBe("product.inactive");
    }

    [Theory]
    [InlineData(OrderStatus.Prepared)]
    [InlineData(OrderStatus.Cancelled)]
    public void Pending_orders_can_move_to_prepared_or_cancelled(OrderStatus next)
    {
        var order = PlaceOrder(NewProduct());

        var requiresRestock = order.ChangeStatus(next, changedByUserId: 1, note: null, Now.AddHours(1));

        order.Status.ShouldBe(next);
        requiresRestock.ShouldBe(next == OrderStatus.Cancelled);
        order.StatusHistory.Count.ShouldBe(2);
    }

    [Fact]
    public void Pending_orders_cannot_jump_straight_to_delivered()
    {
        var order = PlaceOrder(NewProduct());

        Should.Throw<DomainException>(() => order.ChangeStatus(OrderStatus.Delivered, 1, null, Now))
            .Code.ShouldBe("order.invalid_transition");
    }

    [Theory]
    [InlineData(OrderStatus.Delivered)]
    [InlineData(OrderStatus.Cancelled)]
    public void Final_states_do_not_allow_further_changes(OrderStatus final)
    {
        var order = PlaceOrder(NewProduct());
        order.ChangeStatus(OrderStatus.Prepared, 1, null, Now);
        order.ChangeStatus(final, 1, null, Now);

        foreach (var target in Enum.GetValues<OrderStatus>().Where(s => s != final))
            order.CanTransitionTo(target).ShouldBeFalse();
    }

    [Fact]
    public void Changing_to_the_same_status_is_rejected()
    {
        var order = PlaceOrder(NewProduct());

        Should.Throw<DomainException>(() => order.ChangeStatus(OrderStatus.Pending, 1, null, Now))
            .Code.ShouldBe("order.same_status");
    }

    [Fact]
    public void Customer_can_cancel_only_their_own_pending_order()
    {
        var order = PlaceOrder(NewProduct());

        Should.Throw<DomainException>(() => order.CancelByCustomer(userId: 99, null, Now))
            .Code.ShouldBe("order.not_owner");

        order.CancelByCustomer(userId: 7, reason: "Me equivoqué", Now);
        order.Status.ShouldBe(OrderStatus.Cancelled);
        order.StatusHistory.Last().Note.ShouldBe("Me equivoqué");
    }

    [Fact]
    public void Customer_cannot_cancel_after_the_order_was_prepared()
    {
        var order = PlaceOrder(NewProduct());
        order.ChangeStatus(OrderStatus.Prepared, 1, null, Now);

        Should.Throw<DomainException>(() => order.CancelByCustomer(7, null, Now))
            .Code.ShouldBe("order.not_cancellable");
    }
}
