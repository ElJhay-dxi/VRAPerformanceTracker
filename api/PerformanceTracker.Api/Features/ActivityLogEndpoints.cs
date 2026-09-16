using Microsoft.EntityFrameworkCore;
using PerformanceTracker.Api.Auth;
using PerformanceTracker.Api.Contracts;
using PerformanceTracker.Api.Data;
using PerformanceTracker.Api.Domain;

namespace PerformanceTracker.Api.Features;

public static class ActivityLogEndpoints
{
    public static void MapActivityLogEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/activity-logs").WithTags("ActivityLog").RequireAuthorization();

        g.MapGet("/", async (
            AppDbContext db, CurrentUser me,
            string? entityType, string? q, int page = 1, int pageSize = 25) =>
        {
            if (!me.IsInRole(UserRole.Admin, UserRole.Hr)) return Results.Forbid();
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = db.ActivityLog.AsQueryable();
            if (!string.IsNullOrWhiteSpace(entityType))
                query = query.Where(e => e.EntityType == entityType);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = $"%{q.Trim()}%";
                query = query.Where(e =>
                    EF.Functions.ILike(e.Summary, term) ||
                    EF.Functions.ILike(e.Action, term) ||
                    EF.Functions.ILike(e.ActorEmail, term));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(e => e.CreatedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(e => e.ToResponse())
                .ToListAsync();
            return Results.Ok(new Paged<ActivityLogResponse>(items, page, pageSize, total));
        });
    }
}
