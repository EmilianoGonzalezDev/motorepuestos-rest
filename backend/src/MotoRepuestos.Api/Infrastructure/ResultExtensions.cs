using Microsoft.AspNetCore.Mvc;
using MotoRepuestos.Application.Common;

namespace MotoRepuestos.Api.Infrastructure;

/// <summary>Maps application results to HTTP responses (RFC 9457 ProblemDetails for failures).</summary>
internal static class ResultExtensions
{
    public static ActionResult ToProblem(this ControllerBase controller, Error error)
    {
        var status = error.Type switch
        {
            ErrorType.Validation => StatusCodes.Status400BadRequest,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            _ => StatusCodes.Status500InternalServerError
        };

        ProblemDetails problem = error.ValidationErrors is { Count: > 0 } errors
            ? new ValidationProblemDetails(errors.ToDictionary(e => e.Key, e => e.Value))
            : new ProblemDetails();

        problem.Status = status;
        problem.Title = error.Message;
        problem.Type = $"https://httpstatuses.io/{status}";
        problem.Extensions["code"] = error.Code;
        problem.Extensions["traceId"] = controller.HttpContext.TraceIdentifier;

        return new ObjectResult(problem) { StatusCode = status, ContentTypes = { "application/problem+json" } };
    }

    public static ActionResult<T> ToActionResult<T>(this ControllerBase controller, Result<T> result) =>
        result.IsSuccess ? controller.Ok(result.Value) : controller.ToProblem(result.Error!);

    public static ActionResult ToNoContent(this ControllerBase controller, Result result) =>
        result.IsSuccess ? controller.NoContent() : controller.ToProblem(result.Error!);
}
