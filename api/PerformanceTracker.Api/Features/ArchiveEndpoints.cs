using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PerformanceTracker.Api.Auth;
using PerformanceTracker.Api.Contracts;
using PerformanceTracker.Api.Data;
using PerformanceTracker.Api.Domain;
using PerformanceTracker.Api.Services;

namespace PerformanceTracker.Api.Features;

public static class ArchiveEndpoints
{
    public static void MapArchiveEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/archive").WithTags("Archive").RequireAuthorization();

        g.MapGet("/", async (
            AppDbContext db, CurrentUser me, string? q, int page = 1, int pageSize = 25) =>
        {
            if (!me.IsInRole(UserRole.Admin, UserRole.Hr)) return Results.Forbid();
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = db.ArchivedStaff.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = $"%{q.Trim()}%";
                query = query.Where(a =>
                    EF.Functions.ILike(a.FullName, term) ||
                    EF.Functions.ILike(a.Email, term) ||
                    (a.StaffId != null && EF.Functions.ILike(a.StaffId, term)) ||
                    (a.Department != null && EF.Functions.ILike(a.Department, term)));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(a => a.ArchivedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(a => new ArchivedStaffSummary(
                    a.Id, a.OriginalUserId, a.Email, a.FullName,
                    a.StaffId, a.Department, a.JobTitle, a.Role,
                    a.ReportCount, a.ArchivedAt, a.ArchivedByEmail))
                .ToListAsync();
            return Results.Ok(new Paged<ArchivedStaffSummary>(items, page, pageSize, total));
        });

        g.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CurrentUser me) =>
        {
            if (!me.IsInRole(UserRole.Admin, UserRole.Hr)) return Results.Forbid();

            var rec = await db.ArchivedStaff.FindAsync(id);
            if (rec is null) return Results.NotFound();

            using var doc = JsonDocument.Parse(rec.SnapshotJson);
            return Results.Ok(new
            {
                rec.Id,
                rec.OriginalUserId,
                rec.Email,
                rec.FullName,
                rec.StaffId,
                rec.Department,
                rec.JobTitle,
                rec.Role,
                rec.ReportCount,
                rec.ArchivedAt,
                rec.ArchivedByEmail,
                snapshot = doc.RootElement.Clone(),
            });
        });

        // Bring an archived person back with everything they filed. Admin only —
        // HR stays read-only. Blocked if their email has since been reused.
        g.MapPost("/{id:guid}/reinstate", async (
            Guid id, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            if (!me.IsInRole(UserRole.Admin)) return Results.Forbid();

            var rec = await db.ArchivedStaff.FindAsync(id);
            if (rec is null) return Results.NotFound();

            ArchiveSnapshot? snap;
            try
            {
                snap = JsonSerializer.Deserialize<ArchiveSnapshot>(rec.SnapshotJson, Json.Options);
            }
            catch (JsonException)
            {
                return Results.Problem("The archived snapshot is unreadable and cannot be reinstated.");
            }
            if (snap?.User is null)
                return Results.Problem("The archived snapshot is missing its staff record.");

            var email = snap.User.Email.Trim().ToLowerInvariant();
            if (await db.Users.AnyAsync(u => u.Email == email))
                return Results.Conflict(new
                {
                    message = $"{email} now belongs to an active user. Reinstate is blocked.",
                });

            // Reuse the original ids only if nothing has claimed them since; otherwise
            // everything gets fresh ids and the graph is re-linked internally.
            var idFree = !await db.Users.AnyAsync(u => u.Id == rec.OriginalUserId);
            var newUserId = idFree ? rec.OriginalUserId : Guid.NewGuid();

            Guid? supervisorUserId = null;
            if (snap.User.SupervisorUserId is { } sid && await db.Users.AnyAsync(u => u.Id == sid))
                supervisorUserId = sid;

            db.Users.Add(new AppUser
            {
                Id = newUserId,
                Email = email,
                FullName = snap.User.FullName,
                StaffId = snap.User.StaffId,
                Department = snap.User.Department,
                JobTitle = snap.User.JobTitle,
                SupervisorName = snap.User.SupervisorName,
                SupervisorEmail = snap.User.SupervisorEmail,
                SupervisorUserId = supervisorUserId,
                Role = snap.User.Role,
                IsActive = true,
                CreatedAt = snap.User.CreatedAt,      // preserved — StampTimestamps leaves non-default alone
                UpdatedAt = DateTimeOffset.UtcNow,
                EntraObjectId = null,                 // re-links on their next Microsoft sign-in
            });

            var reports = snap.Reports ?? [];
            foreach (var rr in reports)
            {
                Guid? reviewedBy = null;
                if (rr.ReviewedByUserId is { } rbid && await db.Users.AnyAsync(u => u.Id == rbid))
                    reviewedBy = rbid;

                var reportId = idFree ? rr.Id : Guid.NewGuid();
                db.Reports.Add(new PerformanceReport
                {
                    Id = reportId,
                    StaffUserId = newUserId,
                    Year = rr.Year,
                    Month = rr.Month,
                    Status = rr.Status,
                    KeyAchievements = rr.KeyAchievements,
                    Innovations = rr.Innovations,
                    NewSkills = rr.NewSkills,
                    KnowledgeGained = rr.KnowledgeGained,
                    ToolsLearned = rr.ToolsLearned,
                    KeyChallenges = rr.KeyChallenges,
                    SupportRequired = rr.SupportRequired,
                    StaffSignatureName = rr.StaffSignatureName,
                    StaffSignOffDate = rr.StaffSignOffDate,
                    SubmittedAt = rr.SubmittedAt,
                    QualityOfWorkRating = rr.QualityOfWorkRating,
                    QualityOfWorkComment = rr.QualityOfWorkComment,
                    ProductivityRating = rr.ProductivityRating,
                    ProductivityComment = rr.ProductivityComment,
                    InitiativeRating = rr.InitiativeRating,
                    InitiativeComment = rr.InitiativeComment,
                    TeamworkRating = rr.TeamworkRating,
                    TeamworkComment = rr.TeamworkComment,
                    ComplianceRating = rr.ComplianceRating,
                    ComplianceComment = rr.ComplianceComment,
                    OverallRating = rr.OverallRating,
                    SupervisorGeneralComments = rr.SupervisorGeneralComments,
                    SupervisorSignatureName = rr.SupervisorSignatureName,
                    SupervisorSignOffDate = rr.SupervisorSignOffDate,
                    DecisionComment = rr.DecisionComment,
                    ReviewedByUserId = reviewedBy,
                    ReviewedAt = rr.ReviewedAt,
                    CreatedAt = rr.CreatedAt,          // preserved
                    UpdatedAt = rr.UpdatedAt,          // preserved
                });

                foreach (var a in rr.Activities)
                    db.Activities.Add(new MonthlyActivity
                    {
                        Id = idFree ? a.Id : Guid.NewGuid(),
                        ReportId = reportId,
                        LineNo = a.LineNo,
                        KeyActivity = a.KeyActivity,
                        DescriptionOfWork = a.DescriptionOfWork,
                        OutputResult = a.OutputResult,
                        Status = a.Status,
                        RolledOver = a.RolledOver,
                        ReviewStatus = a.ReviewStatus,
                        ReviewComment = a.ReviewComment,
                    });

                foreach (var f in rr.FocusAreas)
                    db.FocusAreas.Add(new FocusArea
                    {
                        Id = idFree ? f.Id : Guid.NewGuid(),
                        ReportId = reportId,
                        LineNo = f.LineNo,
                        PlannedActivity = f.PlannedActivity,
                        ExpectedOutcome = f.ExpectedOutcome,
                        SupportRequired = f.SupportRequired,
                        Status = f.Status,
                        RolledOver = f.RolledOver,
                        ReviewStatus = f.ReviewStatus,
                        ReviewComment = f.ReviewComment,
                    });
            }

            db.ArchivedStaff.Remove(rec);
            log.Record("user.reinstated", "user", newUserId.ToString(),
                $"{snap.User.FullName} ({email}) reinstated from the archive"
                + (reports.Count > 0 ? $" with {reports.Count} report(s)" : ""));
            await db.SaveChangesAsync();

            var saved = await db.Users.Include(x => x.SupervisorUser).FirstAsync(x => x.Id == newUserId);
            return Results.Ok(saved.ToUserResponse());
        });
    }
}
