using System.Security.Claims;
using PerformanceTracker.Api.Domain;

namespace PerformanceTracker.Api.Auth;

/// Thin read of the signed-in principal. Populated the same way whether the
/// claims came from the dev cookie or (later) an Entra bearer token.
public class CurrentUser(IHttpContextAccessor accessor)
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public Guid? UserId =>
        Guid.TryParse(Principal?.FindFirstValue(AppClaims.UserId), out var id) ? id : null;

    public string? Email =>
        Principal?.FindFirstValue(ClaimTypes.Email)
        ?? Principal?.FindFirstValue("preferred_username");

    public string? FullName => Principal?.FindFirstValue(ClaimTypes.Name);

    public UserRole? Role =>
        Enum.TryParse<UserRole>(Principal?.FindFirstValue(AppClaims.Role), out var r) ? r : null;

    public bool IsInRole(params UserRole[] roles) => Role is { } r && roles.Contains(r);

    public Guid RequireUserId() =>
        UserId ?? throw new InvalidOperationException("No authenticated user on the request.");
}
