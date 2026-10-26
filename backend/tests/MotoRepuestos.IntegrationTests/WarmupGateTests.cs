using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using MotoRepuestos.Api.Infrastructure;
using MotoRepuestos.Infrastructure.Persistence;

namespace MotoRepuestos.IntegrationTests;

/// <summary>The warm-up gate on its own (no database needed).</summary>
public class WarmupGateTests
{
    private static readonly IServiceProvider Services = new ServiceCollection().AddLogging().AddProblemDetails().BuildServiceProvider();

    private static async Task<(HttpContext Context, bool NextCalled)> SendAsync(AppReadiness readiness, string path)
    {
        var nextCalled = false;
        var gate = new WarmupGateMiddleware(_ => { nextCalled = true; return Task.CompletedTask; }, readiness);
        var context = new DefaultHttpContext { RequestServices = Services };
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();

        await gate.InvokeAsync(context);
        return (context, nextCalled);
    }

    [Fact]
    public async Task Api_requests_get_503_while_the_database_is_starting()
    {
        var (context, nextCalled) = await SendAsync(new AppReadiness(), "/api/catalog/products");

        nextCalled.ShouldBeFalse();
        context.Response.StatusCode.ShouldBe(StatusCodes.Status503ServiceUnavailable);
        context.Response.Headers.RetryAfter.ToString().ShouldBe("5");
        context.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(context.Response.Body);
        body.RootElement.GetProperty("code").GetString().ShouldBe("app.warming_up");
    }

    [Fact]
    public async Task The_spa_and_health_probes_are_served_while_warming_up()
    {
        (await SendAsync(new AppReadiness(), "/productos/12")).NextCalled.ShouldBeTrue();
        (await SendAsync(new AppReadiness(), "/health/live")).NextCalled.ShouldBeTrue();
    }

    [Fact]
    public async Task Api_requests_pass_once_ready()
    {
        var readiness = new AppReadiness();
        readiness.MarkReady();

        (await SendAsync(readiness, "/api/catalog/products")).NextCalled.ShouldBeTrue();
    }
}
