namespace PerformanceTracker.Api.Domain;

/// <summary>
/// A person in the organization. Identity comes from Entra (Azure AD) once wired;
/// role and supervisor assignment are managed inside this app by an Admin.
/// </summary>
public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// Azure AD / Entra object id. Null until the user has signed in through Entra.
    public string? EntraObjectId { get; set; }

    /// Organization email. Canonical key we match Entra logins against.
    public required string Email { get; set; }

    public required string FullName { get; set; }

    // Section A of the paper form — staff information.
    public string? StaffId { get; set; }
    public string? Department { get; set; }
    public string? JobTitle { get; set; }

    /// Free-text supervisor name as written on the form.
    public string? SupervisorName { get; set; }

    /// Supervisor email — the extra column requested on top of the form fields.
    public string? SupervisorEmail { get; set; }

    /// The actual supervising user, set by an Admin. Drives who reviews this person's reports.
    public Guid? SupervisorUserId { get; set; }
    public AppUser? SupervisorUser { get; set; }

    public UserRole Role { get; set; } = UserRole.Staff;

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<PerformanceReport> Reports { get; set; } = new List<PerformanceReport>();
}
