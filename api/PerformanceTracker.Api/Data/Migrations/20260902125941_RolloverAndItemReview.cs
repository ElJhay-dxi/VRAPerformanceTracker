using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PerformanceTracker.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RolloverAndItemReview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReviewComment",
                table: "FocusAreas",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewStatus",
                table: "FocusAreas",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Pending");

            migrationBuilder.AddColumn<bool>(
                name: "RolledOver",
                table: "FocusAreas",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "FocusAreas",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Pending");

            migrationBuilder.AddColumn<string>(
                name: "ReviewComment",
                table: "Activities",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewStatus",
                table: "Activities",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Pending");

            migrationBuilder.AddColumn<bool>(
                name: "RolledOver",
                table: "Activities",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReviewComment",
                table: "FocusAreas");

            migrationBuilder.DropColumn(
                name: "ReviewStatus",
                table: "FocusAreas");

            migrationBuilder.DropColumn(
                name: "RolledOver",
                table: "FocusAreas");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "FocusAreas");

            migrationBuilder.DropColumn(
                name: "ReviewComment",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "ReviewStatus",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "RolledOver",
                table: "Activities");
        }
    }
}
