using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PdfSharp.Fonts;
using PerformanceTracker.Api.Auth;
using PerformanceTracker.Api.Data;
using PerformanceTracker.Api.Features;
using PerformanceTracker.Api.Services;

// PDFsharp 6 needs an explicit font resolver on every platform (no OS font access by
// default) — registered once, before anything renders a PDF.
GlobalFontSettings.FontResolver = new PdfFontResolver();

var builder = WebApplication.CreateBuilder(args);

// Machine-local overrides (git-ignored): DB connection string, Entra AzureAd section, etc.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

var connectionString = builder.Configuration.GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("ConnectionStrings:Postgres is not configured.");

builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString));

builder.Services.AddAppAuth(builder.Configuration);
builder.Services.AddScoped<ActivityLogger>();

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? ["http://localhost:5173"];
builder.Services.AddCors(o => o.AddPolicy("web", p => p
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db);

    app.MapOpenApi();
}
else
{
    app.UseHttpsRedirection();
}

app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok", time = DateTimeOffset.UtcNow }));

app.MapAuthEndpoints(app.Environment);
app.MapUsersEndpoints();
app.MapReportsEndpoints();
app.MapActivityLogEndpoints();
app.MapArchiveEndpoints();
app.MapAnalyticsEndpoints();

app.Run();
