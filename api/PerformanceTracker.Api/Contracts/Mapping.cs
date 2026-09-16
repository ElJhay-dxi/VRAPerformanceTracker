using PerformanceTracker.Api.Domain;

namespace PerformanceTracker.Api.Contracts;

public static class Mapping
{
    public static MeResponse ToMe(this AppUser u) => new(
        u.Id, u.Email, u.FullName, u.Role, u.StaffId, u.Department, u.JobTitle,
        u.SupervisorName, u.SupervisorEmail, u.SupervisorUserId, u.IsActive);

    public static UserResponse ToUserResponse(this AppUser u) => new(
        u.Id, u.Email, u.FullName, u.Role, u.StaffId, u.Department, u.JobTitle,
        u.SupervisorName, u.SupervisorEmail, u.SupervisorUserId, u.SupervisorUser?.FullName,
        u.IsActive, u.EntraObjectId is not null, u.CreatedAt);

    public static ReportSummaryResponse ToSummary(this PerformanceReport r, bool hideScores = false) => new(
        r.Id, r.StaffUserId, r.StaffUser.FullName, r.StaffUser.Email, r.StaffUser.StaffId, r.StaffUser.Department,
        r.Year, r.Month, r.Status, hideScores ? null : r.OverallRating, r.SubmittedAt, r.ReviewedAt, r.UpdatedAt);

    /// <param name="hideScores">
    /// True when a staff member views their own Declined report — they get the
    /// supervisor's comments but not the star ratings or overall score.
    /// </param>
    public static ReportResponse ToResponse(this PerformanceReport r, bool hideScores = false) => new(
        r.Id, r.StaffUserId, r.StaffUser.FullName, r.StaffUser.Email, r.StaffUser.StaffId, r.StaffUser.Department,
        r.StaffUser.JobTitle, r.StaffUser.SupervisorName,
        r.Year, r.Month, r.Status,
        r.KeyAchievements, r.Innovations,
        r.NewSkills, r.KnowledgeGained, r.ToolsLearned,
        r.KeyChallenges, r.SupportRequired,
        r.StaffSignatureName, r.StaffSignOffDate, r.SubmittedAt,
        hideScores ? null : r.QualityOfWorkRating, r.QualityOfWorkComment,
        hideScores ? null : r.ProductivityRating, r.ProductivityComment,
        hideScores ? null : r.InitiativeRating, r.InitiativeComment,
        hideScores ? null : r.TeamworkRating, r.TeamworkComment,
        hideScores ? null : r.ComplianceRating, r.ComplianceComment,
        hideScores ? null : r.OverallRating,
        r.SupervisorGeneralComments, r.SupervisorSignatureName, r.SupervisorSignOffDate,
        r.DecisionComment, r.ReviewedByUserId, r.ReviewedByUser?.FullName, r.ReviewedAt,
        r.Activities.OrderBy(a => a.LineNo)
            .Select(a => new ActivityRowResponse(
                a.Id, a.LineNo, a.KeyActivity, a.DescriptionOfWork, a.OutputResult, a.Status,
                a.RolledOver, a.ReviewStatus, a.ReviewComment))
            .ToList(),
        r.FocusAreas.OrderBy(f => f.LineNo)
            .Select(f => new FocusAreaRowResponse(
                f.Id, f.LineNo, f.PlannedActivity, f.ExpectedOutcome, f.SupportRequired,
                f.Status, f.RolledOver, f.ReviewStatus, f.ReviewComment))
            .ToList(),
        r.CreatedAt, r.UpdatedAt);

    public static ActivityLogResponse ToResponse(this ActivityLogEntry e) => new(
        e.Id, e.ActorUserId, e.ActorEmail, e.Action, e.EntityType, e.EntityId, e.Summary, e.CreatedAt);
}
