using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MotoRepuestos.Domain.Common;

namespace MotoRepuestos.Api.Infrastructure;

/// <summary>
/// Last line of defense: converts unhandled exceptions into ProblemDetails. Domain rule violations
/// become 409/422, concurrency conflicts 409, and anything else a generic 500 without internals.
/// </summary>
internal sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title, code) = exception switch
        {
            DomainException domain => (StatusCodes.Status409Conflict, domain.Message, domain.Code),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict,
                "Los datos fueron modificados por otra operación. Intentá nuevamente.", "concurrency_conflict"),
            DbUpdateException { InnerException: SqlException { Number: 2601 or 2627 } } => (StatusCodes.Status409Conflict,
                "Ya existe un registro con esos datos.", "duplicate_key"),
            BadHttpRequestException bad => (bad.StatusCode, "La solicitud es inválida.", "bad_request"),
            OperationCanceledException when httpContext.RequestAborted.IsCancellationRequested => (499, "Solicitud cancelada.", "cancelled"),
            _ => (StatusCodes.Status500InternalServerError, "Ocurrió un error inesperado. Intentá nuevamente más tarde.", "unexpected_error")
        };

        if (status >= 500)
            logger.LogError(exception, "Unhandled exception processing {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        else
            logger.LogInformation("Request rejected ({Code}): {Message}", code, exception.Message);

        httpContext.Response.StatusCode = status;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = title,
                Type = $"https://httpstatuses.io/{status}",
                Extensions = { ["code"] = code }
            }
        });
    }
}
