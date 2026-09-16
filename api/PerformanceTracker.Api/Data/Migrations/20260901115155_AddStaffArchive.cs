using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PerformanceTracker.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffArchive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ArchivedStaff",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OriginalUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StaffId = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Department = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    JobTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ReportCount = table.Column<int>(type: "integer", nullable: false),
                    ArchivedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ArchivedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ArchivedByEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    SnapshotJson = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArchivedStaff", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ArchivedStaff_ArchivedAt",
                table: "ArchivedStaff",
                column: "ArchivedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ArchivedStaff_Email",
                table: "ArchivedStaff",
                column: "Email");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ArchivedStaff");
        }
    }
}
