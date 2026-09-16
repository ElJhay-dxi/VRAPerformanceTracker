namespace PerformanceTracker.Api.Domain;

/// Append-only audit record. Written on every state change; never edited or deleted.
public class ActivityLogEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? ActorUserId { get; set; }
    public required string ActorEmail { get; set; }

    /// Dotted verb, e.g. "report.submitted", "user.role_changed".
    public required string Action { get; set; }

    public required string EntityType { get; set; }
    public string? EntityId { get; set; }

    public required string Summary { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
