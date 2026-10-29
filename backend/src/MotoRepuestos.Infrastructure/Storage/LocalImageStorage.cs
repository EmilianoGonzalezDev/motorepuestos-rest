using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MotoRepuestos.Application.Abstractions;

namespace MotoRepuestos.Infrastructure.Storage;

public sealed class ImageStorageOptions
{
    public const string SectionName = "ImageStorage";

    /// <summary>Folder for product images; relative paths are resolved against the content root.</summary>
    public string RootPath { get; set; } = "storage/images/products";

    /// <summary>Upper bound for all stored images together (0 = unlimited). Protects small disks from upload abuse.</summary>
    public int MaxTotalSizeMB { get; set; }
}

/// <summary>
/// Stores product images on the local file system (a Docker volume in production).
/// Swapping it for Azure Blob Storage / S3 only requires another <see cref="IImageStorage"/>.
/// </summary>
public sealed class LocalImageStorage : IImageStorage
{
    private readonly long _maxTotalBytes;

    public LocalImageStorage(IOptions<ImageStorageOptions> options, IHostEnvironment environment)
    {
        RootPath = Path.IsPathRooted(options.Value.RootPath)
            ? options.Value.RootPath
            : Path.GetFullPath(Path.Combine(environment.ContentRootPath, options.Value.RootPath));
        Directory.CreateDirectory(RootPath);
        _maxTotalBytes = options.Value.MaxTotalSizeMB * 1024L * 1024L;
    }

    public string RootPath { get; }

    public bool HasRoomFor(long bytes)
    {
        if (_maxTotalBytes <= 0) return true;
        var used = new DirectoryInfo(RootPath).EnumerateFiles().Sum(f => f.Length);
        return used + bytes <= _maxTotalBytes;
    }

    public async Task<string> SaveAsync(Stream content, string extension, CancellationToken cancellationToken = default)
    {
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var path = Path.Combine(RootPath, fileName);

        await using var file = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
        await content.CopyToAsync(file, cancellationToken);
        return fileName;
    }

    public void Delete(string fileName)
    {
        // Path.GetFileName prevents path traversal ("../../appsettings.json").
        var path = Path.Combine(RootPath, Path.GetFileName(fileName));
        if (File.Exists(path)) File.Delete(path);
    }
}
