namespace PerformanceTracker.Api.Domain;

/// Section B row — a key activity or task performed during the month.
public class MonthlyActivity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ReportId { get; set; }
    public PerformanceReport Report { get; set; } = null!;

    public int LineNo { get; set; }

    public string? KeyActivity { get; set; }
    public string? DescriptionOfWork { get; set; }
    public string? OutputResult { get; set; }
    public ActivityProgress? Status { get; set; }

    /// Carried forward from a previous month's report because it was still Ongoing.
    public bool RolledOver { get; set; }

    /// The supervisor's per-row verdict. Approved rows lock; Declined rows stay editable.
    public ItemReviewStatus ReviewStatus { get; set; } = ItemReviewStatus.Pending;
    public string? ReviewComment { get; set; }
}
