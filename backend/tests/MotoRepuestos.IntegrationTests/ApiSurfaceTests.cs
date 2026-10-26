using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace MotoRepuestos.IntegrationTests;

[Collection(ApiCollection.Name)]
public class ApiSurfaceTests(ApiFixture api)
{
    private static JsonElement Body(HttpResponseMessage response) =>
        response.Content.ReadFromJsonAsync<JsonElement>(ApiFixture.Json).GetAwaiter().GetResult();

    [Fact]
    public async Task Health_endpoints_report_ready()
    {
        var client = api.CreateClient();

        (await client.GetAsync("/health/live")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await client.GetAsync("/health/ready")).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Catalog_search_ignores_case_and_accents()
    {
        var client = api.CreateClient();

        var result = Body(await client.GetAsync("/api/catalog/products?search=BATERIA&pageSize=50"));

        result.GetProperty("items").GetArrayLength().ShouldBeGreaterThanOrEqualTo(4);
    }

    [Fact]
    public async Task Catalog_only_exposes_sellable_products_and_non_empty_categories()
    {
        var client = api.CreateClient();

        var categories = Body(await client.GetAsync("/api/catalog/categories"));

        categories.EnumerateArray().ShouldNotBeEmpty();
        categories.EnumerateArray().ShouldAllBe(c => c.GetProperty("productCount").GetInt32() > 0);
    }

    [Fact]
    public async Task Unknown_product_returns_problem_details()
    {
        var response = await api.CreateClient().GetAsync("/api/catalog/products/99999999");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/problem+json");
        Body(response).GetProperty("code").GetString().ShouldBe("product.not_found");
    }

    [Fact]
    public async Task Protected_endpoints_require_authentication_and_the_right_role()
    {
        var anonymous = api.CreateClient();
        var customer = await api.RegisterCustomerAsync();
        var admin = await api.LoginAdminAsync();

        (await anonymous.GetAsync("/api/orders/mine")).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await customer.GetAsync("/api/dashboard")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await customer.GetAsync("/api/products")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.GetAsync("/api/dashboard")).StatusCode.ShouldBe(HttpStatusCode.OK);

        var createAdmin = await admin.PostAsJsonAsync("/api/users/admins", new { fullName = "X", email = "x@y.com", password = "Abcdef123" });
        createAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden); // only super admins
    }

    [Fact]
    public async Task Super_admin_can_create_admins_and_duplicates_are_rejected()
    {
        var superAdmin = await api.LoginAsync("superadmin@motorepuestos.com");
        var email = $"admin-{Guid.NewGuid():N}@example.com";

        var created = await superAdmin.PostAsJsonAsync("/api/users/admins", new { fullName = "Nuevo Admin", email, password = "Abcdef123" });
        created.StatusCode.ShouldBe(HttpStatusCode.Created);

        var duplicate = await superAdmin.PostAsJsonAsync("/api/users/admins", new { fullName = "Otro", email = email.ToUpperInvariant(), password = "Abcdef123" });
        duplicate.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Registration_validates_input_and_rejects_duplicate_emails()
    {
        var client = api.CreateClient();

        var weak = await client.PostAsJsonAsync("/api/auth/register", new { fullName = "A", email = "a@b.com", password = "short" });
        weak.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        Body(weak).GetProperty("errors").GetProperty("password").GetArrayLength().ShouldBeGreaterThan(0);

        var duplicate = await client.PostAsJsonAsync("/api/auth/register", new { fullName = "Demo", email = "CLIENTE@motorepuestos.com", password = "Abcdef123" });
        duplicate.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Wrong_credentials_return_401_without_revealing_which_field_failed()
    {
        var client = api.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "cliente@motorepuestos.com", password = "incorrecta1" });

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        Body(response).GetProperty("code").GetString().ShouldBe("auth.invalid_credentials");
    }

    [Fact]
    public async Task Refresh_token_rotates_and_a_reused_token_revokes_the_session()
    {
        var client = api.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { email = "juan.perez@example.com", password = ApiFixture.DemoPassword });
        var firstCookie = RefreshCookie(login);
        firstCookie.ShouldNotBeNull();

        // Rotation: using the cookie yields a new one.
        var refresh1 = await PostWithCookieAsync(client, "/api/auth/refresh", firstCookie);
        refresh1.StatusCode.ShouldBe(HttpStatusCode.OK);
        var secondCookie = RefreshCookie(refresh1);
        secondCookie.ShouldNotBe(firstCookie);

        // Replaying the old token is treated as theft: it fails and kills the whole family.
        (await PostWithCookieAsync(client, "/api/auth/refresh", firstCookie)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await PostWithCookieAsync(client, "/api/auth/refresh", secondCookie!)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Rich_text_descriptions_are_sanitized_against_xss()
    {
        var admin = await api.LoginAdminAsync();
        var category = Body(await admin.PostAsJsonAsync("/api/categories", new { name = $"Sec {Guid.NewGuid():N}"[..18] }));

        var created = await admin.PostAsJsonAsync("/api/products", new
        {
            categoryId = category.GetProperty("id").GetInt32(),
            name = "Producto XSS",
            description = "<p onclick=\"alert(1)\">Hola <script>alert(2)</script><img src=x onerror=alert(3)><strong>mundo</strong></p>",
            price = 10,
            stock = 1
        });

        created.StatusCode.ShouldBe(HttpStatusCode.Created);
        var description = Body(created).GetProperty("description").GetString()!;
        description.ShouldNotContain("script");
        description.ShouldNotContain("onclick");
        description.ShouldNotContain("onerror");
        description.ShouldContain("<strong>mundo</strong>");
    }

    [Fact]
    public async Task Image_upload_rejects_files_that_are_not_images()
    {
        var admin = await api.LoginAdminAsync();
        var category = Body(await admin.PostAsJsonAsync("/api/categories", new { name = $"Img {Guid.NewGuid():N}"[..18] }));
        var product = Body(await admin.PostAsJsonAsync("/api/products", new
        {
            categoryId = category.GetProperty("id").GetInt32(), name = "Con imagen", description = "<p>x</p>", price = 1, stock = 1
        }));
        var id = product.GetProperty("id").GetInt32();

        using var fake = new MultipartFormDataContent { { new ByteArrayContent(Encoding.UTF8.GetBytes("MZ not an image")), "file", "virus.png" } };
        (await admin.PutAsync($"/api/products/{id}/image", fake)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        byte[] png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
        var content = new ByteArrayContent(png) { Headers = { ContentType = new MediaTypeHeaderValue("image/png") } };
        using var real = new MultipartFormDataContent { { content, "file", "ok.png" } };
        var ok = await admin.PutAsync($"/api/products/{id}/image", real);

        ok.StatusCode.ShouldBe(HttpStatusCode.OK);
        var url = Body(ok).GetProperty("imageUrl").GetString()!;
        (await api.CreateClient().GetAsync(url)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Category_with_active_products_cannot_be_deactivated()
    {
        var admin = await api.LoginAdminAsync();
        var category = Body(await admin.PostAsJsonAsync("/api/categories", new { name = $"Cat {Guid.NewGuid():N}"[..18] }));
        var categoryId = category.GetProperty("id").GetInt32();
        await admin.PostAsJsonAsync("/api/products", new { categoryId, name = "P", description = "<p>x</p>", price = 1, stock = 1 });

        var response = await admin.PatchAsync($"/api/categories/{categoryId}/status", JsonContent.Create(new { isActive = false }));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Dashboard_returns_the_requested_window()
    {
        var admin = await api.LoginAdminAsync();

        var dashboard = Body(await admin.GetAsync("/api/dashboard?days=14"));

        dashboard.GetProperty("salesByDay").GetArrayLength().ShouldBe(14);
        dashboard.GetProperty("ordersByStatus").GetArrayLength().ShouldBe(4);
    }

    [Fact]
    public async Task OpenApi_document_is_published()
    {
        var response = await api.CreateClient().GetAsync("/openapi/v1.json");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        Body(response).GetProperty("paths").TryGetProperty("/api/orders", out _).ShouldBeTrue();
    }

    private static string? RefreshCookie(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.FirstOrDefault(v => v.StartsWith("mr_refresh=", StringComparison.Ordinal))?.Split(';')[0]
            : null;

    private static async Task<HttpResponseMessage> PostWithCookieAsync(HttpClient client, string url, string cookie)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("Cookie", cookie);
        return await client.SendAsync(request);
    }
}
