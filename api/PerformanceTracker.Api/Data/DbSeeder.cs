using Microsoft.EntityFrameworkCore;
using PerformanceTracker.Api.Domain;

namespace PerformanceTracker.Api.Data;

/// Development seed data. Runs only when the Users table is empty.
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        if (await db.Users.AnyAsync()) return;

        var admin = new AppUser
        {
            Email = "admin@vra.com", FullName = "Ama Mensah", Role = UserRole.Admin,
            StaffId = "VRA-0001", Department = "VRA Academy", JobTitle = "System Administrator"
        };
        var hr = new AppUser
        {
            Email = "hr@vra.com", FullName = "Kofi Boateng", Role = UserRole.Hr,
            StaffId = "VRA-0002", Department = "Human Resources", JobTitle = "HR Officer"
        };
        var supervisor = new AppUser
        {
            Email = "supervisor@vra.com", FullName = "Yaw Owusu", Role = UserRole.Supervisor,
            StaffId = "VRA-0010", Department = "Innovation", JobTitle = "Team Lead, Innovation"
        };

        db.Users.AddRange(admin, hr, supervisor);
        await db.SaveChangesAsync();

        var staff = new[]
        {
            new AppUser
            {
                Email = "akosua@vra.com", FullName = "Akosua Adjei", Role = UserRole.Staff,
                StaffId = "VRA-1001", Department = "Innovation", JobTitle = "Software Engineer (National Service)",
                SupervisorUserId = supervisor.Id, SupervisorName = supervisor.FullName, SupervisorEmail = supervisor.Email
            },
            new AppUser
            {
                Email = "kwame@vra.com", FullName = "Kwame Asante", Role = UserRole.Staff,
                StaffId = "VRA-1002", Department = "Innovation", JobTitle = "Data Analyst (National Service)",
                SupervisorUserId = supervisor.Id, SupervisorName = supervisor.FullName, SupervisorEmail = supervisor.Email
            },
            new AppUser
            {
                Email = "efua@vra.com", FullName = "Efua Sarpong", Role = UserRole.Staff,
                StaffId = "VRA-1003", Department = "Finance", JobTitle = "Accounts Officer (National Service)"
            }
        };
        db.Users.AddRange(staff);
        await db.SaveChangesAsync();
    }
}
