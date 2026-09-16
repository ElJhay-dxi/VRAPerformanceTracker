using Microsoft.EntityFrameworkCore;
using PerformanceTracker.Api.Auth;
using PerformanceTracker.Api.Contracts;
using PerformanceTracker.Api.Data;
using PerformanceTracker.Api.Domain;
using PerformanceTracker.Api.Services;

namespace PerformanceTracker.Api.Features;

public static class ReportsEndpoints
{
    private static IQueryable<PerformanceReport> WithGraph(this DbSet<PerformanceReport> set) =>
        set.Include(r => r.StaffUser)
           .Include(r => r.ReviewedByUser)
           .Include(r => r.Activities)
           .Include(r => r.FocusAreas)
           .AsSplitQuery();

    /// Staff see the supervisor's written comments on a declined report, but not the scores.
    private static bool HideScoresFor(PerformanceReport r, CurrentUser me) =>
        r.Status == ReportStatus.Declined && r.StaffUserId == me.UserId;

    public static void MapReportsEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/reports").WithTags("Reports").RequireAuthorization();

        // ---------- Staff: my own reports ----------
        // Only Staff file reports — the tool tracks new hires. Continuing workers
        // (Supervisor / Admin / HR) have no personal report space.

        g.MapGet("/mine", async (AppDbContext db, CurrentUser me) =>
        {
            if (!me.IsInRole(UserRole.Staff)) return Results.Forbid();
            var id = me.RequireUserId();
            var reports = await db.Reports.Include(r => r.StaffUser)
                .Where(r => r.StaffUserId == id)
                .OrderByDescending(r => r.Year).ThenByDescending(r => r.Month)
                .ToListAsync();
            return Results.Ok(reports.Select(r => r.ToSummary(r.Status == ReportStatus.Declined)).ToList());
        });

        g.MapGet("/mine/{year:int}/{month:int}", async (int year, int month, AppDbContext db, CurrentUser me) =>
        {
            if (!me.IsInRole(UserRole.Staff)) return Results.Forbid();
            var id = me.RequireUserId();
            var r = await db.Reports.WithGraph()
                .FirstOrDefaultAsync(x => x.StaffUserId == id && x.Year == year && x.Month == month);
            return r is null ? Results.NotFound() : Results.Ok(r.ToResponse(HideScoresFor(r, me)));
        });

        g.MapPost("/mine/{year:int}/{month:int}", async (
            int year, int month, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            if (!me.IsInRole(UserRole.Staff)) return Results.Forbid();
            if (month is < 1 or > 12) return Results.BadRequest(new { message = "Month must be 1-12." });
            if (year is < 2020 or > 2100) return Results.BadRequest(new { message = "Year out of range." });

            var id = me.RequireUserId();
            var exists = await db.Reports.AnyAsync(x => x.StaffUserId == id && x.Year == year && x.Month == month);
            if (exists) return Results.Conflict(new { message = "A report for that month already exists." });

            // Roll forward anything unfinished from the most recent earlier report.
            var prior = await db.Reports
                .Include(r => r.Activities).Include(r => r.FocusAreas).AsSplitQuery()
                .Where(r => r.StaffUserId == id && (r.Year < year || (r.Year == year && r.Month < month)))
                .OrderByDescending(r => r.Year).ThenByDescending(r => r.Month)
                .FirstOrDefaultAsync();

            var report = new PerformanceReport { StaffUserId = id, Year = year, Month = month };
            db.Reports.Add(report);

            if (prior is not null)
            {
                var line = 0;
                foreach (var a in prior.Activities
                    .Where(a => a.Status == ActivityProgress.Ongoing).OrderBy(a => a.LineNo))
                {
                    db.Activities.Add(new MonthlyActivity
                    {
                        ReportId = report.Id, LineNo = ++line, RolledOver = true,
                        KeyActivity = a.KeyActivity, DescriptionOfWork = a.DescriptionOfWork,
                        OutputResult = a.OutputResult, Status = ActivityProgress.Ongoing,
                    });
                }
                line = 0;
                foreach (var f in prior.FocusAreas
                    .Where(f => f.Status != FocusStatus.Completed).OrderBy(f => f.LineNo))
                {
                    db.FocusAreas.Add(new FocusArea
                    {
                        ReportId = report.Id, LineNo = ++line, RolledOver = true,
                        PlannedActivity = f.PlannedActivity, ExpectedOutcome = f.ExpectedOutcome,
                        SupportRequired = f.SupportRequired, Status = f.Status,
                    });
                }
            }

            log.Record("report.created", "report", report.Id.ToString(), $"Report started for {year}-{month:00}");
            await db.SaveChangesAsync();

            var saved = await db.Reports.WithGraph().FirstAsync(x => x.Id == report.Id);
            return Results.Created($"/reports/{report.Id}", saved.ToResponse());
        });

        g.MapPut("/{id:guid}", async (
            Guid id, SaveReportRequest req, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            var report = await db.Reports.WithGraph().FirstOrDefaultAsync(x => x.Id == id);
            if (report is null) return Results.NotFound();
            if (report.StaffUserId != me.UserId) return Results.Forbid();
            if (report.Status is not (ReportStatus.Draft or ReportStatus.Declined))
                return Results.BadRequest(new { message = $"A {report.Status} report can no longer be edited." });

            report.KeyAchievements = req.KeyAchievements;
            report.Innovations = req.Innovations;
            report.NewSkills = req.NewSkills;
            report.KnowledgeGained = req.KnowledgeGained;
            report.ToolsLearned = req.ToolsLearned;
            report.KeyChallenges = req.KeyChallenges;
            report.SupportRequired = req.SupportRequired;
            report.StaffSignatureName = req.StaffSignatureName?.Trim();
            report.StaffSignOffDate = req.StaffSignOffDate;

            MergeActivities(db, report, req.Activities);
            MergeFocusAreas(db, report, req.FocusAreas);

            log.Record("report.updated", "report", report.Id.ToString(), $"Report {report.Year}-{report.Month:00} saved");
            await db.SaveChangesAsync();

            var saved = await db.Reports.WithGraph().FirstAsync(x => x.Id == id);
            return Results.Ok(saved.ToResponse(HideScoresFor(saved, me)));
        });

        g.MapPost("/{id:guid}/submit", async (
            Guid id, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            var report = await db.Reports.WithGraph().FirstOrDefaultAsync(x => x.Id == id);
            if (report is null) return Results.NotFound();
            if (report.StaffUserId != me.UserId) return Results.Forbid();
            if (report.Status is not (ReportStatus.Draft or ReportStatus.Declined))
                return Results.BadRequest(new { message = $"Report is already {report.Status}." });
            if (string.IsNullOrWhiteSpace(report.StaffSignatureName))
                return Results.BadRequest(new { message = "Add your sign-off name before submitting." });

            report.Status = ReportStatus.Submitted;
            report.SubmittedAt = DateTimeOffset.UtcNow;
            report.StaffSignOffDate ??= DateOnly.FromDateTime(DateTime.UtcNow);
            // A resubmission after a decline clears the previous verdict but keeps the
            // scores (the supervisor wants to see what they gave last time). Rows the
            // supervisor had approved stay locked; declined rows go back to pending for
            // a fresh look.
            report.DecisionComment = null;
            report.ReviewedByUserId = null;
            report.ReviewedAt = null;
            foreach (var a in report.Activities.Where(a => a.ReviewStatus == ItemReviewStatus.Declined))
                a.ReviewStatus = ItemReviewStatus.Pending;
            foreach (var f in report.FocusAreas.Where(f => f.ReviewStatus == ItemReviewStatus.Declined))
                f.ReviewStatus = ItemReviewStatus.Pending;

            log.Record("report.submitted", "report", report.Id.ToString(),
                $"{report.StaffUser.FullName} submitted {report.Year}-{report.Month:00}");
            await db.SaveChangesAsync();

            var saved = await db.Reports.WithGraph().FirstAsync(x => x.Id == id);
            return Results.Ok(saved.ToResponse());
        });

        // ---------- Reports of people I supervise ----------

        g.MapGet("/assigned", async (
            AppDbContext db, CurrentUser me, string? status, int? year, int? month, string? q) =>
        {
            if (!me.IsInRole(UserRole.Supervisor, UserRole.Admin, UserRole.Hr)) return Results.Forbid();

            var uid = me.RequireUserId();
            var query = db.Reports.Include(r => r.StaffUser)
                .Where(r => r.StaffUser.SupervisorUserId == uid);

            if (Enum.TryParse<ReportStatus>(status, true, out var s))
                query = query.Where(r => r.Status == s);
            if (year is { } y) query = query.Where(r => r.Year == y);
            if (month is { } m) query = query.Where(r => r.Month == m);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = $"%{q.Trim()}%";
                query = query.Where(r =>
                    EF.Functions.ILike(r.StaffUser.FullName, term) ||
                    (r.StaffUser.StaffId != null && EF.Functions.ILike(r.StaffUser.StaffId, term)));
            }

            var list = await query
                .OrderByDescending(r => r.SubmittedAt ?? r.UpdatedAt)
                .Select(r => r.ToSummary())
                .ToListAsync();
            return Results.Ok(list);
        });

        g.MapPost("/{id:guid}/appraise", async (
            Guid id, AppraiseReportRequest req, AppDbContext db, CurrentUser me, ActivityLogger log) =>
        {
            if (!me.IsInRole(UserRole.Supervisor, UserRole.Admin)) return Results.Forbid();
            if (req.Decision is not (ReportStatus.Approved or ReportStatus.Declined))
                return Results.BadRequest(new { message = "Decision must be Approved or Declined." });

            var report = await db.Reports.WithGraph().FirstOrDefaultAsync(x => x.Id == id);
            if (report is null) return Results.NotFound();

            var isAssignedSupervisor = report.StaffUser.SupervisorUserId == me.UserId;
            if (!isAssignedSupervisor && !me.IsInRole(UserRole.Admin)) return Results.Forbid();
            if (report.Status != ReportStatus.Submitted)
                return Results.BadRequest(new { message = $"Only a Submitted report can be appraised (this one is {report.Status})." });

            foreach (var rating in new[]
            {
                req.QualityOfWorkRating, req.ProductivityRating, req.InitiativeRating,
                req.TeamworkRating, req.ComplianceRating
            })
            {
                if (rating is < 1 or > 5)
                    return Results.BadRequest(new { message = "Ratings must be between 1 and 5." });
            }

            report.QualityOfWorkRating = req.QualityOfWorkRating;
            report.QualityOfWorkComment = req.QualityOfWorkComment;
            report.ProductivityRating = req.ProductivityRating;
            report.ProductivityComment = req.ProductivityComment;
            report.InitiativeRating = req.InitiativeRating;
            report.InitiativeComment = req.InitiativeComment;
            report.TeamworkRating = req.TeamworkRating;
            report.TeamworkComment = req.TeamworkComment;
            report.ComplianceRating = req.ComplianceRating;
            report.ComplianceComment = req.ComplianceComment;
            report.SupervisorGeneralComments = req.SupervisorGeneralComments;
            report.SupervisorSignatureName = req.SupervisorSignatureName?.Trim();
            report.SupervisorSignOffDate = req.SupervisorSignOffDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
            report.OverallRating = req.OverallRating ?? AverageRating(report);
            report.DecisionComment = req.DecisionComment;
            report.Status = req.Decision;
            report.ReviewedByUserId = me.UserId;
            report.ReviewedAt = DateTimeOffset.UtcNow;

            // Per-row verdicts.
            ApplyItemReviews(report.Activities, a => a.Id, (a, st, c) => { a.ReviewStatus = st; a.ReviewComment = c; }, req.ActivityReviews);
            ApplyItemReviews(report.FocusAreas, f => f.Id, (f, st, c) => { f.ReviewStatus = st; f.ReviewComment = c; }, req.FocusReviews);

            // Approving the whole report locks every row.
            if (req.Decision == ReportStatus.Approved)
            {
                foreach (var a in report.Activities) a.ReviewStatus = ItemReviewStatus.Approved;
                foreach (var f in report.FocusAreas) f.ReviewStatus = ItemReviewStatus.Approved;
            }

            var verb = req.Decision == ReportStatus.Approved ? "approved" : "declined";
            log.Record($"report.{verb}", "report", report.Id.ToString(),
                $"{report.StaffUser.FullName} {report.Year}-{report.Month:00} {verb} by {me.FullName}");
            await db.SaveChangesAsync();

            var saved = await db.Reports.WithGraph().FirstAsync(x => x.Id == id);
            return Results.Ok(saved.ToResponse());
        });

        // ---------- Shared: one report ----------

        g.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CurrentUser me) =>
        {
            var report = await db.Reports.WithGraph().FirstOrDefaultAsync(x => x.Id == id);
            if (report is null) return Results.NotFound();

            var canView = report.StaffUserId == me.UserId
                          || report.StaffUser.SupervisorUserId == me.UserId
                          || me.IsInRole(UserRole.Admin, UserRole.Hr);
            return canView
                ? Results.Ok(report.ToResponse(HideScoresFor(report, me)))
                : Results.Forbid();
        });

        // ---------- HR / Admin: everything ----------

        g.MapGet("/", async (
            AppDbContext db, CurrentUser me,
            string? status, int? year, int? month,
            int? fromYear, int? fromMonth, int? toYear, int? toMonth,
            string? q, int page = 1, int pageSize = 25) =>
        {
            if (!me.IsInRole(UserRole.Admin, UserRole.Hr)) return Results.Forbid();
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = FilterReports(db.Reports.Include(r => r.StaffUser).AsQueryable(),
                status, year, month, fromYear, fromMonth, toYear, toMonth, q);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.Year).ThenByDescending(r => r.Month).ThenBy(r => r.StaffUser.FullName)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(r => r.ToSummary())
                .ToListAsync();
            return Results.Ok(new Paged<ReportSummaryResponse>(items, page, pageSize, total));
        });

        // Same filters as the listing above, unpaged, as a CSV download — for a
        // date-ranged headcount or a report Jeffrey can hand off outside the app.
        g.MapGet("/export", async (
            AppDbContext db, CurrentUser me,
            string? status, int? year, int? month,
            int? fromYear, int? fromMonth, int? toYear, int? toMonth,
            string? q) =>
        {
            if (!me.IsInRole(UserRole.Admin, UserRole.Hr)) return Results.Forbid();

            var query = FilterReports(db.Reports.Include(r => r.StaffUser).AsQueryable(),
                status, year, month, fromYear, fromMonth, toYear, toMonth, q);

            var rows = await query
                .OrderByDescending(r => r.Year).ThenByDescending(r => r.Month).ThenBy(r => r.StaffUser.FullName)
                .Select(r => r.ToSummary())
                .ToListAsync();

            var csv = new System.Text.StringBuilder();
            csv.AppendLine(Csv.Row("Staff name", "Email", "Staff ID", "Department", "Month", "Status",
                "Overall rating", "Submitted at", "Reviewed at", "Last updated"));
            foreach (var r in rows)
                csv.AppendLine(Csv.Row(r.StaffName, r.StaffEmail, r.StaffId, r.Department,
                    $"{r.Year}-{r.Month:00}", r.Status, r.OverallRating,
                    r.SubmittedAt, r.ReviewedAt, r.UpdatedAt));

            var name = $"vra-reports-{DateTimeOffset.UtcNow:yyyyMMdd-HHmm}.csv";
            return Results.File(Csv.Bytes(csv.ToString()), "text/csv", name);
        });
    }

    private static IQueryable<PerformanceReport> FilterReports(
        IQueryable<PerformanceReport> query,
        string? status, int? year, int? month,
        int? fromYear, int? fromMonth, int? toYear, int? toMonth,
        string? q)
    {
        if (Enum.TryParse<ReportStatus>(status, true, out var s))
            query = query.Where(r => r.Status == s);
        if (year is { } y) query = query.Where(r => r.Year == y);
        if (month is { } m) query = query.Where(r => r.Month == m);
        // Range filter, by the report's own period (Year, Month) rather than a
        // timestamp — either bound can be given alone for an open-ended range.
        if (fromYear is { } fy && fromMonth is { } fm)
        {
            var fromIdx = fy * 12 + fm;
            query = query.Where(r => r.Year * 12 + r.Month >= fromIdx);
        }
        if (toYear is { } ty && toMonth is { } tm)
        {
            var toIdx = ty * 12 + tm;
            query = query.Where(r => r.Year * 12 + r.Month <= toIdx);
        }
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = $"%{q.Trim()}%";
            query = query.Where(r =>
                EF.Functions.ILike(r.StaffUser.FullName, term) ||
                (r.StaffUser.Department != null && EF.Functions.ILike(r.StaffUser.Department, term)));
        }
        return query;
    }

    // ---- merge helpers: preserve row Ids + review state, honour per-row locks ----

    private static void MergeActivities(AppDbContext db, PerformanceReport report, List<ActivityInput> incoming)
    {
        bool Locked(MonthlyActivity a) =>
            report.Status == ReportStatus.Declined && a.ReviewStatus != ItemReviewStatus.Declined;

        var rows = incoming.Where(a => !IsBlankActivity(a)).ToList();
        var existing = report.Activities.ToList(); // snapshot before EF fixup adds new rows
        var byId = existing.ToDictionary(a => a.Id);
        var seen = new HashSet<Guid>();
        var line = 0;

        foreach (var inp in rows)
        {
            line++;
            if (inp.Id is { } gid && byId.TryGetValue(gid, out var ex))
            {
                seen.Add(gid);
                ex.LineNo = line;
                if (Locked(ex)) continue;
                ex.KeyActivity = inp.KeyActivity;
                ex.DescriptionOfWork = inp.DescriptionOfWork;
                ex.OutputResult = inp.OutputResult;
                ex.Status = inp.Status;
            }
            else
            {
                db.Activities.Add(new MonthlyActivity
                {
                    ReportId = report.Id, LineNo = line,
                    KeyActivity = inp.KeyActivity, DescriptionOfWork = inp.DescriptionOfWork,
                    OutputResult = inp.OutputResult, Status = inp.Status,
                });
            }
        }

        foreach (var ex in existing)
            if (!seen.Contains(ex.Id) && !Locked(ex))
                db.Activities.Remove(ex);
    }

    private static void MergeFocusAreas(AppDbContext db, PerformanceReport report, List<FocusAreaInput> incoming)
    {
        bool Locked(FocusArea f) =>
            report.Status == ReportStatus.Declined && f.ReviewStatus != ItemReviewStatus.Declined;

        var rows = incoming.Where(f => !IsBlankFocus(f)).ToList();
        var existing = report.FocusAreas.ToList(); // snapshot before EF fixup adds new rows
        var byId = existing.ToDictionary(f => f.Id);
        var seen = new HashSet<Guid>();
        var line = 0;

        foreach (var inp in rows)
        {
            line++;
            if (inp.Id is { } gid && byId.TryGetValue(gid, out var ex))
            {
                seen.Add(gid);
                ex.LineNo = line;
                if (Locked(ex)) continue;
                ex.PlannedActivity = inp.PlannedActivity;
                ex.ExpectedOutcome = inp.ExpectedOutcome;
                ex.SupportRequired = inp.SupportRequired;
                ex.Status = inp.Status;
            }
            else
            {
                db.FocusAreas.Add(new FocusArea
                {
                    ReportId = report.Id, LineNo = line,
                    PlannedActivity = inp.PlannedActivity, ExpectedOutcome = inp.ExpectedOutcome,
                    SupportRequired = inp.SupportRequired, Status = inp.Status,
                });
            }
        }

        foreach (var ex in existing)
            if (!seen.Contains(ex.Id) && !Locked(ex))
                db.FocusAreas.Remove(ex);
    }

    private static void ApplyItemReviews<T>(
        IEnumerable<T> rows, Func<T, Guid> keyOf,
        Action<T, ItemReviewStatus, string?> set, List<ItemReviewInput>? reviews)
    {
        if (reviews is null) return;
        var map = rows.ToDictionary(keyOf);
        foreach (var rv in reviews)
            if (map.TryGetValue(rv.Id, out var row))
                set(row, rv.Status, string.IsNullOrWhiteSpace(rv.Comment) ? null : rv.Comment.Trim());
    }

    private static bool IsBlankActivity(ActivityInput a) =>
        string.IsNullOrWhiteSpace(a.KeyActivity) && string.IsNullOrWhiteSpace(a.DescriptionOfWork)
        && string.IsNullOrWhiteSpace(a.OutputResult) && a.Status is null;

    private static bool IsBlankFocus(FocusAreaInput f) =>
        string.IsNullOrWhiteSpace(f.PlannedActivity) && string.IsNullOrWhiteSpace(f.ExpectedOutcome)
        && string.IsNullOrWhiteSpace(f.SupportRequired);

    private static decimal? AverageRating(PerformanceReport r)
    {
        var scores = new[]
        {
            r.QualityOfWorkRating, r.ProductivityRating, r.InitiativeRating,
            r.TeamworkRating, r.ComplianceRating
        }.Where(x => x is not null).Select(x => x!.Value).ToArray();
        return scores.Length == 0 ? null : Math.Round((decimal)scores.Average(), 2);
    }
}
