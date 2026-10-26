using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MotoRepuestos.Application.Abstractions;
using MotoRepuestos.Infrastructure.Persistence;

namespace MotoRepuestos.Infrastructure.Backups;

public sealed class BackupOptions
{
    public const string SectionName = "Backups";

    /// <summary>
    /// Folder on the SQL Server machine/container where .bak files are written.
    /// Empty = the instance default backup folder (or the data folder for LocalDB).
    /// </summary>
    public string? Directory { get; set; }
}

/// <summary>
/// Native SQL Server backups (BACKUP/RESTORE DATABASE), replacing the file copy the SQLite version used.
/// Backups are COPY_ONLY so they never interfere with a DBA's regular backup chain.
/// </summary>
internal sealed class SqlServerBackupService(
    AppDbContext db,
    IOptions<BackupOptions> options,
    TimeProvider clock,
    ILogger<SqlServerBackupService> logger) : IDatabaseBackupService
{
    private const string FilePrefix = "MotoRepuestos_";

    public async Task<IReadOnlyList<BackupInfo>> ListAsync(CancellationToken cancellationToken = default)
    {
        var connection = db.Database.GetDbConnection();
        var databaseName = connection.Database;

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (30) mf.physical_device_name, bs.backup_finish_date, bs.backup_size
            FROM msdb.dbo.backupset bs
            JOIN msdb.dbo.backupmediafamily mf ON mf.media_set_id = bs.media_set_id
            WHERE bs.database_name = @db AND bs.type = 'D'
            ORDER BY bs.backup_finish_date DESC
            """;
        command.Parameters.Add(new SqlParameter("@db", databaseName));

        await db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var result = new List<BackupInfo>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var path = reader.GetString(0);
                var fileName = Path.GetFileName(path.Replace('\\', '/'));
                if (!fileName.StartsWith(FilePrefix, StringComparison.OrdinalIgnoreCase)) continue;

                result.Add(new BackupInfo(
                    fileName,
                    DateTime.SpecifyKind(reader.GetDateTime(1), DateTimeKind.Local).ToUniversalTime(),
                    Convert.ToInt64(reader.GetValue(2), System.Globalization.CultureInfo.InvariantCulture)));
            }

            return result.DistinctBy(b => b.FileName).ToList();
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    public async Task<BackupInfo> CreateAsync(CancellationToken cancellationToken = default)
    {
        var databaseName = db.Database.GetDbConnection().Database;
        var directory = await ResolveDirectoryAsync(cancellationToken);
        var fileName = $"{FilePrefix}{clock.GetUtcNow().UtcDateTime:yyyyMMdd_HHmmss}.bak";
        var path = CombineServerPath(directory, fileName);

        logger.LogInformation("Creating database backup at {Path}", path);
        await db.Database.ExecuteSqlRawAsync(
            "BACKUP DATABASE @db TO DISK = @path WITH COPY_ONLY, INIT, NAME = @name",
            [new SqlParameter("@db", databaseName), new SqlParameter("@path", path), new SqlParameter("@name", fileName)],
            cancellationToken);

        var created = (await ListAsync(cancellationToken)).FirstOrDefault(b => b.FileName == fileName);
        return created ?? new BackupInfo(fileName, clock.GetUtcNow().UtcDateTime, 0);
    }

    public async Task RestoreAsync(string fileName, CancellationToken cancellationToken = default)
    {
        // Only backups this app created (listed in msdb) can be restored; never trust a raw path.
        var known = await ListAsync(cancellationToken);
        if (!known.Any(b => b.FileName.Equals(fileName, StringComparison.OrdinalIgnoreCase)))
            throw new FileNotFoundException("No existe un backup con ese nombre.", fileName);

        var directory = await ResolveDirectoryAsync(cancellationToken);
        var path = CombineServerPath(directory, Path.GetFileName(fileName));

        var builder = new SqlConnectionStringBuilder(db.Database.GetConnectionString());
        var databaseName = builder.InitialCatalog;
        builder.InitialCatalog = "master";
        builder.Pooling = false;

        logger.LogWarning("Restoring database {Database} from {Path}", databaseName, path);
        SqlConnection.ClearAllPools();

        await using var connection = new SqlConnection(builder.ConnectionString);
        await connection.OpenAsync(cancellationToken);

        var quoted = QuoteName(databaseName);
        await using var command = connection.CreateCommand();
        command.CommandTimeout = 300;
        command.CommandText = $"""
            ALTER DATABASE {quoted} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
            BEGIN TRY
                RESTORE DATABASE {quoted} FROM DISK = @path WITH REPLACE;
                ALTER DATABASE {quoted} SET MULTI_USER;
            END TRY
            BEGIN CATCH
                ALTER DATABASE {quoted} SET MULTI_USER;
                THROW;
            END CATCH
            """;
        command.Parameters.Add(new SqlParameter("@path", SqlDbType.NVarChar, 4000) { Value = path });
        await command.ExecuteNonQueryAsync(cancellationToken);

        SqlConnection.ClearAllPools();
    }

    private async Task<string> ResolveDirectoryAsync(CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(options.Value.Directory)) return options.Value.Directory!;

        var defaultPath = await db.Database
            .SqlQueryRaw<string>("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000)) AS [Value]")
            .FirstOrDefaultAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(defaultPath)) return defaultPath;

        // LocalDB has no default backup folder: use the folder of the database data file.
        var dataFile = await db.Database
            .SqlQueryRaw<string>("SELECT TOP (1) physical_name AS [Value] FROM sys.database_files WHERE type = 0")
            .FirstAsync(cancellationToken);
        return dataFile[..(dataFile.LastIndexOfAny(['\\', '/']))];
    }

    /// <summary>Joins using the separator of the SQL Server host (Linux container vs Windows).</summary>
    private static string CombineServerPath(string directory, string fileName)
    {
        var separator = directory.Contains('/') && !directory.Contains('\\') ? '/' : '\\';
        return directory.TrimEnd('/', '\\') + separator + fileName;
    }

    private static string QuoteName(string name) => $"[{name.Replace("]", "]]")}]";
}
