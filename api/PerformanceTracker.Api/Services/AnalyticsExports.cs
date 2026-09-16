using MigraDoc.DocumentObjectModel;
using MigraDoc.DocumentObjectModel.Tables;
using MigraDoc.Rendering;
using PerformanceTracker.Api.Contracts;

namespace PerformanceTracker.Api.Services;

/// <summary>
/// Renders the full HR report (<see cref="HrFullReportData"/>) as a PDF — the one
/// download format the app offers, deliberately: a single well-formatted document
/// beats a menu of half-equivalent exports.
/// </summary>
public static class AnalyticsExports
{
    private const string Title = "VRA Performance Tracker — HR Analytics";

    private static (string Label, object? Value)[] SummaryRows(HrAnalyticsResponse a) =>
    [
        ("Active staff", a.ActiveStaff),
        ("New staff (last 30 days)", a.NewStaffLast30Days),
        ("Staff without a supervisor", a.StaffWithoutSupervisor),
        ("Supervisors", a.Supervisors),
        ("Departments", a.Departments),
        ("Archived staff", a.ArchivedStaff),
        ("Total reports", a.TotalReports),
        ("Reports this month", a.ReportsThisMonth),
        ("Submitted this month", a.SubmittedThisMonth),
        ("Average overall score", a.AvgOverallRating),
        ("Approval rate (%)", a.ApprovalRate),
        ("Avg quality of work", a.Parameters.QualityOfWork),
        ("Avg productivity", a.Parameters.Productivity),
        ("Avg initiative", a.Parameters.Initiative),
        ("Avg teamwork", a.Parameters.Teamwork),
        ("Avg compliance", a.Parameters.Compliance),
    ];

    public static byte[] ToPdf(HrFullReportData data)
    {
        var a = data.Summary;

        var doc = new Document();
        doc.Info.Title = Title;
        var normal = doc.Styles["Normal"];
        normal!.Font.Name = PdfFontResolver.FamilyName;
        normal.Font.Size = 9;

        var section = doc.AddSection();
        section.PageSetup.PageFormat = PageFormat.A4;
        section.PageSetup.TopMargin = Unit.FromCentimeter(1.8);
        section.PageSetup.BottomMargin = Unit.FromCentimeter(1.8);
        section.PageSetup.LeftMargin = Unit.FromCentimeter(1.8);
        section.PageSetup.RightMargin = Unit.FromCentimeter(1.8);

        var titlePara = section.AddParagraph(Title);
        titlePara.Format.Font.Size = 16;
        titlePara.Format.Font.Bold = true;
        titlePara.Format.SpaceAfter = Unit.FromCentimeter(0.1);

        var meta = section.AddParagraph($"Generated {DateTimeOffset.UtcNow:dd MMM yyyy HH:mm} UTC — full report");
        meta.Format.Font.Size = 8;
        meta.Format.Font.Color = Colors.Gray;
        meta.Format.SpaceAfter = Unit.FromCentimeter(0.6);

        void Heading(string text)
        {
            var h = section.AddParagraph(text);
            h.Format.Font.Size = 12;
            h.Format.Font.Bold = true;
            h.Format.SpaceBefore = Unit.FromCentimeter(0.5);
            h.Format.SpaceAfter = Unit.FromCentimeter(0.2);
        }

        void SubText(string text)
        {
            var p = section.AddParagraph(text);
            p.Format.Font.Size = 8.5;
            p.Format.Font.Color = Colors.DimGray;
            p.Format.SpaceAfter = Unit.FromCentimeter(0.2);
        }

        Table NewTable(params double[] widthsCm)
        {
            var table = section.AddTable();
            table.Borders.Width = 0.4;
            table.Borders.Color = Colors.LightGray;
            table.Rows.LeftIndent = 0;
            foreach (var w in widthsCm) table.AddColumn(Unit.FromCentimeter(w));
            return table;
        }

        void HeaderRow(Table table, params string[] cells)
        {
            var row = table.AddRow();
            row.Shading.Color = new Color(230, 236, 245);
            row.Format.Font.Bold = true;
            for (var i = 0; i < cells.Length; i++) row.Cells[i].AddParagraph(cells[i]);
        }

        void DataRow(Table table, params object?[] cells)
        {
            var row = table.AddRow();
            for (var i = 0; i < cells.Length; i++)
                row.Cells[i].AddParagraph(cells[i]?.ToString() ?? "—");
        }

        static string Pct(int n, int total) => total == 0 ? "—" : $"{Math.Round(100m * n / total, 1)}%";

        // ---- Summary ----
        Heading("Summary");
        var summary = NewTable(8.5, 3.5);
        foreach (var (label, value) in SummaryRows(a))
            DataRow(summary, label, value);

        // ---- Report status breakdown ----
        Heading("Report status breakdown");
        var status = NewTable(5, 4, 4);
        HeaderRow(status, "Status", "Count", "% of total");
        DataRow(status, "Draft", a.DraftReports, Pct(a.DraftReports, a.TotalReports));
        DataRow(status, "Submitted (awaiting review)", a.AwaitingReview, Pct(a.AwaitingReview, a.TotalReports));
        DataRow(status, "Approved", a.ApprovedReports, Pct(a.ApprovedReports, a.TotalReports));
        DataRow(status, "Declined", a.DeclinedReports, Pct(a.DeclinedReports, a.TotalReports));
        if (data.AvgTurnaroundDays is { } td)
            SubText($"Average time from submission to supervisor decision, across every reviewed report: {td} days.");

        // ---- By department ----
        if (a.ByDepartment.Count > 0)
        {
            Heading("By department");
            var dept = NewTable(6, 3, 3, 3);
            HeaderRow(dept, "Department", "Staff", "Reports", "Avg score");
            foreach (var d in a.ByDepartment)
                DataRow(dept, d.Department, d.StaffCount, d.ReportCount, d.AvgOverallRating);
        }

        // ---- By supervisor ----
        if (data.BySupervisor.Count > 0)
        {
            Heading("By supervisor");
            var sup = NewTable(4.5, 2, 2.3, 2.6, 2.3, 2.6);
            HeaderRow(sup, "Supervisor", "Team", "Reports", "Awaiting review", "Avg score", "Avg turnaround (days)");
            foreach (var s in data.BySupervisor)
                DataRow(sup, s.FullName, s.TeamSize, s.TotalReports, s.AwaitingReview, s.AvgTeamScore, s.AvgTurnaroundDays);
        }

        // ---- 6-month score trend ----
        Heading("Overall score — last 6 months");
        var trend = NewTable(4, 3.5, 3.5, 3.5);
        HeaderRow(trend, "Month", "Reports", "Approved", "Avg score");
        foreach (var t in a.Trend)
            DataRow(trend, $"{t.Year}-{t.Month:00}", t.ReportCount, t.ApprovedCount, t.AvgOverallRating);

        // ---- staff growth ----
        Heading("New staff — last 6 months");
        var growth = NewTable(5, 5);
        HeaderRow(growth, "Month", "New staff added");
        foreach (var g in data.StaffGrowth)
            DataRow(growth, $"{g.Year}-{g.Month:00}", g.NewStaff);

        // ---- rollover / unfinished work ----
        Heading("Unfinished work carried forward");
        SubText($"{data.Rollover.RolledOverActivities} key activit{(data.Rollover.RolledOverActivities == 1 ? "y" : "ies")} and " +
                $"{data.Rollover.RolledOverFocusAreas} focus area{(data.Rollover.RolledOverFocusAreas == 1 ? "" : "s")} are currently " +
                "carried over from an earlier month's report because they were never marked Completed.");
        if (data.Rollover.TopByRollover.Count > 0)
        {
            var roll = NewTable(6, 5, 3);
            HeaderRow(roll, "Staff", "Department", "Rolled-over items");
            foreach (var r in data.Rollover.TopByRollover)
                DataRow(roll, r.FullName, r.Department, r.Count);
        }

        // ---- every active staff member ----
        Heading($"Staff performance — all {data.AllStaff.Count} active staff");
        SubText("Sorted by average overall score; staff with no reviewed report yet show —.");
        var all = NewTable(3.6, 2.4, 3.2, 1.4, 1.8, 1.6, 1.6, 1.5);
        HeaderRow(all, "Name", "Department", "Supervisor", "Filed", "Reviewed", "Declined", "Avg score", "Latest");
        foreach (var s in data.AllStaff)
            DataRow(all, s.FullName, s.Department, s.SupervisorName, s.ReportsFiled, s.Reviewed, s.Declined,
                s.AvgOverallRating, s.LatestOverallRating);

        var renderer = new PdfDocumentRenderer { Document = doc };
        renderer.RenderDocument();
        using var ms = new MemoryStream();
        renderer.PdfDocument.Save(ms);
        return ms.ToArray();
    }
}
