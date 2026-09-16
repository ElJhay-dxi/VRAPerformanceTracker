using Microsoft.EntityFrameworkCore;
using PerformanceTracker.Api.Contracts;
using PerformanceTracker.Api.Data;
using PerformanceTracker.Api.Domain;
using PerformanceTracker.Api.Features;

namespace PerformanceTracker.Api.Services;

/// Every analytic the app can produce, gathered for the downloadable PDF — a superset
/// of what the on-screen Analytics page shows, since a report you hand someone should
/// stand on its own rather than send them back to the app for the rest.
public sealed record HrFullReportData(
    HrAnalyticsResponse Summary,
    IReadOnlyList<SupervisorPerformance> BySupervisor,
    IReadOnlyList<GrowthPoint> StaffGrowth,
    RolloverSummary Rollover,
    decimal? AvgTurnaroundDays,
    IReadOnlyList<StaffFullRow> AllStaff);

public sealed record SupervisorPerformance(
    string FullName, int TeamSize, int TotalReports, int AwaitingReview,
    decimal? AvgTeamScore, decimal? AvgTurnaroundDays);

/// New Staff-role accounts created per month — recruitment/onboarding volume.
public sealed record GrowthPoint(int Year, int Month, int NewStaff);

public sealed record RolloverRow(string FullName, string? Department, int Count);

/// How much work is being carried forward unfinished month to month.
public sealed record RolloverSummary(
    int RolledOverActivities, int RolledOverFocusAreas, IReadOnlyList<RolloverRow> TopByRollover);

/// One row per active Staff-role person, whether or not they have a scored report yet
/// — the full roster the on-screen top-3 / needs-attention lists only sample from.
public sealed record StaffFullRow(
    string FullName, string? Department, string? SupervisorName,
    int ReportsFiled, int Reviewed, int Declined,
    decimal? AvgOverallRating, decimal? LatestOverallRating);

public static class HrFullReport
{
    public static async Task<HrFullReportData> ComputeAsync(AppDbContext db)
    {
        var summary = await AnalyticsEndpoints.ComputeAsync(db);

        var users = await db.Users
            .Select(u => new
            {
                u.Id, u.FullName, u.Role, u.IsActive,
                u.Department, u.SupervisorUserId, u.CreatedAt,
            })
            .ToListAsync();
        var nameOf = users.ToDictionary(u => u.Id, u => u.FullName);
        var deptOf = users.ToDictionary(u => u.Id, u => u.Department);

        var reports = await db.Reports
            .Select(r => new
            {
                r.StaffUserId, r.Year, r.Month, r.Status, r.OverallRating,
                r.SubmittedAt, r.ReviewedAt, r.ReviewedByUserId,
            })
            .ToListAsync();

        // ---- turnaround: submit -> supervisor decision ----
        decimal? Turnaround(IEnumerable<(DateTimeOffset? Submitted, DateTimeOffset? Reviewed)> rows)
        {
            var days = rows
                .Where(r => r.Submitted is not null && r.Reviewed is not null)
                .Select(r => (decimal)(r.Reviewed!.Value - r.Submitted!.Value).TotalDays)
                .ToList();
            return days.Count == 0 ? null : Math.Round(days.Average(), 1);
        }
        var avgTurnaround = Turnaround(reports.Select(r => (r.SubmittedAt, r.ReviewedAt)));

        // ---- by supervisor ----
        var activeStaff = users.Where(u => u.Role == UserRole.Staff && u.IsActive).ToList();
        var bySupervisor = users
            .Where(u => u.Role == UserRole.Supervisor && u.IsActive)
            .Select(sup =>
            {
                var team = activeStaff.Where(s => s.SupervisorUserId == sup.Id).Select(s => s.Id).ToHashSet();
                var teamReports = reports.Where(r => team.Contains(r.StaffUserId)).ToList();
                var scored = teamReports
                    .Where(r => r.Status is ReportStatus.Approved or ReportStatus.Declined && r.OverallRating is not null)
                    .ToList();
                var reviewedByMe = reports.Where(r => r.ReviewedByUserId == sup.Id);
                return new SupervisorPerformance(
                    sup.FullName, team.Count, teamReports.Count,
                    teamReports.Count(r => r.Status == ReportStatus.Submitted),
                    scored.Count == 0 ? null : Math.Round(scored.Average(r => r.OverallRating!.Value), 2),
                    Turnaround(reviewedByMe.Select(r => (r.SubmittedAt, r.ReviewedAt))));
            })
            .OrderByDescending(s => s.TeamSize)
            .ThenBy(s => s.FullName)
            .ToList();

        // ---- staff growth, last 6 months ----
        var now = DateTimeOffset.UtcNow;
        var staffGrowth = new List<GrowthPoint>();
        for (var i = 5; i >= 0; i--)
        {
            var d = new DateTime(now.Year, now.Month, 1).AddMonths(-i);
            staffGrowth.Add(new GrowthPoint(d.Year, d.Month,
                users.Count(u => u.Role == UserRole.Staff && u.CreatedAt.Year == d.Year && u.CreatedAt.Month == d.Month)));
        }

        // ---- rollover: work still being carried forward ----
        var actRollover = await db.Activities.Where(x => x.RolledOver).Select(x => x.Report.StaffUserId).ToListAsync();
        var focRollover = await db.FocusAreas.Where(x => x.RolledOver).Select(x => x.Report.StaffUserId).ToListAsync();
        var topRollover = actRollover.Concat(focRollover)
            .GroupBy(id => id)
            .Select(g => new RolloverRow(nameOf.GetValueOrDefault(g.Key, "(removed)"), deptOf.GetValueOrDefault(g.Key), g.Count()))
            .OrderByDescending(r => r.Count)
            .ThenBy(r => r.FullName)
            .Take(5)
            .ToList();
        var rollover = new RolloverSummary(actRollover.Count, focRollover.Count, topRollover);

        // ---- every active staff member, scored or not ----
        var allStaff = activeStaff
            .Select(s =>
            {
                var mine = reports.Where(r => r.StaffUserId == s.Id).ToList();
                var scoredMine = mine
                    .Where(r => r.Status is ReportStatus.Approved or ReportStatus.Declined && r.OverallRating is not null)
                    .OrderBy(r => r.Year).ThenBy(r => r.Month)
                    .ToList();
                return new StaffFullRow(
                    s.FullName, s.Department,
                    s.SupervisorUserId is { } sid ? nameOf.GetValueOrDefault(sid) : null,
                    mine.Count,
                    mine.Count(r => r.Status is ReportStatus.Approved or ReportStatus.Declined),
                    mine.Count(r => r.Status == ReportStatus.Declined),
                    scoredMine.Count == 0 ? null : Math.Round(scoredMine.Average(r => r.OverallRating!.Value), 2),
                    scoredMine.Count == 0 ? null : scoredMine[^1].OverallRating);
            })
            .OrderByDescending(s => s.AvgOverallRating ?? -1)
            .ThenBy(s => s.FullName)
            .ToList();

        return new HrFullReportData(summary, bySupervisor, staffGrowth, rollover, avgTurnaround, allStaff);
    }
}
