using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;

namespace PerformanceTracker.Api.Auth;

/// <summary>
/// Whether Microsoft Entra ID sign-in is wired. When true the app validates the Entra
/// ID token the SPA sends and maps it onto our users; when false it runs on the dev
/// cookie shim (<c>POST /auth/dev-login</c>) only.
/// </summary>
public record AuthOptions(bool EntraEnabled);

public static class AuthSetup
{
    /// <summary>
    /// Two authentication schemes side by side:
    ///  - Cookie (<c>pt_session</c>) — issued by the dev-login shim.
    ///  - JWT Bearer — enabled when <c>AzureAd:ClientId</c> is set. The SPA sends the
    ///    Entra **ID token** (audience = our client id), so no "Expose an API" scope is
    ///    needed on the app registration.
    /// The default authorization policy accepts either, so every <c>RequireAuthorization()</c>
    /// endpoint works whichever way the caller signed in. <see cref="EntraClaimsTransformation"/>
    /// turns a valid token into the same <c>pt_uid</c> / <c>pt_role</c> claims the cookie
    /// carries, so <see cref="CurrentUser"/> and the role checks never change.
    /// </summary>
    public static IServiceCollection AddAppAuth(this IServiceCollection services, IConfiguration config)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<CurrentUser>();

        var clientId = config["AzureAd:ClientId"];
        var tenantId = config["AzureAd:TenantId"];
        var entraEnabled = !string.IsNullOrWhiteSpace(clientId) && !string.IsNullOrWhiteSpace(tenantId);
        services.AddSingleton(new AuthOptions(entraEnabled));

        var auth = services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = "pt_session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.ExpireTimeSpan = TimeSpan.FromHours(12);
                options.SlidingExpiration = true;

                // API, not a website: answer with status codes, never redirects.
                options.Events.OnRedirectToLogin = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = ctx =>
                {
                    ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };
            });

        if (entraEnabled)
        {
            var instance = (config["AzureAd:Instance"] ?? "https://login.microsoftonline.com/").TrimEnd('/');
            auth.AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, o =>
            {
                o.Authority = $"{instance}/{tenantId}/v2.0";
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateAudience = true,
                    ValidAudiences = new[] { clientId!, $"api://{clientId}" },
                    ValidateIssuer = true,
                    ValidIssuers = new[]
                    {
                        $"{instance}/{tenantId}/v2.0",
                        $"https://sts.windows.net/{tenantId}/",
                    },
                    NameClaimType = "name",
                    RoleClaimType = AppClaims.Role,
                };
                o.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = ctx =>
                    {
                        var raw = ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "");
                        string aud = "?", iss = "?", typ = "?";
                        try
                        {
                            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(raw);
                            aud = string.Join(",", jwt.Audiences);
                            iss = jwt.Issuer;
                            typ = jwt.Header.TryGetValue("typ", out var t) ? t?.ToString() ?? "?" : "?";
                        }
                        catch { /* not a readable JWT */ }
                        Console.WriteLine($">>> ENTRA TOKEN REJECTED — typ={typ} aud={aud} iss={iss}\n>>> reason: {ctx.Exception.Message}");
                        return Task.CompletedTask;
                    },
                    OnTokenValidated = ctx =>
                    {
                        var email = ctx.Principal?.FindFirst("preferred_username")?.Value ?? "?";
                        Console.WriteLine($">>> ENTRA TOKEN OK — {email}");
                        return Task.CompletedTask;
                    },
                };
            });
            services.AddScoped<IClaimsTransformation, EntraClaimsTransformation>();
        }

        services.AddAuthorization(options =>
        {
            var schemes = entraEnabled
                ? new[] { CookieAuthenticationDefaults.AuthenticationScheme, JwtBearerDefaults.AuthenticationScheme }
                : new[] { CookieAuthenticationDefaults.AuthenticationScheme };

            options.DefaultPolicy = new AuthorizationPolicyBuilder(schemes)
                .RequireAuthenticatedUser()
                .Build();
        });

        return services;
    }
}
