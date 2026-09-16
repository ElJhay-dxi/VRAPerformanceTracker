# VRA Performance Tracker — project brief

Read this and `memory.md` before working on this project. This file is the source of
truth for project detail; the global `About Me/memory.md` in the CoWork workspace holds
only a one-line snapshot.

## What it is

A web app replacing the VRA Academy **Monthly Performance Tracking Form** (a Word
document, `PERFORMANCE TRACKING FORM (1).docx`). Purpose: track how new hires are
performing. Staff fill their monthly report, supervisors appraise it, HR and admins
oversee.

Real internal tool for Jeffrey's workplace (Volta River Authority). Multi-user,
organization data, so auth and an audit trail are in from the start.

## Stack

- **API:** ASP.NET Core (.NET 10), minimal APIs grouped by feature, EF Core 10, Npgsql.
  Runs on `http://localhost:5202` (http launch profile).
- **DB:** PostgreSQL. Local dev against Postgres.app on 5432; `docker-compose.yml`
  offers a container on 5433 as an alternative. Production target: Azure Database for
  PostgreSQL.
- **Frontend:** React 19 + TypeScript + Vite 8, React Router 7. Hand-written typed
  fetch client (`web/src/api.ts`), no component library. Hand-rolled CSS design system
  in `web/src/index.css` (tokens, light + dark themes), `lucide-react` for icons,
  `motion` for transitions/drawer/toasts, Google Fonts (Inter + Sora). Vite dev server
  on 5173 proxies `/api` to the API. Home route for every role is `/overview` (a
  role-aware Dashboard). Theme choice persists in localStorage.
- **Auth:** dual-mode. Dev cookie sign-in (seeded user picker) by default; **Microsoft
  Entra ID** (MSAL redirect flow, "Sign in with Microsoft" only) when
  `AzureAd:ClientId` + `VITE_ENTRA_CLIENT_ID` are configured. Both resolve to the same
  `pt_uid`/`pt_role` claims. Setup steps in `README.md` → Auth.

## Key decisions

- **2026-08-27 — Folder name `vra-performance-tracker`**, sibling of `LexManager` under
  `Programming Projects/`. Repo holds its own `CLAUDE.md` + `memory.md` (same pattern as
  LexManager); no `projects/<name>/` scaffold in the CoWork workspace.
- **2026-08-27 — PostgreSQL, not SQL Server.** Jeffrey's call. Local dev on Postgres.app;
  identity from Azure AD.
- **2026-08-27 — App-managed roles.** Roles (`Staff`, `Supervisor`, `Admin`, `Hr`) are a
  column on `AppUser`, changed by an Admin in the UI. Entra will only authenticate.
- **2026-08-27 — Entra deferred.** Built a dev cookie auth shim (`Auth/AuthSetup.cs`,
  `POST /auth/dev-login`) with a role picker so all features could be built without an
  Azure tenant.
- **2026-09-01 — Entra ID wired (dual-mode).** MSAL (`@azure/msal-browser`/`-react`)
  on the SPA, `Microsoft.Identity.Web` JWT bearer on the API, both switched on by
  config (`AzureAd:ClientId` / `VITE_ENTRA_CLIENT_ID`). `EntraClaimsTransformation`
  maps a validated token to our `AppUser` (by `EntraObjectId` then email) and stamps
  `pt_uid`/`pt_role` — identical to what the dev cookie carries, so nothing downstream
  changed. Cookie + bearer schemes run side by side; default policy accepts either.
  `GET /auth/me` returns **403** (not 401) for a valid token with no matching user, so
  the SPA shows "no access" instead of a sign-in loop. Users must be pre-added to the
  Staff List; first sign-in back-fills `EntraObjectId`. Not yet tested against a real
  tenant — Jeffrey to supply the app registration. Setup in `README.md` → Auth.
- **2026-09-07 — Only Staff have a supervisor.** Supervisor/Admin/HR run the app; the
  form is for new recruits. `SupervisorUserId` / `SupervisorName` / `SupervisorEmail`
  are only ever set on `Role == Staff`. Enforced server-side: `POST /users` ignores
  supervisor fields for non-Staff, `PUT /users/{id}/supervisor` 400s for non-Staff,
  `PUT /users/{id}/role` clears the fields when promoting out of Staff, and
  `PUT /users/{id}/profile` nulls them for non-Staff. Migration
  `NormalizeNonStaffSupervisors` (data-only `UPDATE`) cleared existing rows. Frontend
  hides the supervisor controls unless the role is Staff.
- **2026-09-15 — PDF library: PDFsharp/MigraDoc, not QuestPDF.** QuestPDF's free tier
  (Community License) only covers organizations under US$1M annual gross revenue —
  VRA is a state utility, well over that, so it would need QuestPDF's paid tier.
  PDFsharp + MigraDoc are MIT-licensed with no revenue gate; used those instead.
- **2026-09-15 — Analytics export is PDF-only.** Briefly offered CSV/Word/Excel too
  (`DocumentFormat.OpenXml`, `ClosedXML`); Jeffrey asked to drop all three and keep
  just PDF ("cleaner… exactly what I need") and to pack in everything the app can
  report on. Both packages were removed again — see `GET /analytics/hr/export` above
  for what the single PDF now contains.
- **2026-08-27 — `.slnx` solution format** (the .NET 10 `dotnet new sln` default).
  Recent Rider handles it; note if an older Rider chokes.
- **2026-08-27 — Local `dotnet-ef` tool pinned to 10.0.11** in `dotnet-tools.json`
  (the machine's global `dotnet-ef` is 8.x and won't drive EF 10 design-time).

## Domain model

`AppUser` — one person. Section A of the form (StaffId, Department, JobTitle,
SupervisorName) plus `SupervisorEmail` (the requested extra column), `Email`,
`EntraObjectId` (null until first Entra sign-in), `Role`, `SupervisorUserId`
(self-ref FK — the actual reviewing user, set by Admin), `IsActive`.

`PerformanceReport` — one form, one staff member, one month.
`unique (StaffUserId, Year, Month)`. Sections C–E are scalar text columns; Section G
(the appraisal) is scalar columns too — 5 rating/comment pairs, overall, general
comments, decision. Status: `Draft → Submitted → Approved | Declined`; a declined
report is editable again and resubmitting clears the verdict + reviewer but **keeps
the scores** (so the supervisor sees what they gave last time).

`MonthlyActivity` — Section B rows (KeyActivity, DescriptionOfWork, OutputResult,
Status Completed/Ongoing). `FocusArea` — Section F rows (PlannedActivity,
ExpectedOutcome, SupportRequired, Status Pending/Completed/Update). Both also carry:
`RolledOver` (bool — pre-filled from the previous month), `ReviewStatus`
(Pending/Approved/Declined — the supervisor's per-row verdict), `ReviewComment`.

**Per-item review + rollover (2026-09-02):**
- `POST /reports/mine/{y}/{m}` copies forward, from the most recent earlier report,
  every activity still `Ongoing` and every focus area not `Completed` — marked
  `RolledOver`.
- `PUT /reports/{id}` merges rows by Id (preserves Ids + review state). On a Declined
  report the staff can only edit rows whose `ReviewStatus == Declined`; everything else
  (Approved **or** untouched-Pending) is server-enforced read-only.
- `POST /reports/{id}/appraise` takes `ActivityReviews` / `FocusReviews`
  (`{id,status,comment}`). Overall `Approved` forces every row to `Approved`.
- `POST /reports/{id}/submit` resets `Declined` rows to `Pending` for a fresh look;
  `Approved` rows stay locked through to final approval.
- Staff viewing their own **Declined** report get comments but not scores
  (`ToResponse(hideScores)` nulls the ratings + overall).

`ActivityLogEntry` — append-only audit row written on every state change by
`Services/ActivityLogger` (does not call SaveChanges; the caller commits it with the
change it describes).

`ArchivedStaffRecord` — snapshot written by `DELETE /users/{id}` just before the live
rows go: flat metadata (email, name, staffId, dept, role, reportCount, archivedAt,
archivedBy) + a `SnapshotJson` `jsonb` column holding `{ user, reports }` in the same
DTO shapes the API returns. Never edited. Migration `AddStaffArchive` (2026-09-01).
`Contracts/Json.cs` holds the serializer options used to build the snapshot.

## Endpoints (all under `/`; auth = dev cookie or Entra bearer)

- `GET /auth/config` (anon) → `{ mode: "dev" | "entra" }`. `GET /auth/me`,
  `POST /auth/logout`. `POST /auth/dev-login`, `GET /auth/dev-users` — Development only.
- `GET /users` (Admin, Hr), `GET /users/{id}`, `GET /users/me/supervisees`
  (Supervisor, Admin, Hr)
- `POST /users` (Admin) — create a person; email required + unique.
  `DELETE /users/{id}` (Admin) — **archive then hard-delete**. Writes an
  `ArchivedStaffRecord` (JSON snapshot of the person + every report they filed, via
  `UserResponse` / `ReportResponse[]`), then removes the live rows: FK `ON DELETE
  CASCADE` takes the reports + their activity/focus rows; supervisees'
  `SupervisorUserId` and any `ReviewedByUserId` are set null; the activity log is
  untouched and records `user.archived … with N report(s)`. Can't delete own account
  (400). Rationale: this tool tracks *new hires* — accounts get removed once someone
  is past that window, but the record is kept for safekeeping (Jeffrey, 2026-08-31).
- `GET /archive` (Admin, Hr, paginated + `q`) — list of archived staff.
  `GET /archive/{id}` (Admin, Hr) — one record's metadata plus the parsed `snapshot`
  (`{ user, reports }`).
  `POST /archive/{id}/reinstate` (**Admin only** — HR stays read-only) — deserialises
  the snapshot into `ArchiveSnapshot(UserResponse, ReportResponse[])` and rebuilds the
  `AppUser` + every `PerformanceReport` / `MonthlyActivity` / `FocusArea`. Reuses
  `OriginalUserId` and the original report/row ids **only if still free** (else fresh
  ids, graph relinked internally); relinks `SupervisorUserId` / `ReviewedByUserId`
  only when those users still exist; **409 if the email is now taken**. Deletes the
  archive row, logs `user.reinstated`. `EntraObjectId` reset to null (re-links on next
  sign-in). Preserves the archived `CreatedAt` — see the `StampTimestamps` note below.
- `GET /analytics/hr` (Admin, Hr) — one read-only aggregate over all users + reports:
  staff/department/supervisor counts, added-in-last-30-days, staff-without-supervisor,
  archived count, report-status pipeline + this-month figures, avg overall score,
  approval rate, per-parameter averages, per-department performance, a 6-month score
  trend (by month under review), and top-performer / needs-attention lists. Backs both
  the HR overview cards and the **Analytics** page (nav item, Admin + Hr).
- `PUT /users/{id}/{role|supervisor|profile|active}` (Admin) — can't change or
  deactivate own account. `profile` includes `Email` (validated + unique, 409 on
  clash). Report DTOs (`ReportSummaryResponse` / `ReportResponse`) carry `StaffEmail`;
  the Staff List and Archive tables have an Email column.
  **Supervisor fields are Staff-only:** `supervisor` 400s if the target isn't Staff;
  `role` clears `SupervisorUserId`/`Name`/`Email` when promoting out of Staff;
  `profile` nulls the supervisor name/email for non-Staff; `POST /users` ignores them
  for non-Staff.
- `GET /reports/mine`, `GET|POST /reports/mine/{year}/{month}` — **Staff only** (403
  for Supervisor/Admin/HR; only new hires file reports). `PUT /reports/{id}` (owner,
  Draft/Declined), `POST /reports/{id}/submit` (owner). Frontend nav "My reports" and
  the `/my-reports*` routes are Staff-only too.
- `GET /reports/assigned` — always scoped to the caller's own supervisees
  (`StaffUser.SupervisorUserId == me`), any role; Admin/HR do org-wide oversight via
  `GET /reports`. Frontend nav "Assigned to me" is Supervisor-only.
  `POST /reports/{id}/appraise` (assigned supervisor or Admin, report must be Submitted)
- `GET /reports/{id}` (owner, assigned supervisor, Admin, Hr)
- `GET /reports` (Admin, Hr, paginated) — filters: `status`, `year`/`month` (exact),
  `fromYear`/`fromMonth` + `toYear`/`toMonth` (a date range by report period; either
  bound may be given alone for an open-ended range — compared as `Year*12+Month`, not
  a timestamp), `q`. `GET /reports/export` (Admin, Hr) — same filters, unpaged, as a
  downloadable CSV (`Results.File`, filename `vra-reports-<timestamp>.csv`).
- `GET /analytics/hr/export` (Admin, Hr) — **PDF only**, deliberately (Jeffrey: CSV /
  Word / Excel were tried and dropped — "keep just the pdf, cause its cleaner").
  Renders `HrFullReportData` (`Services/HrFullReport.cs`) — every analytic the app can
  produce, a superset of the on-screen Analytics page: the same summary/by-department/
  6-month-trend as `/analytics/hr` (one shared `AnalyticsEndpoints.ComputeAsync` so the
  page and the PDF can't disagree), plus report-status breakdown with percentages,
  by-supervisor performance (team size, reports, awaiting review, avg score, avg
  submit-to-decision turnaround), a 6-month new-staff trend, unfinished-work/rollover
  totals with a top-5 table, and a full performance table for every active staff
  member (not just the on-screen top/bottom 3 — everyone, scored or not). Rendered via
  MigraDoc/PDFsharp 6 (`Services/AnalyticsExports.cs`).
- `GET /activity-logs` (Admin, Hr, paginated)

## Gotchas hit and fixed

- **PDFsharp 6 has no OS font access by default** — `PdfDocumentRenderer.RenderDocument()`
  threw `InvalidOperationException: No appropriate font found for family name 'Courier
  New'` even though nothing in the document asks for Courier New (MigraDoc uses it
  internally as its own error-font fallback, so *any* unresolved family trips this,
  not just the one you set). Fixed with `Services/PdfFontResolver.cs`: an
  `IFontResolver` registered once in `Program.cs`
  (`GlobalFontSettings.FontResolver = new PdfFontResolver()`) that maps every
  requested family to one bundled TTF (Open Sans, embedded resource under
  `Assets/Fonts/`, Apache 2.0 via the `OpenSans` NuGet package) — this also makes PDF
  export render identically on Linux (Azure App Service) instead of depending on
  whatever fonts happen to be installed on the host.
- **Npgsql connect timeout on `Host=localhost`.** `localhost` resolved to IPv6 `::1`
  and the driver hung. Fixed by using `Host=127.0.0.1` in the connection strings.
- **`DbUpdateConcurrencyException` (0 rows) on saving Section B/F rows.** New child
  entities have `Id = Guid.NewGuid()` initializers; assigning them through the parent's
  navigation collection made EF treat the client-set key as an existing row and emit an
  UPDATE. Fixed by adding them explicitly via `db.Activities.Add(...)` /
  `db.FocusAreas.Add(...)` instead of reassigning `report.Activities`.
- **`Microsoft.OpenApi` 2.0.0 NU1903 warning.** Transitive of
  `Microsoft.AspNetCore.OpenApi` 10.0.2. Bumping it directly to 3.x breaks the
  source generator (`IOpenApiMediaType.Example` is read-only). Left as-is; clears when
  the framework package updates.
- **CoWork `preview_start` starts LexManager's Vite**, not this one — a cached
  session preview binding on port 5173. Run `pnpm dev` in `web/` directly for now.
- **`AppDbContext.StampTimestamps()` no longer force-stamps on insert.** On `Added` it
  sets `CreatedAt` / `UpdatedAt` only when they're still `default`, so
  `POST /archive/{id}/reinstate` can carry the archived timestamps through. `Modified`
  still always bumps `UpdatedAt`. Nothing else sets these fields explicitly, so normal
  inserts are unchanged.

## Running it

See `README.md`. Short version: create the `perftracker` role + database,
`dotnet run --project api/PerformanceTracker.Api --launch-profile http`,
then `cd web && pnpm dev`.

## Git

Not yet initialized. Follow the LexManager workflow: Jeffrey runs `git init` and all
commits/pushes from Rider or his Mac terminal, not from the CoWork sandbox (stale
`.lock` files). Private remote.

## What's built

**Session 1 (2026-08-27) — backend + working frontend.** Backend exercised end-to-end
via curl: auth, users/roles/supervisor assignment, the full report lifecycle (create →
save → submit → decline → resubmit → approve), RBAC guards, audit log. First-pass
frontend for all four roles.

**Session 2 (2026-08-31) — frontend design overhaul.** New CSS design system with
light/dark themes; role-aware Dashboard at `/overview`; every page restyled; toasts,
slide-in staff drawer, editor section-rail + progress bar + sticky action bar,
full-width readout for finalised reports. Data layer untouched. Verified in-browser
across both themes and all roles. Detail in `memory.md` session 2.

**Sessions 3–3b (2026-09-01→02) — Microsoft Entra ID sign-in, live.** Dual-mode
(config-switched); SPA sends the ID token, API validates it with plain `AddJwtBearer`
and maps it to a Staff-List row by email. Working against the real VRA tenant.

**Session 4 (2026-09-02) — rollover + per-item review.** Activity/focus rollover to
next month; focus-area Pending/Completed/Update status; hidden scores for staff on a
declined report; pre-filled supervisor marks on resubmit; per-row approve/decline with
locking. Migration `RolloverAndItemReview`.

**Session 5 (2026-09-07) — HR analytics + reinstate.** `GET /analytics/hr` behind new
HR overview cards and a new **Analytics** page (SVG score trend, parameter/department
averages, top-performer / needs-attention lists). Reinstate from the Archive
(`POST /archive/{id}/reinstate`, Admin only). No migration. Also: supervisor made
Staff-only, and a demo data set loaded (3 supervisors, 15 staff, 45 reports). Detail in
`memory.md` sessions 5 / 5b / 5c.

**Session 6 (2026-09-15) — date-range filter + a full PDF report.** `GET /reports`
gained `fromYear/fromMonth`/`toYear/toMonth` range params (either bound optional);
**All reports** got quick presets (this month / last 3 / last 6 / this year) plus
custom `<input type="month">` pickers and a live count line, with a CSV export of the
filtered list. The Analytics page's download briefly became a CSV/PDF/Word/Excel
picker, then — per Jeffrey — was simplified back to **one PDF button**, with the PDF
expanded to carry every analytic the app can produce (see `GET /analytics/hr/export`
above). `PDFsharp-MigraDoc` (MIT, picked over QuestPDF to dodge its revenue-gated
license — see Key decisions) plus a bundled Open Sans font (`Assets/Fonts/`, embedded
resource, host-independent rendering) are the only new dependencies that stuck;
`DocumentFormat.OpenXml`/`ClosedXML` were added and then removed the same day. No
migration. Detail in `memory.md` sessions 6 / 6b / 6c.

## Next (not done)

- Decide whether the **HR** role needs any write action beyond read-only (it now has
  the Analytics page + richer overview cards).
- Tests (none yet) — at least API integration tests for the lifecycle + RBAC.
- Route-level code-splitting — bundle is ~466 kB (motion + lucide).
- Production deploy: Azure App Service + Azure Database for PostgreSQL, config via
  environment variables / `appsettings.Local.json`.
- Nice-to-haves: PDF export of a completed form, email notification on submit/decline,
  month rollover reminders.
