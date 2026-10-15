using Npgsql;

namespace ClimbingApp.Api.Data;

public static class ConnectionStringFactory
{
    /// <summary>
    /// Builds an Npgsql connection string from configuration.
    /// Priority: explicit DATABASE_CONNECTION_STRING, then Cloud SQL unix socket
    /// (CLOUD_SQL_CONNECTION_NAME), then a localhost fallback for development.
    /// </summary>
    public static string Build(IConfiguration config)
    {
        var explicitConn = config["DATABASE_CONNECTION_STRING"];
        if (!string.IsNullOrWhiteSpace(explicitConn))
        {
            return explicitConn;
        }

        var connectionName = config["CLOUD_SQL_CONNECTION_NAME"];
        var builder = new NpgsqlConnectionStringBuilder
        {
            Database = config["CLOUD_SQL_DB"] ?? "climbing_db",
            Username = config["CLOUD_SQL_USER"] ?? "climbing_app",
            Password = config["CLOUD_SQL_PASSWORD"] ?? "",
        };

        if (string.IsNullOrWhiteSpace(connectionName))
        {
            builder.Host = config["CLOUD_SQL_HOST"] ?? "localhost";
            builder.Port = 5432;
        }
        else
        {
            builder.Host = $"/cloudsql/{connectionName}";
        }

        return builder.ConnectionString;
    }
}
