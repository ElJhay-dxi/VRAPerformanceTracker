using PerformanceTracker.Api.Domain;

namespace PerformanceTracker.Api.Contracts;

// ---------- Auth ----------

public record DevLoginRequest(string Email);

public record MeResponse(
    Guid Id,
    string Email,
    string FullName,
    UserRole Role,
    string? StaffId,
    string? Department,
    string? JobTitle,
    string? SupervisorName,
    string? SupervisorEmail,
    Guid? SupervisorUserId,
    bool IsActive);

// ---------- Users ----------

public record UserResponse(
    Guid Id,
    string Email,
    string FullName,
    UserRole Role,
    string? StaffId,
    string? Department,
    string? JobTitle,
    string? SupervisorName,
    string? SupervisorEmail,
    Guid? SupervisorUserId,
    string? SupervisorUserName,
    bool IsActive,
    bool HasEntraLink,
    DateTimeOffset CreatedAt);

public record CreateUserRequest(
    string Email,
    string FullName,
    string? StaffId,
    string? Department,
    string? JobTitle,
    string? SupervisorName,
    string? SupervisorEmail,
    UserRole Role,
    Guid? SupervisorUserId);

public record UpdateRoleRequest(UserRole Role);

public record AssignSupervisorRequest(Guid? SupervisorUserId, string? SupervisorEmail);

public record UpdateUserProfileRequest(
    string FullName,
    string Email,
    string? StaffId,
    string? Department,
    string? JobTitle,
    string? SupervisorName,
    string? SupervisorEmail);

public record SetActiveRequest(bool IsActive);

// ---------- Reports ----------

public record ActivityInput(
    Guid? Id,
    int LineNo,
    string? KeyActivity,
    string? DescriptionOfWork,
    string? OutputResult,
    ActivityProgress? Status);

public record FocusAreaInput(
    Guid? Id,
    int LineNo,
    string? PlannedActivity,
    string? ExpectedOutcome,
    string? SupportRequired,
    FocusStatus Status);

public record SaveReportRequest(
    string? KeyAchievements,
    string? Innovations,
    string? NewSkills,
    string? KnowledgeGained,
    string? ToolsLearned,
    string? KeyChallenges,
    string? SupportRequired,
    string? StaffSignatureName,
    DateOnly? StaffSignOffDate,
    List<ActivityInput> Activities,
    List<FocusAreaInput> FocusAreas);

/// One row's verdict from the supervisor. Keyed by the row's Id.
public record ItemReviewInput(Guid Id, ItemReviewStatus Status, string? Comment);

public record AppraiseReportRequest(
    int? QualityOfWorkRating, string? QualityOfWorkComment,
    int? ProductivityRating, string? ProductivityComment,
    int? InitiativeRating, string? InitiativeComment,
    int? TeamworkRating, string? TeamworkComment,
    int? ComplianceRating, string? ComplianceComment,
    decimal? OverallRating,
    string? SupervisorGeneralComments,
    string? SupervisorSignatureName,
    DateOnly? SupervisorSignOffDate,
    ReportStatus Decision,
    string? DecisionComment,
    List<ItemReviewInput>? ActivityReviews,
    List<ItemReviewInput>? FocusReviews);

public record ActivityRowResponse(
    Guid Id, int LineNo, string? KeyActivity, string? DescriptionOfWork,
    string? OutputResult, ActivityProgress? Status,
    bool RolledOver, ItemReviewStatus ReviewStatus, string? ReviewComment);

public record FocusAreaRowResponse(
    Guid Id, int LineNo, string? PlannedActivity, string? ExpectedOutcome, string? SupportRequired,
    FocusStatus Status, bool RolledOver, ItemReviewStatus ReviewStatus, string? ReviewComment);

public record ReportSummaryResponse(
    Guid Id,
    Guid StaffUserId,
    string StaffName,
    string StaffEmail,
    string? StaffId,
    string? Department,
    int Year,
    int Month,
    ReportStatus Status,
    decimal? OverallRating,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? ReviewedAt,
    DateTimeOffset UpdatedAt);

public record ReportResponse(
    Guid Id,
    Guid StaffUserId,
    string StaffName,
    string StaffEmail,
    string? StaffId,
    string? Department,
    string? JobTitle,
    string? SupervisorName,
    int Year,
    int Month,
    ReportStatus Status,
    string? KeyAchievements,
    string? Innovations,
    string? NewSkills,
    string? KnowledgeGained,
    string? ToolsLearned,
    string? KeyChallenges,
    string? SupportRequired,
    string? StaffSignatureName,
    DateOnly? StaffSignOffDate,
    DateTimeOffset? SubmittedAt,
    int? QualityOfWorkRating, string? QualityOfWorkComment,
    int? ProductivityRating, string? ProductivityComment,
    int? InitiativeRating, string? InitiativeComment,
    int? TeamworkRating, string? TeamworkComment,
    int? ComplianceRating, string? ComplianceComment,
    decimal? OverallRating,
    string? SupervisorGeneralComments,
    string? SupervisorSignatureName,
    DateOnly? SupervisorSignOffDate,
    string? DecisionComment,
    Guid? ReviewedByUserId,
    string? ReviewedByName,
    DateTimeOffset? ReviewedAt,
    IReadOnlyList<ActivityRowResponse> Activities,
    IReadOnlyList<FocusAreaRowResponse> FocusAreas,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

// ---------- Archived staff ----------

/// Shape of ArchivedStaffRecord.SnapshotJson — what a reinstate rebuilds from.
public record ArchiveSnapshot(UserResponse User, List<ReportResponse> Reports);

public record ArchivedStaffSummary(
    Guid Id,
    Guid OriginalUserId,
    string Email,
    string FullName,
    string? StaffId,
    string? Department,
    string? JobTitle,
    UserRole Role,
    int ReportCount,
    DateTimeOffset ArchivedAt,
    string ArchivedByEmail);

// ---------- HR analytics ----------

/// Feeds both the HR overview cards and the Analytics page — computed once.
public record HrAnalyticsResponse(
    // Headline counts (overview cards)
    int ActiveStaff,
    int NewStaffLast30Days,
    int StaffWithoutSupervisor,
    int Supervisors,
    int Departments,
    int ArchivedStaff,
    // Report pipeline
    int TotalReports,
    int DraftReports,
    int AwaitingReview,
    int ApprovedReports,
    int DeclinedReports,
    int ReportsThisMonth,
    int SubmittedThisMonth,
    // Performance aggregates
    decimal? AvgOverallRating,
    decimal? ApprovalRate,
    ParameterAverages Parameters,
    IReadOnlyList<DepartmentPerformance> ByDepartment,
    IReadOnlyList<MonthlyTrendPoint> Trend,
    IReadOnlyList<StaffPerformance> TopPerformers,
    IReadOnlyList<StaffPerformance> NeedsAttention);

/// Average of each Section G rating parameter across every scored report.
public record ParameterAverages(
    decimal? QualityOfWork,
    decimal? Productivity,
    decimal? Initiative,
    decimal? Teamwork,
    decimal? Compliance);

public record DepartmentPerformance(
    string Department,
    int StaffCount,
    int ReportCount,
    decimal? AvgOverallRating);

public record MonthlyTrendPoint(
    int Year,
    int Month,
    int ReportCount,
    int ApprovedCount,
    decimal? AvgOverallRating);

public record StaffPerformance(
    Guid UserId,
    string FullName,
    string? Department,
    int ReviewedReports,
    int DeclinedReports,
    decimal? AvgOverallRating,
    decimal? LatestOverallRating);

// ---------- Activity log ----------

public record ActivityLogResponse(
    Guid Id,
    Guid? ActorUserId,
    string ActorEmail,
    string Action,
    string EntityType,
    string? EntityId,
    string Summary,
    DateTimeOffset CreatedAt);

// ---------- Shared ----------

public record Paged<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);
