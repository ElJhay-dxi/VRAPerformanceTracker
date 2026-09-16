namespace PerformanceTracker.Api.Auth;

/// Role names as they appear in claims and [Authorize] policies.
/// Kept in sync with <see cref="Domain.UserRole"/>.
public static class Roles
{
    public const string Admin = "Admin";
    public const string Staff = "Staff";
    public const string Supervisor = "Supervisor";
    public const string Hr = "Hr";
}
