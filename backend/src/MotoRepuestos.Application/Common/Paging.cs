using Microsoft.EntityFrameworkCore;

namespace MotoRepuestos.Application.Common;

public sealed record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalItems)
{
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalItems / (double)PageSize);
    public bool HasPrevious => Page > 1;
    public bool HasNext => Page < TotalPages;
}

public enum SortDirection
{
    Asc,
    Desc
}

public static class Paging
{
    public const int DefaultPageSize = 10;
    public const int MaxPageSize = 100;

    public static (int Page, int PageSize) Normalize(int? page, int? pageSize, int defaultPageSize = DefaultPageSize)
    {
        var size = pageSize is null or <= 0 ? defaultPageSize : Math.Min(pageSize.Value, MaxPageSize);
        var number = page is null or <= 0 ? 1 : page.Value;
        return (number, size);
    }

    /// <summary>
    /// Runs a COUNT and fetches only the requested page. The query must already be ordered.
    /// Out-of-range pages are clamped to the last page.
    /// </summary>
    public static async Task<PagedResponse<T>> ToPagedAsync<T>(
        this IQueryable<T> query, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var total = await query.CountAsync(cancellationToken);
        var totalPages = (int)Math.Ceiling(total / (double)pageSize);
        if (totalPages > 0 && page > totalPages) page = totalPages;

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResponse<T>(items, page, pageSize, total);
    }
}
