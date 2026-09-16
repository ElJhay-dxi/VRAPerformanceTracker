namespace PerformanceTracker.Api.Domain;

/// <summary>
/// One monthly performance tracking form for one staff member.
/// Sections B–F are filled by the staff member; Section G by their supervisor.
/// </summary>
public class PerformanceReport
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid StaffUserId { get; set; }
    public AppUser StaffUser { get; set; } = null!;

    // Month under review.
    public int Year { get; set; }
    public int Month { get; set; }

    public ReportStatus Status { get; set; } = ReportStatus.Draft;

    // Section C — achievements, innovation, creativity.
    public string? KeyAchievements { get; set; }
    public string? Innovations { get; set; }

    // Section D — skills & experience gained.
    public string? NewSkills { get; set; }
    public string? KnowledgeGained { get; set; }
    public string? ToolsLearned { get; set; }

    // Section E — challenges encountered.
    public string? KeyChallenges { get; set; }
    public string? SupportRequired { get; set; }

    // Staff sign-off.
    public string? StaffSignatureName { get; set; }
    public DateOnly? StaffSignOffDate { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }

    // Section G — supervisor appraisal. Rating scale 1–5.
    public int? QualityOfWorkRating { get; set; }
    public string? QualityOfWorkComment { get; set; }
    public int? ProductivityRating { get; set; }
    public string? ProductivityComment { get; set; }
    public int? InitiativeRating { get; set; }
    public string? InitiativeComment { get; set; }
    public int? TeamworkRating { get; set; }
    public string? TeamworkComment { get; set; }
    public int? ComplianceRating { get; set; }
    public string? ComplianceComment { get; set; }

    public decimal? OverallRating { get; set; }
    public string? SupervisorGeneralComments { get; set; }
    public string? SupervisorSignatureName { get; set; }
    public DateOnly? SupervisorSignOffDate { get; set; }

    /// Set when the supervisor declines, so the staff member knows what to fix.
    public string? DecisionComment { get; set; }

    public Guid? ReviewedByUserId { get; set; }
    public AppUser? ReviewedByUser { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<MonthlyActivity> Activities { get; set; } = new List<MonthlyActivity>();
    public ICollection<FocusArea> FocusAreas { get; set; } = new List<FocusArea>();
}
