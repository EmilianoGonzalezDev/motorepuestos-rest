using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Domain.Settings;

namespace MotoRepuestos.Application.Features.Settings;

public sealed record SettingsDto(int LowStockThreshold);

public sealed record UpdateSettingsRequest(int LowStockThreshold);

public sealed class UpdateSettingsRequestValidator : AbstractValidator<UpdateSettingsRequest>
{
    public UpdateSettingsRequestValidator()
    {
        RuleFor(x => x.LowStockThreshold)
            .InclusiveBetween(1, 9999).WithMessage("Ingresá un valor entre 1 y 9999.");
    }
}

public sealed class SettingsService(
    IAppDbContext db,
    HybridCache cache,
    IValidator<UpdateSettingsRequest> validator)
{
    public const int DefaultLowStockThreshold = 5;
    private const string LowStockCacheKey = "settings:low-stock-threshold";

    public async Task<int> GetLowStockThresholdAsync(CancellationToken ct = default) =>
        await cache.GetOrCreateAsync(
            LowStockCacheKey,
            async token =>
            {
                var value = await db.AppSettings.AsNoTracking()
                    .Where(s => s.Key == AppSettingKeys.LowStockThreshold)
                    .Select(s => s.Value)
                    .FirstOrDefaultAsync(token);

                return int.TryParse(value, out var threshold) && threshold > 0 ? threshold : DefaultLowStockThreshold;
            },
            cancellationToken: ct);

    public async Task<SettingsDto> GetAsync(CancellationToken ct = default) =>
        new(await GetLowStockThresholdAsync(ct));

    public async Task<Result<SettingsDto>> UpdateAsync(UpdateSettingsRequest request, CancellationToken ct = default)
    {
        if (await validator.ValidateToErrorAsync(request, ct) is { } validationError)
            return validationError;

        var setting = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == AppSettingKeys.LowStockThreshold, ct);
        var value = request.LowStockThreshold.ToString(System.Globalization.CultureInfo.InvariantCulture);

        if (setting is null)
            db.AppSettings.Add(new AppSetting(AppSettingKeys.LowStockThreshold, value));
        else
            setting.SetValue(value);

        await db.SaveChangesAsync(ct);
        await InvalidateAsync(ct);
        return new SettingsDto(request.LowStockThreshold);
    }

    /// <summary>Drops cached settings (e.g. after a database restore).</summary>
    public async Task InvalidateAsync(CancellationToken ct = default) =>
        await cache.RemoveAsync(LowStockCacheKey, ct);
}
