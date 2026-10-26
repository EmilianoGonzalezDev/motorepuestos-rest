namespace MotoRepuestos.Domain.Settings;

/// <summary>Key/value store for small runtime settings editable from the back office.</summary>
public sealed class AppSetting
{
    private AppSetting() { }

    public AppSetting(string key, string value)
    {
        Key = key;
        Value = value;
    }

    public string Key { get; private set; } = string.Empty;
    public string Value { get; private set; } = string.Empty;

    public void SetValue(string value) => Value = value;
}

public static class AppSettingKeys
{
    public const string LowStockThreshold = "LowStockThreshold";

    /// <summary>UTC time (ISO 8601) of the last public demo data reset.</summary>
    public const string DemoLastResetAt = "DemoLastResetAt";
}
