using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace MotoRepuestos.IntegrationTests;

[Collection(ApiCollection.Name)]
public class CheckoutFlowTests(ApiFixture api)
{
    private static JsonElement Body(HttpResponseMessage response) =>
        response.Content.ReadFromJsonAsync<JsonElement>(ApiFixture.Json).GetAwaiter().GetResult();

    /// <summary>Creates a fresh active product with the given stock through the admin API.</summary>
    private async Task<(int Id, int CategoryId)> CreateProductAsync(HttpClient admin, int stock, decimal price = 1000m)
    {
        var category = Body(await admin.PostAsJsonAsync("/api/categories", new { name = $"Cat {Guid.NewGuid():N}"[..20] }));
        var categoryId = category.GetProperty("id").GetInt32();

        var response = await admin.PostAsJsonAsync("/api/products", new
        {
            categoryId,
            name = $"Producto {Guid.NewGuid():N}"[..24],
            description = "<p>Descripción</p>",
            price,
            stock
        });
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        return (Body(response).GetProperty("id").GetInt32(), categoryId);
    }

    private static async Task<HttpResponseMessage> AddToCartAsync(HttpClient customer, int productId, int quantity) =>
        await customer.PostAsJsonAsync("/api/cart/items", new { productId, quantity });

    [Fact]
    public async Task Customer_can_buy_a_product_and_stock_is_decremented()
    {
        var admin = await api.LoginAdminAsync();
        var (productId, _) = await CreateProductAsync(admin, stock: 5, price: 2500m);
        var customer = await api.RegisterCustomerAsync();

        (await AddToCartAsync(customer, productId, 2)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var order = await customer.PostAsJsonAsync("/api/orders", new { paymentType = "Card", notes = "Retiro mañana" });

        order.StatusCode.ShouldBe(HttpStatusCode.Created);
        var body = Body(order);
        body.GetProperty("total").GetDecimal().ShouldBe(5000m);
        body.GetProperty("status").GetString().ShouldBe("Pending");

        var product = Body(await api.CreateClient().GetAsync($"/api/catalog/products/{productId}"));
        product.GetProperty("stock").GetInt32().ShouldBe(3);

        var cart = Body(await customer.GetAsync("/api/cart"));
        cart.GetProperty("items").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public async Task Cancelling_an_order_returns_the_stock()
    {
        var admin = await api.LoginAdminAsync();
        var (productId, _) = await CreateProductAsync(admin, stock: 4);
        var customer = await api.RegisterCustomerAsync();

        await AddToCartAsync(customer, productId, 3);
        var orderId = Body(await customer.PostAsJsonAsync("/api/orders", new { paymentType = "Store" })).GetProperty("id").GetInt32();

        var cancel = await customer.PostAsJsonAsync($"/api/orders/{orderId}/cancel", new { reason = "Cambié de idea" });

        cancel.StatusCode.ShouldBe(HttpStatusCode.OK);
        Body(cancel).GetProperty("status").GetString().ShouldBe("Cancelled");
        Body(await api.CreateClient().GetAsync($"/api/catalog/products/{productId}")).GetProperty("stock").GetInt32().ShouldBe(4);
    }

    [Fact]
    public async Task Two_customers_racing_for_the_last_unit_produce_exactly_one_order()
    {
        var admin = await api.LoginAdminAsync();
        var (productId, _) = await CreateProductAsync(admin, stock: 1);

        var customers = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => api.RegisterCustomerAsync()));
        foreach (var customer in customers)
            (await AddToCartAsync(customer, productId, 1)).StatusCode.ShouldBe(HttpStatusCode.OK);

        // Everyone checks out at the same time: rowversion + retry must let exactly one win.
        var responses = await Task.WhenAll(customers.Select(c => c.PostAsJsonAsync("/api/orders", new { paymentType = "Card" })));

        responses.Count(r => r.StatusCode == HttpStatusCode.Created).ShouldBe(1);
        responses.Where(r => r.StatusCode != HttpStatusCode.Created).ShouldAllBe(r => r.StatusCode == HttpStatusCode.Conflict);
        Body(await admin.GetAsync($"/api/products/{productId}")).GetProperty("stock").GetInt32().ShouldBe(0);
    }

    [Fact]
    public async Task Cannot_add_more_units_than_available()
    {
        var admin = await api.LoginAdminAsync();
        var (productId, _) = await CreateProductAsync(admin, stock: 2);
        var customer = await api.RegisterCustomerAsync();

        var response = await AddToCartAsync(customer, productId, 3);

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        Body(response).GetProperty("code").GetString().ShouldBe("cart.insufficient_stock");
    }

    [Fact]
    public async Task Checkout_with_an_empty_cart_is_rejected()
    {
        var customer = await api.RegisterCustomerAsync();

        var response = await customer.PostAsJsonAsync("/api/orders", new { paymentType = "Card" });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        Body(response).GetProperty("code").GetString().ShouldBe("order.empty_cart");
    }

    [Fact]
    public async Task Guest_cart_is_merged_into_the_user_cart_after_login()
    {
        var admin = await api.LoginAdminAsync();
        var (productId, _) = await CreateProductAsync(admin, stock: 10);

        var guestId = Guid.NewGuid();
        var guest = api.CreateClient();
        guest.DefaultRequestHeaders.Add("X-Cart-Id", guestId.ToString());
        (await guest.PostAsJsonAsync("/api/cart/items", new { productId, quantity = 2 })).StatusCode.ShouldBe(HttpStatusCode.OK);

        var customer = await api.RegisterCustomerAsync();
        var merged = await customer.PostAsJsonAsync("/api/cart/merge", new { guestCartId = guestId });

        merged.StatusCode.ShouldBe(HttpStatusCode.OK);
        Body(merged).GetProperty("totalQuantity").GetInt32().ShouldBe(2);

        // The guest cart no longer exists.
        Body(await guest.GetAsync("/api/cart")).GetProperty("items").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public async Task Orders_of_other_customers_are_not_visible()
    {
        var admin = await api.LoginAdminAsync();
        var (productId, _) = await CreateProductAsync(admin, stock: 5);
        var owner = await api.RegisterCustomerAsync();
        var intruder = await api.RegisterCustomerAsync();

        await AddToCartAsync(owner, productId, 1);
        var orderId = Body(await owner.PostAsJsonAsync("/api/orders", new { paymentType = "Card" })).GetProperty("id").GetInt32();

        (await intruder.GetAsync($"/api/orders/{orderId}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await intruder.PostAsJsonAsync($"/api/orders/{orderId}/cancel", new { })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await owner.GetAsync($"/api/orders/{orderId}")).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Staff_moves_orders_through_the_allowed_transitions_only()
    {
        var admin = await api.LoginAdminAsync();
        var (productId, _) = await CreateProductAsync(admin, stock: 5);
        var customer = await api.RegisterCustomerAsync();
        await AddToCartAsync(customer, productId, 1);
        var orderId = Body(await customer.PostAsJsonAsync("/api/orders", new { paymentType = "Card" })).GetProperty("id").GetInt32();

        var skip = await admin.PatchAsJsonAsync($"/api/orders/{orderId}/status", new { status = "Delivered" });
        skip.StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var prepared = await admin.PatchAsJsonAsync($"/api/orders/{orderId}/status", new { status = "Prepared", note = "Listo" });
        prepared.StatusCode.ShouldBe(HttpStatusCode.OK);
        Body(prepared).GetProperty("history").GetArrayLength().ShouldBe(2);

        var delivered = await admin.PatchAsJsonAsync($"/api/orders/{orderId}/status", new { status = "Delivered" });
        delivered.StatusCode.ShouldBe(HttpStatusCode.OK);
        Body(delivered).GetProperty("allowedNextStatuses").GetArrayLength().ShouldBe(0);

        // Customers cannot change statuses.
        (await customer.PatchAsJsonAsync($"/api/orders/{orderId}/status", new { status = "Cancelled" })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}

internal static class HttpClientExtensions
{
    public static Task<HttpResponseMessage> PatchAsJsonAsync<T>(this HttpClient client, string url, T value) =>
        client.PatchAsync(url, JsonContent.Create(value));
}
