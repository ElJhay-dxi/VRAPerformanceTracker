namespace PerformanceTracker.Api.Auth;

/// Claim types we own. Prefixed so they never collide with claims an Entra token
/// already carries (which has its own <c>nameidentifier</c> for the AAD subject).
public static class AppClaims
{
    /// Our <see cref="Domain.AppUser"/> primary key (a Guid).
    public const string UserId = "pt_uid";

    /// Our app-managed <see cref="Domain.UserRole"/>.
    public const string Role = "pt_role";
}
