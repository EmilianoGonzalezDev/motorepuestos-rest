using Microsoft.Extensions.Options;
using MotoRepuestos.Application.Abstractions;

namespace MotoRepuestos.Infrastructure.Demo;

internal sealed class DemoMode(IOptions<DemoOptions> options) : IDemoMode
{
    public bool IsEnabled => options.Value.Enabled;

    public bool IsProtectedAccount(string email) =>
        IsEnabled && options.Value.Accounts.Any(a => string.Equals(a.Email, email, StringComparison.OrdinalIgnoreCase));
}
