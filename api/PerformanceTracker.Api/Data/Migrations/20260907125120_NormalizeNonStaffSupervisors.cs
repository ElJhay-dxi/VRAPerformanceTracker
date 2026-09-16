using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PerformanceTracker.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeNonStaffSupervisors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Only Staff (new recruits) can have a supervisor — Supervisor/Admin/HR
            // run the app. Clear any supervisor links left on non-Staff rows.
            migrationBuilder.Sql(
                """
                UPDATE "Users"
                SET "SupervisorUserId" = NULL,
                    "SupervisorName" = NULL,
                    "SupervisorEmail" = NULL
                WHERE "Role" <> 'Staff'
                  AND ("SupervisorUserId" IS NOT NULL
                       OR "SupervisorName" IS NOT NULL
                       OR "SupervisorEmail" IS NOT NULL);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only cleanup; nothing to revert.
        }
    }
}
