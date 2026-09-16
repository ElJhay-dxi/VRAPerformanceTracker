using PerformanceTracker.Api.Auth;
using PerformanceTracker.Api.Data;
using PerformanceTracker.Api.Domain;

namespace PerformanceTracker.Api.Services;

/// Writes one audit row. Does not call SaveChanges — the caller commits it
/// alongside the change it describes, so the log and the data move together.
public class ActivityLogger(AppDbContext db, CurrentUser current)
{
    public void Record(string action, string entityType, string? entityId, string summary)
    {
        db.ActivityLog.Add(new ActivityLogEntry
        {
            ActorUserId = current.UserId,
            ActorEmail = current.Email ?? "system",
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Summary = summary
        });
    }
}
