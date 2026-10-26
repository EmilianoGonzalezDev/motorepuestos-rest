using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Infrastructure.Auth;
using MotoRepuestos.Infrastructure.BackgroundJobs;
using MotoRepuestos.Infrastructure.Demo;
using MotoRepuestos.Infrastructure.Persistence;
using MotoRepuestos.Infrastructure.Persistence.Seed;
using MotoRepuestos.Infrastructure.Security;
using MotoRepuestos.Infrastructure.Storage;

namespace MotoRepuestos.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' is not configured.");

        services.AddSingleton<AuditableEntityInterceptor>();
        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            options.UseSqlServer(connectionString, sql =>
            {
                sql.EnableRetryOnFailure(maxRetryCount: 5);
                // Projections with several collections (order items + history) are cheaper as split queries.
                sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
                sql.MigrationsHistoryTable("__EFMigrationsHistory");
            });
            options.AddInterceptors(sp.GetRequiredService<AuditableEntityInterceptor>());
        });
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.AddHybridCache();

        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .Validate(o => o.SigningKey.Length >= 32, "Jwt:SigningKey must have at least 32 characters.")
            .ValidateOnStart();
        services.AddOptions<ImageStorageOptions>().Bind(configuration.GetSection(ImageStorageOptions.SectionName));
        services.AddOptions<SeedOptions>().Bind(configuration.GetSection(SeedOptions.SectionName));
        services.AddOptions<DatabaseOptions>().Bind(configuration.GetSection(DatabaseOptions.SectionName));
        services.AddOptions<DemoOptions>()
            .Bind(configuration.GetSection(DemoOptions.SectionName))
            .Validate(o => !o.Enabled || o.Accounts.Count > 0, "Demo:Accounts must list at least one account when demo mode is enabled.")
            .Validate(o => o.ResetIntervalHours >= 1 && o.CheckIntervalMinutes >= 1, "Demo reset intervals must be positive.")
            .ValidateOnStart();

        services.AddSingleton<ITokenService, JwtTokenService>();
        services.AddSingleton<IPasswordHasher, PasswordHasherAdapter>();
        services.AddSingleton<IRichTextSanitizer, RichTextSanitizer>();
        services.AddSingleton<IDemoMode, DemoMode>();
        services.AddSingleton<LocalImageStorage>();
        services.AddSingleton<IImageStorage>(sp => sp.GetRequiredService<LocalImageStorage>());
        services.AddScoped<DataSeeder>();

        services.AddHostedService<GuestCartCleanupService>();
        return services;
    }
}
