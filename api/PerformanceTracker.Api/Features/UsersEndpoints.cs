using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PerformanceTracker.Api.Auth;
using PerformanceTracker.Api.Contracts;
using PerformanceTracker.Api.Data;
using PerformanceTracker.Api.Domain;
using PerformanceTracker.Api.Services;

namespace PerformanceTracker.Api.Features;

public static class UsersEndpoints
{
    public static void MapUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/users").WithTags("Users").RequireAuthorization();

        // ---- Read: Admin + HR see the whole staff list ----
        g.MapGet("/", async (AppDbContext db, CurrentUser me, string? role, string? q, bool? active) =>
        {
            if (!me.IsInRole(UserRole.Admin, UserRole.Hr)) return Results.Forbid();

            var query = db.Users.Include(u => u.SupervisorUser).AsQueryable();

            if (Enum.TryParse<UserRole>(role, true, out var r))
                query = query.Where(u => u.Role == r);
            if (active is { } a)
                query = query.Where(u => u.IsActive == a);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = $"%{q.Trim()}%";
                query = query.Where(u =>
                    EF.Functions.ILike(u.FullName, term) ||
                    EF.Functions.ILike(u.Email, term) ||
                    (u.StaffId != null && EF.Functions.ILike(u.StaffId, term)) ||
                    (u.Department != null && EF.Functions.ILike(u.Department, term)));
            }

            var list = await query
                .OrderBy(u => u.FullName)
                .Select(u => u.ToUserResponse())
                .ToListAsync();
            return Results.Ok(list);
        });

        g.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CurrentUser me) =>
        {
            if (!me.IsInRole(UserRole.Admin, UserRole.Hr)) return Results.Forbid();
            var u = await db.Users.Include(x => x.SupervisorUser).FirstOrDefaultAsync(x => x.Id == id);
            return u is null ? Results.NotFound() : Results.Ok(u.ToUserResponse());
        });

        // ---- The people a supervisor is responsible for ----
        g.MapGet("/me/supervisees", async (AppDbContext db, CurrentUser me) =>
        {
            if (!me.IsInRole(UserRole.Supervisor, UserRole.Admin, UserRole.Hr)) return Results.Forbid();
            var id = me.RequireUserId();
            var list = await db.Users
                .Include(u => u.SupervisorUser)
                .Where(u => u.SupervisorUserId == id)
                .OrderBy(u => u.FullName)
                .Select(u => u.ToUserResponse())
                .ToListAsync();
            return Results.Ok(list);
        });

        // ---- Writes: Admin only ----
        g.MapPost("/", async (
            CreateUserRequest req, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            if (!me.IsInRole(UserRole.Admin)) return Results.Forbid();

            var email = req.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
                return Results.BadRequest(new { message = "A valid email is required." });
            if (string.IsNullOrWhiteSpace(req.FullName))
                return Results.BadRequest(new { message = "Full name is required." });
            if (await db.Users.AnyAsync(u => u.Email == email))
                return Results.Conflict(new { message = $"A user with email {email} already exists." });

            // Only Staff (new recruits) get a supervisor — Supervisor/Admin/HR run the
            // app, so any supervisor fields sent for those roles are ignored.
            var isStaff = req.Role == UserRole.Staff;

            AppUser? supervisor = null;
            if (isStaff && req.SupervisorUserId is { } sid)
            {
                supervisor = await db.Users.FindAsync(sid);
                if (supervisor is null) return Results.BadRequest(new { message = "Supervisor user not found." });
            }

            var u = new AppUser
            {
                Email = email,
                FullName = req.FullName.Trim(),
                StaffId = req.StaffId?.Trim(),
                Department = req.Department?.Trim(),
                JobTitle = req.JobTitle?.Trim(),
                Role = req.Role,
                SupervisorUserId = supervisor?.Id,
                SupervisorName = isStaff ? supervisor?.FullName ?? req.SupervisorName?.Trim() : null,
                SupervisorEmail = isStaff ? supervisor?.Email ?? req.SupervisorEmail?.Trim() : null,
            };
            db.Users.Add(u);
            log.Record("user.created", "user", u.Id.ToString(), $"{u.FullName} ({u.Email}) added as {u.Role}");
            await db.SaveChangesAsync();

            var saved = await db.Users.Include(x => x.SupervisorUser).FirstAsync(x => x.Id == u.Id);
            return Results.Created($"/users/{u.Id}", saved.ToUserResponse());
        });

        g.MapDelete("/{id:guid}", async (
            Guid id, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            if (!me.IsInRole(UserRole.Admin)) return Results.Forbid();
            if (id == me.UserId) return Results.BadRequest(new { message = "You cannot delete your own account." });

            var u = await db.Users.Include(x => x.SupervisorUser).FirstOrDefaultAsync(x => x.Id == id);
            if (u is null) return Results.NotFound();

            // Snapshot the person and everything they filed into the archive, then
            // delete the live rows (FK cascade takes the reports + their activity /
            // focus rows; supervisees' SupervisorUserId and any ReviewedByUserId are
            // set null; the append-only activity log is untouched).
            var reports = await db.Reports
                .Include(r => r.StaffUser)
                .Include(r => r.ReviewedByUser)
                .Include(r => r.Activities)
                .Include(r => r.FocusAreas)
                .AsSplitQuery()
                .Where(r => r.StaffUserId == id)
                .ToListAsync();

            var snapshot = new
            {
                user = u.ToUserResponse(),
                reports = reports.Select(r => r.ToResponse()).ToList(),
            };

            db.ArchivedStaff.Add(new ArchivedStaffRecord
            {
                OriginalUserId = u.Id,
                Email = u.Email,
                FullName = u.FullName,
                StaffId = u.StaffId,
                Department = u.Department,
                JobTitle = u.JobTitle,
                Role = u.Role,
                ReportCount = reports.Count,
                ArchivedByUserId = me.UserId,
                ArchivedByEmail = me.Email ?? "system",
                SnapshotJson = JsonSerializer.Serialize(snapshot, Json.Options),
            });

            db.Users.Remove(u);
            log.Record("user.archived", "user", u.Id.ToString(),
                $"{u.FullName} ({u.Email}) archived and deleted"
                + (reports.Count > 0 ? $" with {reports.Count} report(s)" : ""));
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        g.MapPut("/{id:guid}/role", async (
            Guid id, UpdateRoleRequest req, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            if (!me.IsInRole(UserRole.Admin)) return Results.Forbid();
            if (id == me.UserId) return Results.BadRequest(new { message = "You cannot change your own role." });

            var u = await db.Users.FindAsync(id);
            if (u is null) return Results.NotFound();

            var from = u.Role;
            u.Role = req.Role;
            // Promoting out of Staff drops any supervisor link — only recruits have one.
            if (req.Role != UserRole.Staff)
            {
                u.SupervisorUserId = null;
                u.SupervisorName = null;
                u.SupervisorEmail = null;
            }
            log.Record("user.role_changed", "user", u.Id.ToString(),
                $"{u.FullName}: {from} -> {req.Role}");
            await db.SaveChangesAsync();
            return Results.Ok(u.ToUserResponse());
        });

        g.MapPut("/{id:guid}/supervisor", async (
            Guid id, AssignSupervisorRequest req, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            if (!me.IsInRole(UserRole.Admin)) return Results.Forbid();

            var u = await db.Users.FindAsync(id);
            if (u is null) return Results.NotFound();
            if (u.Role != UserRole.Staff)
                return Results.BadRequest(new { message = "Only Staff (new recruits) can be assigned a supervisor." });

            AppUser? supervisor = null;
            if (req.SupervisorUserId is { } sid)
            {
                if (sid == id) return Results.BadRequest(new { message = "A user cannot supervise themselves." });
                supervisor = await db.Users.FindAsync(sid);
                if (supervisor is null) return Results.BadRequest(new { message = "Supervisor user not found." });
            }

            u.SupervisorUserId = supervisor?.Id;
            u.SupervisorEmail = req.SupervisorEmail ?? supervisor?.Email;
            if (supervisor is not null) u.SupervisorName = supervisor.FullName;

            log.Record("user.supervisor_assigned", "user", u.Id.ToString(),
                supervisor is null ? $"{u.FullName}: supervisor cleared"
                                    : $"{u.FullName} -> supervised by {supervisor.FullName}");
            await db.SaveChangesAsync();

            var saved = await db.Users.Include(x => x.SupervisorUser).FirstAsync(x => x.Id == id);
            return Results.Ok(saved.ToUserResponse());
        });

        g.MapPut("/{id:guid}/profile", async (
            Guid id, UpdateUserProfileRequest req, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            if (!me.IsInRole(UserRole.Admin)) return Results.Forbid();
            var u = await db.Users.FindAsync(id);
            if (u is null) return Results.NotFound();

            var email = req.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
                return Results.BadRequest(new { message = "A valid email is required." });
            if (string.IsNullOrWhiteSpace(req.FullName))
                return Results.BadRequest(new { message = "Full name is required." });
            if (email != u.Email && await db.Users.AnyAsync(x => x.Email == email && x.Id != id))
                return Results.Conflict(new { message = $"Another user already has the email {email}." });

            var emailChanged = email != u.Email;
            u.Email = email;
            u.FullName = req.FullName.Trim();
            u.StaffId = req.StaffId?.Trim();
            u.Department = req.Department?.Trim();
            u.JobTitle = req.JobTitle?.Trim();
            // Supervisor fields only apply to Staff — cleared for everyone else.
            u.SupervisorName = u.Role == UserRole.Staff ? req.SupervisorName?.Trim() : null;
            u.SupervisorEmail = u.Role == UserRole.Staff ? req.SupervisorEmail?.Trim() : null;

            log.Record("user.profile_updated", "user", u.Id.ToString(),
                $"{u.FullName} staff info updated" + (emailChanged ? $" (email -> {email})" : ""));
            await db.SaveChangesAsync();
            return Results.Ok(u.ToUserResponse());
        });

        g.MapPut("/{id:guid}/active", async (
            Guid id, SetActiveRequest req, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            if (!me.IsInRole(UserRole.Admin)) return Results.Forbid();
            if (id == me.UserId) return Results.BadRequest(new { message = "You cannot deactivate your own account." });

            var u = await db.Users.FindAsync(id);
            if (u is null) return Results.NotFound();

            u.IsActive = req.IsActive;
            log.Record("user.active_changed", "user", u.Id.ToString(),
                $"{u.FullName}: {(req.IsActive ? "reactivated" : "deactivated")}");
            await db.SaveChangesAsync();
            return Results.Ok(u.ToUserResponse());
        });
    }
}
