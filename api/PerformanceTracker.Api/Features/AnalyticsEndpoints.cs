using Microsoft.EntityFrameworkCore;
using PerformanceTracker.Api.Auth;
using PerformanceTracker.Api.Contracts;
using PerformanceTracker.Api.Data;
using PerformanceTracker.Api.Domain;
using PerformanceTracker.Api.Services;

namespace PerformanceTracker.Api.Features;

public static class AnalyticsEndpoints
{
    public static void MapAnalyticsEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/analytics").WithTags("Analytics").RequireAuthorization();

        // One aggregate that powers the HR overview cards and the Analytics page.
        g.MapGet("/hr", async (AppDbContext db, CurrentUser me) =>
        {
            if (!me.IsInRole(UserRole.Admin, UserRole.Hr)) return Results.Forbid();
            return Results.Ok(await ComputeAsync(db));
        });

        // The full report — every analytic the app can produce — as a PDF download.
        g.MapGet("/hr/export", async (AppDbContext db, CurrentUser me) =>
        {
            if (!me.IsInRole(UserRole.Admin, UserRole.Hr)) return Results.Forbid();
            var data = await HrFullReport.ComputeAsync(db);
            var stamp = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmm");
            return Results.File(AnalyticsExports.ToPdf(data), "application/pdf", $"vra-hr-analytics-{stamp}.pdf");
        });
    }

    /// Used by both `/hr` (the JSON the UI reads) and the full PDF report, so the two
    /// can never disagree on the numbers they share.
    internal static async Task<HrAnalyticsResponse> ComputeAsync(AppDbContext db)
    {
        var now = DateTimeOffset.UtcNow;
        var cutoff = now.AddDays(-30);

        var users = await db.Users
            .Select(u => new
            {
                u.Id, u.FullName, u.Role, u.IsActive,
                u.Department, u.SupervisorUserId, u.CreatedAt,
            })
            .ToListAsync();

        var reports = await db.Reports
            .Select(r => new
            {
                r.StaffUserId, r.Year, r.Month, r.Status, r.OverallRating,
                r.QualityOfWorkRating, r.ProductivityRating, r.InitiativeRating,
                r.TeamworkRating, r.ComplianceRating,
            })
            .ToListAsync();

        var archivedCount = await db.ArchivedStaff.CountAsync();

        // ---- staff counts ----
        var staff = users.Where(u => u.Role == UserRole.Staff).ToList();
        var activeStaff = staff.Where(u => u.IsActive).ToList();
        var deptOf = users.ToDictionary(u => u.Id, u => u.Department);
        var nameOf = users.ToDictionary(u => u.Id, u => u.FullName);

        var departments = activeStaff
            .Select(u => u.Department)
            .Where(d => !string.IsNullOrWhiteSpace(d))
            .Select(d => d!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(d => d, StringComparer.OrdinalIgnoreCase)
            .ToList();

        // ---- report pipeline ----
        int Count(ReportStatus s) => reports.Count(r => r.Status == s);
        var thisMonth = reports.Where(r => r.Year == now.Year && r.Month == now.Month).ToList();

        // ---- scored reports (a decision was made and an overall score exists) ----
        var scored = reports
            .Where(r => r.Status is ReportStatus.Approved or ReportStatus.Declined && r.OverallRating is not null)
            .ToList();

        decimal? Avg(IEnumerable<decimal> xs)
        {
            var a = xs.ToList();
            return a.Count == 0 ? null : Math.Round(a.Average(), 2);
        }
        decimal? AvgInt(IEnumerable<int?> xs) => Avg(xs.Where(x => x is not null).Select(x => (decimal)x!.Value));

        var reviewed = reports.Count(r => r.Status is ReportStatus.Approved or ReportStatus.Declined);
        var approvalRate = reviewed == 0
            ? (decimal?)null
            : Math.Round(100m * Count(ReportStatus.Approved) / reviewed, 1);

        // ---- by department ----
        var byDept = departments.Select(d =>
        {
            var members = activeStaff
                .Where(u => string.Equals(u.Department?.Trim(), d, StringComparison.OrdinalIgnoreCase))
                .Select(u => u.Id)
                .ToHashSet();
            var deptReports = scored.Where(r => members.Contains(r.StaffUserId)).ToList();
            var allDeptReports = reports.Count(r => members.Contains(r.StaffUserId));
            return new DepartmentPerformance(
                d, members.Count, allDeptReports,
                Avg(deptReports.Select(r => r.OverallRating!.Value)));
        }).ToList();

        // ---- 6-month trend (by month under review, oldest first) ----
        var trend = new List<MonthlyTrendPoint>();
        for (var i = 5; i >= 0; i--)
        {
            var d = new DateTime(now.Year, now.Month, 1).AddMonths(-i);
            var monthReports = reports.Where(r => r.Year == d.Year && r.Month == d.Month).ToList();
            var monthScored = scored.Where(r => r.Year == d.Year && r.Month == d.Month).ToList();
            trend.Add(new MonthlyTrendPoint(
                d.Year, d.Month,
                monthReports.Count,
                monthReports.Count(r => r.Status == ReportStatus.Approved),
                Avg(monthScored.Select(r => r.OverallRating!.Value))));
        }

        // ---- per-staff standings ----
        var standings = scored
            .GroupBy(r => r.StaffUserId)
            .Select(grp =>
            {
                var ordered = grp.OrderBy(r => r.Year).ThenBy(r => r.Month).ToList();
                return new StaffPerformance(
                    grp.Key,
                    nameOf.GetValueOrDefault(grp.Key, "(removed)"),
                    deptOf.GetValueOrDefault(grp.Key),
                    ordered.Count,
                    ordered.Count(r => r.Status == ReportStatus.Declined),
                    Avg(ordered.Select(r => r.OverallRating!.Value)),
                    ordered[^1].OverallRating);
            })
            .ToList();

        var topPerformers = standings
            .OrderByDescending(s => s.AvgOverallRating)
            .ThenBy(s => s.FullName)
            .Take(3)
            .ToList();

        var needsAttention = standings
            .Where(s => s.DeclinedReports > 0 || s.AvgOverallRating < 3m)
            .OrderBy(s => s.AvgOverallRating)
            .ThenByDescending(s => s.DeclinedReports)
            .Take(3)
            .ToList();

        return new HrAnalyticsResponse(
            ActiveStaff: activeStaff.Count,
            NewStaffLast30Days: staff.Count(u => u.CreatedAt >= cutoff),
            StaffWithoutSupervisor: activeStaff.Count(u => u.SupervisorUserId is null),
            Supervisors: users.Count(u => u.Role == UserRole.Supervisor && u.IsActive),
            Departments: departments.Count,
            ArchivedStaff: archivedCount,
            TotalReports: reports.Count,
            DraftReports: Count(ReportStatus.Draft),
            AwaitingReview: Count(ReportStatus.Submitted),
            ApprovedReports: Count(ReportStatus.Approved),
            DeclinedReports: Count(ReportStatus.Declined),
            ReportsThisMonth: thisMonth.Count,
            SubmittedThisMonth: thisMonth.Count(r => r.Status != ReportStatus.Draft),
            AvgOverallRating: Avg(scored.Select(r => r.OverallRating!.Value)),
            ApprovalRate: approvalRate,
            Parameters: new ParameterAverages(
                AvgInt(scored.Select(r => r.QualityOfWorkRating)),
                AvgInt(scored.Select(r => r.ProductivityRating)),
                AvgInt(scored.Select(r => r.InitiativeRating)),
                AvgInt(scored.Select(r => r.TeamworkRating)),
                AvgInt(scored.Select(r => r.ComplianceRating))),
            ByDepartment: byDept,
            Trend: trend,
            TopPerformers: topPerformers,
            NeedsAttention: needsAttention);
    }
}
