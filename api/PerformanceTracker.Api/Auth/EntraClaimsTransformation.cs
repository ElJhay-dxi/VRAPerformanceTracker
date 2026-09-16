using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using PerformanceTracker.Api.Data;
using PerformanceTracker.Api.Domain;

namespace PerformanceTracker.Api.Auth;

/// <summary>
/// Runs after an Entra bearer token is validated. Finds our <see cref="AppUser"/> for
/// that identity (by Entra object id, then by email) and stamps the same
/// NameIdentifier / Email / Name / Role claims the dev cookie carries — so the rest of
/// the app never has to know which sign-in was used. On first sign-in it back-fills
/// <c>EntraObjectId</c>. If there's no matching user the principal is left as-is and
/// <c>GET /auth/me</c> answers 403 (authenticated with Microsoft, not registered here).
/// </summary>
public class EntraClaimsTransformation(IServiceScopeFactory scopeFactory) : IClaimsTransformation
{
    private const string MappedMarker = "pt_mapped";

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity is not ClaimsIdentity identity || !identity.IsAuthenticated)
            return principal;
        if (identity.HasClaim(c => c.Type == MappedMarker))
            return principal;

        // Only Entra tokens carry a tenant-id claim; the dev cookie never does.
        var isEntra = principal.HasClaim(c =>
            c.Type is "tid" or "http://schemas.microsoft.com/identity/claims/tenantid");
        if (!isEntra) return principal;

        var oid = principal.FindFirstValue("oid")
                  ?? principal.FindFirstValue("http://schemas.microsoft.com/identity/claims/objectidentifier");
        var email = principal.FindFirstValue("preferred_username")
                    ?? principal.FindFirstValue(ClaimTypes.Upn)
                    ?? principal.FindFirstValue(ClaimTypes.Email)
                    ?? principal.FindFirstValue("email");

        if (oid is null && email is null) return principal;

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        AppUser? user = null;
        if (oid is not null)
            user = await db.Users.FirstOrDefaultAsync(u => u.EntraObjectId == oid);
        if (user is null && email is not null)
        {
            var e = email.ToLowerInvariant();
            user = await db.Users.FirstOrDefaultAsync(u => u.Email == e);
        }

        if (user is null || !user.IsActive)
        {
            identity.AddClaim(new Claim(MappedMarker, "1"));
            return principal;
        }

        if (oid is not null && user.EntraObjectId != oid)
        {
            user.EntraObjectId = oid;
            await db.SaveChangesAsync();
        }

        identity.AddClaim(new Claim(AppClaims.UserId, user.Id.ToString()));
        identity.AddClaim(new Claim(AppClaims.Role, user.Role.ToString()));
        identity.AddClaim(new Claim(ClaimTypes.Email, user.Email));
        identity.AddClaim(new Claim(ClaimTypes.Name, user.FullName));
        identity.AddClaim(new Claim(MappedMarker, "1"));
        return principal;
    }
}
