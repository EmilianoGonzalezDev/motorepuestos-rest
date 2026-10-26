using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace MotoRepuestos.IntegrationTests;

/// <summary>The fixture runs with Demo:Enabled=true, like the public deployment.</summary>
[Collection(ApiCollection.Name)]
public class DemoModeTests(ApiFixture api)
{
    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(ApiFixture.Json);

    [Fact]
    public async Task Status_lists_the_demo_accounts()
    {
        var status = await BodyAsync(await api.CreateClient().GetAsync("/api/demo"));

        status.GetProperty("enabled").GetBoolean().ShouldBeTrue();
        status.GetProperty("password").GetString().ShouldBe(ApiFixture.DemoPassword);
        status.GetProperty("accounts").EnumerateArray().Select(a => a.GetProperty("email").GetString())
            .ShouldBe(["cliente@motorepuestos.com", "admin@motorepuestos.com", "superadmin@motorepuestos.com"]);
    }

    [Fact]
    public async Task Demo_accounts_cannot_change_their_profile_or_password()
    {
        var customer = await api.LoginAsync("cliente@motorepuestos.com");

        var profile = await customer.PutAsJsonAsync("/api/account/profile", new { fullName = "Hacker", email = "hacker@example.com" });
        var password = await customer.PutAsJsonAsync("/api/account/password", new { currentPassword = ApiFixture.DemoPassword, newPassword = "Otra12345" });

        profile.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await BodyAsync(profile)).GetProperty("code").GetString().ShouldBe("demo.account_locked");
        password.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await BodyAsync(password)).GetProperty("code").GetString().ShouldBe("demo.account_locked");
    }

    [Fact]
    public async Task Demo_accounts_cannot_be_disabled()
    {
        var superAdmin = await api.LoginAsync("superadmin@motorepuestos.com");
        var users = await BodyAsync(await superAdmin.GetAsync("/api/users?search=admin@motorepuestos.com"));
        var adminId = users.GetProperty("items").EnumerateArray()
            .Single(u => u.GetProperty("email").GetString() == "admin@motorepuestos.com").GetProperty("id").GetInt32();

        var response = await superAdmin.PatchAsJsonAsync($"/api/users/{adminId}/status", new { isActive = false });

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await BodyAsync(response)).GetProperty("code").GetString().ShouldBe("demo.account_locked");
    }

    [Fact]
    public async Task Registered_users_can_still_edit_their_profile()
    {
        var customer = await api.RegisterCustomerAsync();

        var response = await customer.PutAsJsonAsync("/api/account/profile", new { fullName = "Cliente Editado", email = $"edit-{Guid.NewGuid():N}@example.com" });

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
