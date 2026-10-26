namespace MotoRepuestos.Application.Common;

/// <summary>
/// The store operates in Argentina: dates typed by admins (filters, reports) are local dates.
/// Everything is persisted in UTC.
/// </summary>
public static class StoreTime
{
    public static readonly TimeZoneInfo TimeZone = ResolveTimeZone();

    public static DateTime ToUtcStart(DateOnly localDate) =>
        TimeZoneInfo.ConvertTimeToUtc(localDate.ToDateTime(TimeOnly.MinValue), TimeZone);

    public static DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZone);

    public static DateOnly Today(TimeProvider clock) => DateOnly.FromDateTime(ToLocal(clock.GetUtcNow().UtcDateTime));

    private static TimeZoneInfo ResolveTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            // Minimal container images may ship without tzdata; Argentina has no DST, so a fixed offset is exact.
            return TimeZoneInfo.CreateCustomTimeZone("ART", TimeSpan.FromHours(-3), "Argentina", "Argentina");
        }
    }
}
