namespace PerformanceTracker.Api.Domain;

/// <summary>
/// A snapshot of a staff member and every report they filed, written the moment
/// before the live rows are deleted. Kept for the record; never edited.
/// </summary>
public class ArchivedStaffRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OriginalUserId { get; set; }
    public required string Email { get; set; }
    public required string FullName { get; set; }
    public string? StaffId { get; set; }
    public string? Department { get; set; }
    public string? JobTitle { get; set; }
    public UserRole Role { get; set; }

    public int ReportCount { get; set; }

    public DateTimeOffset ArchivedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? ArchivedByUserId { get; set; }
    public required string ArchivedByEmail { get; set; }

    /// Full JSON: { "user": UserResponse, "reports": ReportResponse[] }.
    public required string SnapshotJson { get; set; }
}
