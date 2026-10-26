namespace MotoRepuestos.Application.Common;

public static class DemoErrors
{
    public static readonly Error AccountLocked = Error.Forbidden("demo.account_locked",
        "Las cuentas demo no se pueden modificar. Registrá una cuenta propia para probar esta función.");

    public static readonly Error AccountCannotBeDisabled = Error.Forbidden("demo.account_locked",
        "Las cuentas demo no se pueden deshabilitar.");
}
