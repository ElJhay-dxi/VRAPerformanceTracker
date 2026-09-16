namespace PerformanceTracker.Api.Domain;

public enum UserRole
{
    Staff = 0,
    Supervisor = 1,
    Admin = 2,
    Hr = 3
}

public enum ReportStatus
{
    Draft = 0,
    Submitted = 1,
    Approved = 2,
    Declined = 3
}

public enum ActivityProgress
{
    Ongoing = 0,
    Completed = 1
}

/// Section F focus-area status. Anything other than Completed rolls into next month.
public enum FocusStatus
{
    Pending = 0,
    Completed = 1,
    Update = 2
}

/// A supervisor's verdict on one activity / focus-area row.
public enum ItemReviewStatus
{
    Pending = 0,
    Approved = 1,
    Declined = 2
}
