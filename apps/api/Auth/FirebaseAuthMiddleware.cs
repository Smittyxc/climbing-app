using ClimbingApp.Api.Services;
using FirebaseAdmin;
using FirebaseAdmin.Auth;

namespace ClimbingApp.Api.Auth;

public class FirebaseAuthMiddleware
{
    public const string UserIdKey = "firebase_uid";
    public const string EmailKey = "firebase_email";

    private readonly RequestDelegate _next;

    public FirebaseAuthMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var header = context.Request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = header["Bearer ".Length..].Trim();
            try
            {
                var decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
                var email = decoded.Claims.TryGetValue("email", out var emailClaim)
                    ? emailClaim as string
                    : null;
                context.Items[UserIdKey] = decoded.Uid;
                context.Items[EmailKey] = email;

                var users = context.RequestServices.GetRequiredService<UserService>();
                await users.GetOrCreateAsync(decoded.Uid, email, context.RequestAborted);
            }
            catch (Exception ex) when (ex is FirebaseException or OperationCanceledException)
            {
                // Invalid/expired token: leave identity unset so protected endpoints 401.
            }
        }

        await _next(context);
    }
}

public static class HttpContextExtensions
{
    public static string GetUserId(this HttpContext context)
    {
        if (context.Items[FirebaseAuthMiddleware.UserIdKey] is string uid && uid.Length > 0)
        {
            return uid;
        }
        throw new UnauthorizedAccessException("Authentication required.");
    }

    public static string? GetUserEmail(this HttpContext context)
        => context.Items[FirebaseAuthMiddleware.EmailKey] as string;
}
