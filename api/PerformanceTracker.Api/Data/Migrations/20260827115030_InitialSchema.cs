using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PerformanceTracker.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActivityLog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    Action = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    EntityId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Summary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityLog", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EntraObjectId = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StaffId = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Department = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    JobTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SupervisorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SupervisorEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    SupervisorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Users_SupervisorUserId",
                        column: x => x.SupervisorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Reports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    KeyAchievements = table.Column<string>(type: "text", nullable: true),
                    Innovations = table.Column<string>(type: "text", nullable: true),
                    NewSkills = table.Column<string>(type: "text", nullable: true),
                    KnowledgeGained = table.Column<string>(type: "text", nullable: true),
                    ToolsLearned = table.Column<string>(type: "text", nullable: true),
                    KeyChallenges = table.Column<string>(type: "text", nullable: true),
                    SupportRequired = table.Column<string>(type: "text", nullable: true),
                    StaffSignatureName = table.Column<string>(type: "text", nullable: true),
                    StaffSignOffDate = table.Column<DateOnly>(type: "date", nullable: true),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    QualityOfWorkRating = table.Column<int>(type: "integer", nullable: true),
                    QualityOfWorkComment = table.Column<string>(type: "text", nullable: true),
                    ProductivityRating = table.Column<int>(type: "integer", nullable: true),
                    ProductivityComment = table.Column<string>(type: "text", nullable: true),
                    InitiativeRating = table.Column<int>(type: "integer", nullable: true),
                    InitiativeComment = table.Column<string>(type: "text", nullable: true),
                    TeamworkRating = table.Column<int>(type: "integer", nullable: true),
                    TeamworkComment = table.Column<string>(type: "text", nullable: true),
                    ComplianceRating = table.Column<int>(type: "integer", nullable: true),
                    ComplianceComment = table.Column<string>(type: "text", nullable: true),
                    OverallRating = table.Column<decimal>(type: "numeric(3,2)", precision: 3, scale: 2, nullable: true),
                    SupervisorGeneralComments = table.Column<string>(type: "text", nullable: true),
                    SupervisorSignatureName = table.Column<string>(type: "text", nullable: true),
                    SupervisorSignOffDate = table.Column<DateOnly>(type: "date", nullable: true),
                    DecisionComment = table.Column<string>(type: "text", nullable: true),
                    ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Reports_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Reports_Users_StaffUserId",
                        column: x => x.StaffUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Activities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    LineNo = table.Column<int>(type: "integer", nullable: false),
                    KeyActivity = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DescriptionOfWork = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    OutputResult = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Activities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Activities_Reports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "Reports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FocusAreas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportId = table.Column<Guid>(type: "uuid", nullable: false),
                    LineNo = table.Column<int>(type: "integer", nullable: false),
                    PlannedActivity = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ExpectedOutcome = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    SupportRequired = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FocusAreas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FocusAreas_Reports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "Reports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Activities_ReportId",
                table: "Activities",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityLog_CreatedAt",
                table: "ActivityLog",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityLog_EntityType",
                table: "ActivityLog",
                column: "EntityType");

            migrationBuilder.CreateIndex(
                name: "IX_FocusAreas_ReportId",
                table: "FocusAreas",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_ReviewedByUserId",
                table: "Reports",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_StaffUserId_Year_Month",
                table: "Reports",
                columns: new[] { "StaffUserId", "Year", "Month" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_EntraObjectId",
                table: "Users",
                column: "EntraObjectId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_SupervisorUserId",
                table: "Users",
                column: "SupervisorUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Activities");

            migrationBuilder.DropTable(
                name: "ActivityLog");

            migrationBuilder.DropTable(
                name: "FocusAreas");

            migrationBuilder.DropTable(
                name: "Reports");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
