using FirebaseAdmin.Auth;

namespace ClimbingApp.Api.Auth;

/// <summary>
/// Verifies the Firebase ID token on the Authorization header and stores the
/// resolved identity on HttpContext.Items. Does not reject requests itself;
/// controllers call <see cref="HttpContextExtensions.GetUserId"/> which throws
/// <see cref="UnauthorizedAccessException"/> when no valid identity is present.
/// </summary>
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
                context.Items[UserIdKey] = decoded.Uid;
                context.Items[EmailKey] = decoded.Email;
            }
            catch (Exception)
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
