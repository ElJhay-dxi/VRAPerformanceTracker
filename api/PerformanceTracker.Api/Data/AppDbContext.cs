using Microsoft.EntityFrameworkCore;
using PerformanceTracker.Api.Domain;

namespace PerformanceTracker.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<PerformanceReport> Reports => Set<PerformanceReport>();
    public DbSet<MonthlyActivity> Activities => Set<MonthlyActivity>();
    public DbSet<FocusArea> FocusAreas => Set<FocusArea>();
    public DbSet<ActivityLogEntry> ActivityLog => Set<ActivityLogEntry>();
    public DbSet<ArchivedStaffRecord> ArchivedStaff => Set<ArchivedStaffRecord>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<AppUser>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.HasIndex(x => x.EntraObjectId).IsUnique();
            e.HasIndex(x => x.SupervisorUserId);
            e.Property(x => x.Email).HasMaxLength(320);
            e.Property(x => x.FullName).HasMaxLength(200);
            e.Property(x => x.StaffId).HasMaxLength(60);
            e.Property(x => x.Department).HasMaxLength(200);
            e.Property(x => x.JobTitle).HasMaxLength(200);
            e.Property(x => x.SupervisorName).HasMaxLength(200);
            e.Property(x => x.SupervisorEmail).HasMaxLength(320);
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);

            e.HasOne(x => x.SupervisorUser)
                .WithMany()
                .HasForeignKey(x => x.SupervisorUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<PerformanceReport>(e =>
        {
            e.HasIndex(x => new { x.StaffUserId, x.Year, x.Month }).IsUnique();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.OverallRating).HasPrecision(3, 2);

            e.HasOne(x => x.StaffUser)
                .WithMany(u => u.Reports)
                .HasForeignKey(x => x.StaffUserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.ReviewedByUser)
                .WithMany()
                .HasForeignKey(x => x.ReviewedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasMany(x => x.Activities)
                .WithOne(a => a.Report)
                .HasForeignKey(a => a.ReportId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasMany(x => x.FocusAreas)
                .WithOne(f => f.Report)
                .HasForeignKey(f => f.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<MonthlyActivity>(e =>
        {
            e.Property(x => x.KeyActivity).HasMaxLength(500);
            e.Property(x => x.DescriptionOfWork).HasMaxLength(4000);
            e.Property(x => x.OutputResult).HasMaxLength(4000);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ReviewStatus).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ReviewComment).HasMaxLength(2000);
        });

        b.Entity<FocusArea>(e =>
        {
            e.Property(x => x.PlannedActivity).HasMaxLength(500);
            e.Property(x => x.ExpectedOutcome).HasMaxLength(4000);
            e.Property(x => x.SupportRequired).HasMaxLength(4000);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ReviewStatus).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ReviewComment).HasMaxLength(2000);
        });

        b.Entity<ActivityLogEntry>(e =>
        {
            e.HasIndex(x => x.CreatedAt);
            e.HasIndex(x => x.EntityType);
            e.Property(x => x.ActorEmail).HasMaxLength(320);
            e.Property(x => x.Action).HasMaxLength(80);
            e.Property(x => x.EntityType).HasMaxLength(80);
            e.Property(x => x.EntityId).HasMaxLength(64);
            e.Property(x => x.Summary).HasMaxLength(1000);
        });

        b.Entity<ArchivedStaffRecord>(e =>
        {
            e.HasIndex(x => x.ArchivedAt);
            e.HasIndex(x => x.Email);
            e.Property(x => x.Email).HasMaxLength(320);
            e.Property(x => x.FullName).HasMaxLength(200);
            e.Property(x => x.StaffId).HasMaxLength(60);
            e.Property(x => x.Department).HasMaxLength(200);
            e.Property(x => x.JobTitle).HasMaxLength(200);
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ArchivedByEmail).HasMaxLength(320);
            e.Property(x => x.SnapshotJson).HasColumnType("jsonb");
        });
    }

    public override int SaveChanges()
    {
        StampTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void StampTimestamps()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            // On Added, only stamp when the caller left it at default — a reinstate
            // sets the original timestamps deliberately and they must survive.
            if (entry.Entity is AppUser u)
            {
                if (entry.State == EntityState.Added && u.CreatedAt == default) u.CreatedAt = now;
                if (entry.State == EntityState.Modified) u.UpdatedAt = now;
                if (entry.State == EntityState.Added && u.UpdatedAt == default) u.UpdatedAt = now;
            }
            else if (entry.Entity is PerformanceReport r)
            {
                if (entry.State == EntityState.Added && r.CreatedAt == default) r.CreatedAt = now;
                if (entry.State == EntityState.Modified) r.UpdatedAt = now;
                if (entry.State == EntityState.Added && r.UpdatedAt == default) r.UpdatedAt = now;
            }
        }
    }
}
