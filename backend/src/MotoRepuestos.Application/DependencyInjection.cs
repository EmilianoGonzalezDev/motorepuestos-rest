using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using MotoRepuestos.Application.Features.Account;
using MotoRepuestos.Application.Features.Auth;
using MotoRepuestos.Application.Features.Carts;
using MotoRepuestos.Application.Features.Catalog;
using MotoRepuestos.Application.Features.Categories;
using MotoRepuestos.Application.Features.Dashboard;
using MotoRepuestos.Application.Features.Favorites;
using MotoRepuestos.Application.Features.Orders;
using MotoRepuestos.Application.Features.Products;
using MotoRepuestos.Application.Features.Settings;
using MotoRepuestos.Application.Features.Users;

namespace MotoRepuestos.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly, includeInternalTypes: true);

        services.AddScoped<AuthService>();
        services.AddScoped<AccountService>();
        services.AddScoped<UserAdminService>();
        services.AddScoped<SettingsService>();
        services.AddScoped<CatalogService>();
        services.AddScoped<CategoryService>();
        services.AddScoped<ProductService>();
        services.AddScoped<CartService>();
        services.AddScoped<OrderService>();
        services.AddScoped<FavoriteService>();
        services.AddScoped<DashboardService>();

        services.AddSingleton(TimeProvider.System);
        return services;
    }
}
