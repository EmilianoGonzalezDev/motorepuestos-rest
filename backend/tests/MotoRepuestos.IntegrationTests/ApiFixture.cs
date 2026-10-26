using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Testcontainers.MsSql;

namespace MotoRepuestos.IntegrationTests;

/// <summary>
/// Boots the real API (WebApplicationFactory) against a throw-away SQL Server container, so the
/// tests exercise migrations, rowversion concurrency, SQL translation and the whole HTTP pipeline.
/// One instance is shared by every test class (collection fixture).
/// Set TEST_SQL_CONNECTION to reuse an existing server instead of starting a container.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    private MsSqlContainer? _container;
    private WebApplicationFactory<Program>? _factory;
    private string? _storagePath;

    public const string DemoPassword = "Demo1234!";

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public WebApplicationFactory<Program> Factory => _factory ?? throw new InvalidOperationException("Fixture not initialized.");

    public async ValueTask InitializeAsync()
    {
        var connectionString = Environment.GetEnvironmentVariable("TEST_SQL_CONNECTION");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            _container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();
            await _container.StartAsync();
            connectionString = _container.GetConnectionString();
        }

        _storagePath = Path.Combine(Path.GetTempPath(), "motorepuestos-tests-" + Guid.NewGuid().ToString("N"));

        // Environment variables are read by WebApplication.CreateBuilder before Program.cs runs, so they
        // reach every consumer (a ConfigureAppConfiguration override would arrive too late for some).
        var settings = new Dictionary<string, string>
        {
            ["ConnectionStrings__Default"] = connectionString,
            ["Jwt__SigningKey"] = "integration-tests-signing-key-0123456789abcdef",
            ["Auth__SecureCookies"] = "false",
            // Every request comes from one IP and tests sign in constantly.
            ["RateLimiting__GlobalPermitPerMinute"] = "100000",
            ["RateLimiting__AuthPermitPerMinute"] = "100000",
            ["RateLimiting__WritesPermitPerMinute"] = "100000",
            ["RateLimiting__DemoResetPermitPerMinute"] = "100000",
            ["ImageStorage__RootPath"] = _storagePath,
            ["Seed__Enabled"] = "true",
            ["Seed__DemoOrders"] = "false",
            ["Seed__ImagesPath"] = Path.Combine(AppContext.BaseDirectory, "SeedData", "images")
        };
        foreach (var (key, value) in settings) Environment.SetEnvironmentVariable(key, value);

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

        // Forces host start-up: migrations + seed.
        _ = _factory.CreateClient();
    }

    /// <summary>Cookie handling is off so tests control the refresh cookie explicitly.</summary>
    public HttpClient CreateClient() => Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    /// <summary>Client authenticated as one of the seeded demo accounts.</summary>
    public async Task<HttpClient> LoginAsync(string email)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = DemoPassword });
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.GetProperty("accessToken").GetString());
        return client;
    }

    public Task<HttpClient> LoginAdminAsync() => LoginAsync("admin@motorepuestos.com");

    /// <summary>Registers a brand-new customer so each test works with its own cart and orders.</summary>
    public async Task<HttpClient> RegisterCustomerAsync()
    {
        var client = CreateClient();
        var email = $"test-{Guid.NewGuid():N}@example.com";
        var response = await client.PostAsJsonAsync("/api/auth/register", new { fullName = "Cliente Test", email, password = DemoPassword });
        response.EnsureSuccessStatusCode();
        var auth = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.GetProperty("accessToken").GetString());
        return client;
    }

    public async ValueTask DisposeAsync()
    {
        if (_factory is not null) await _factory.DisposeAsync();
        if (_container is not null) await _container.DisposeAsync();
        if (_storagePath is not null && Directory.Exists(_storagePath))
        {
            try { Directory.Delete(_storagePath, recursive: true); } catch (IOException) { /* best effort */ }
        }
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}
