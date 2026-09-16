using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using PerformanceTracker.Api.Auth;
using PerformanceTracker.Api.Contracts;
using PerformanceTracker.Api.Data;

namespace PerformanceTracker.Api.Features;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app, IWebHostEnvironment env)
    {
        var g = app.MapGroup("/auth").WithTags("Auth");

        // Anonymous: lets the SPA confirm which sign-in to show.
        g.MapGet("/config", (AuthOptions opts) =>
            Results.Ok(new { mode = opts.EntraEnabled ? "entra" : "dev" }));

        // RequireAuthorization so the Bearer scheme actually runs (it isn't the default,
        // so it only fires when a policy asks for it). No token -> 401 challenge.
        g.MapGet("/me", async (CurrentUser current, AppDbContext db) =>
        {
            if (current.UserId is { } id)
            {
                var u = await db.Users.FindAsync(id);
                if (u is { IsActive: true }) return Results.Ok(u.ToMe());
            }

            // Token is valid but there's no matching (active) user in our staff list.
            // 403, not 401 — the frontend must NOT bounce back to sign-in (that loops).
            return Results.Json(
                new { message = "Your Microsoft account isn’t registered in the Performance Tracker. Ask an administrator to add you." },
                statusCode: StatusCodes.Status403Forbidden);
        }).RequireAuthorization();

        g.MapPost("/logout", async (HttpContext http) =>
        {
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        });

        if (!env.IsDevelopment()) return;

        // Dev-only: what the Bearer handler makes of whatever token you send it.
        g.MapGet("/whoami", async (HttpContext http) =>
        {
            var result = await http.AuthenticateAsync("Bearer");
            return Results.Ok(new
            {
                succeeded = result.Succeeded,
                failure = result.Failure?.Message,
                claims = result.Principal?.Claims.Select(c => new { c.Type, c.Value }).ToArray() ?? [],
            });
        });

        // Dev-only shim. Replaced by MSAL + Entra bearer tokens in production.
        g.MapGet("/dev-users", async (AppDbContext db) =>
            await db.Users
                .Include(u => u.SupervisorUser)
                .OrderBy(u => u.Role).ThenBy(u => u.FullName)
                .Select(u => u.ToUserResponse())
                .ToListAsync());

        g.MapPost("/dev-login", async (DevLoginRequest req, HttpContext http, AppDbContext db) =>
        {
            var u = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email);
            if (u is null) return Results.NotFound(new { message = $"No user with email {req.Email}" });
            if (!u.IsActive) return Results.BadRequest(new { message = "User is deactivated" });

            var claims = new List<Claim>
            {
                new(AppClaims.UserId, u.Id.ToString()),
                new(AppClaims.Role, u.Role.ToString()),
                new(ClaimTypes.Email, u.Email),
                new(ClaimTypes.Name, u.FullName)
            };
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
            return Results.Ok(u.ToMe());
        });
    }
}
