namespace PerformanceTracker.Api.Domain;

/// Section F row — a planned focus area for the next month, agreed by staff and supervisor.
public class FocusArea
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ReportId { get; set; }
    public PerformanceReport Report { get; set; } = null!;

    public int LineNo { get; set; }

    public string? PlannedActivity { get; set; }
    public string? ExpectedOutcome { get; set; }
    public string? SupportRequired { get; set; }

    /// Pending / Update both roll into next month; Completed stops.
    public FocusStatus Status { get; set; } = FocusStatus.Pending;

    public bool RolledOver { get; set; }

    public ItemReviewStatus ReviewStatus { get; set; } = ItemReviewStatus.Pending;
    public string? ReviewComment { get; set; }
}
