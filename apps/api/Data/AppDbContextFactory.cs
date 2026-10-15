using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace ClimbingApp.Api.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .AddEnvironmentVariables()
            .Build();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionStringFactory.Build(config))
            .Options;

        return new AppDbContext(options);
    }
}
