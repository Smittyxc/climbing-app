using System.Text.Json;
using ClimbingApp.Api.Auth;
using ClimbingApp.Api.Data;
using ClimbingApp.Api.Services;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Firebase Admin SDK verifies client ID tokens. On GCP this uses Application Default
// Credentials automatically; locally, set GOOGLE_APPLICATION_CREDENTIALS to a SA key.
try
{
    FirebaseApp.Create(new AppOptions
    {
        Credential = GoogleCredential.GetApplicationDefault(),
        ProjectId = builder.Configuration["FIREBASE_PROJECT_ID"],
    });
}
catch (Exception ex)
{
    Console.WriteLine($"[startup] Firebase Admin could not be initialised (auth will reject requests): {ex.Message}");
}

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(ConnectionStringFactory.Build(builder.Configuration)));

// Application services
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<IBoardService, BoardService>();
builder.Services.AddScoped<IRouteService, RouteService>();
builder.Services.AddSingleton<IStorageService, GcsStorageService>();
builder.Services.AddHttpClient<IDetectorClient, DetectorClient>();

// CORS: comma-separated allowlist (Vercel prod origin + localhost during dev)
var allowedOrigins = (builder.Configuration["AllowedOrigins"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Contains("*"))
        {
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        }
        else
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
        }
    }));

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);

builder.Services.AddOpenApi();

var app = builder.Build();

// Opt-in migration on startup (handy for the first deploy and local dev).
if (string.Equals(app.Configuration["RUN_MIGRATIONS"], "true", StringComparison.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (db.Database.GetMigrations().Any())
    {
        db.Database.Migrate();
    }
    else
    {
        Console.WriteLine(
            "[startup] RUN_MIGRATIONS=true but no migrations were found. Generate one with: " +
            "dotnet ef migrations add InitialCreate");
    }
}

app.UseCors();

// Translate unauthenticated/unauthorised domain errors into HTTP 401.
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (UnauthorizedAccessException)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
    }
});

app.UseMiddleware<FirebaseAuthMiddleware>();

app.MapControllers();
app.MapOpenApi();
app.MapScalarApiReference();
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

app.Run();
