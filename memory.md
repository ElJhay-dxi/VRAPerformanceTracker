# VRA Performance Tracker — memory.md

> Project-specific memory. Read at the start of any session on this project; update at the end.
> Append dated entries (YYYY-MM-DD), edit in place when superseded, never duplicate.
> Follow the CoWork `About Me/writing-rules.md`.

## Status

Session 7 done (2026-09-23). Jeffrey had pushed the repo to GitHub
(`ElJhay-dxi/VRAPerformanceTracker`) and cloned it onto a Windows laptop to work from
there too — that machine only has the .NET 9 SDK installed and, per Jeffrey, can't
take .NET 10. Rather than block Windows-side work, **downgraded the API from .NET 10
to .NET 9**: `TargetFramework` → `net9.0`, every version-locked package to its 9.x
line (`Microsoft.AspNetCore.OpenApi` 9.0.20, `Microsoft.EntityFrameworkCore.Design`
9.0.20, `Npgsql.EntityFrameworkCore.PostgreSQL` 9.0.4), local `dotnet-ef` tool → 9.0.20.
One real compile break surfaced by the downgrade (not a workaround-required kind —
see the CS0854 gotcha in `CLAUDE.md`), fixed properly. Verified thoroughly: clean
build, ran against the existing dev DB, *and* ran migrations + seed from a throwaway
blank database to prove a fresh clone (like the Windows laptop's) migrates cleanly
under EF Core 9 — smoke-tested auth, users, reports list/export, and the analytics
PDF export afterward. Frontend untouched (Vite/React, no .NET dependency). Ready for
Jeffrey to commit and push. Not deployed.

Session 6 done (2026-09-15). `GET /reports` gained a date-range filter
(`fromYear/fromMonth`–`toYear/toMonth`, by report period, either bound optional); the
**All reports** page got quick presets (this month / last 3 / last 6 months / this
year) plus custom month pickers, a live "N reports in range" line, and a CSV export of
the filtered list (`GET /reports/export`). The Analytics "Download report" button
briefly became a CSV/PDF/Word/Excel picker, then Jeffrey asked to drop everything but
PDF and pack in "all possible information and analytics" — so it's now **one PDF
button**, and the PDF itself grew from a 5-section summary into a full report: status
breakdown with percentages, by-supervisor performance (turnaround time included),
6-month staff-growth trend, unfinished-work/rollover stats, and every active staff
member's performance (not just a top/bottom 3 sample). PDF via PDFsharp/MigraDoc
(deliberately not QuestPDF — see Key decisions in `CLAUDE.md`) with a bundled Open
Sans font for host-independent rendering; `DocumentFormat.OpenXml`/`ClosedXML` were
added for Word/Excel and then removed again the same day. No migration. Verified via
curl (structure-level) and a real browser click-through both times a format changed,
using a throwaway API + a temporarily-repointed Vite dev server on spare ports so as
not to touch Jeffrey's live `dotnet run`/`pnpm dev` — `vite.config.ts` reverted to
byte-identical afterward both times. Not committed to git. Not deployed.

Session 5 done (2026-09-07). Added the HR analytics layer: a single
`GET /analytics/hr` aggregate feeding both new HR-overview cards (new-staff count,
departments, staff without a supervisor, archived count, avg performance, approval
rate) and a new **Analytics** page (Admin + HR) — 6-month score trend as a hand-rolled
SVG line chart, averages per appraisal parameter, performance by department, and
top-performer / needs-attention lists. Also **reinstate from the Archive**
(`POST /archive/{id}/reinstate`, Admin only) — rebuilds the person and every report
they filed from the stored snapshot, reusing the original ids when free, relinking the
supervisor/reviewer when those users still exist, blocked if the email has been reused.
No migration (read-only aggregation + reuse of existing schema). Verified curl +
browser. Not committed to git. Not deployed.

Session 4 (2026-09-02): Entra ID sign-in **works against Jeffrey's real tenant**
(dual-mode; ID-token validated with plain JwtBearer, mapped to a Staff-List row by
email). Plus: Ongoing-activity + Pending-focus rollover to the next month, a
Pending/Completed/Update status on focus areas, per-row supervisor approve/decline with
locking, hidden scores for staff on a declined report, pre-filled supervisor marks on
resubmit.

## Active work

| Item | Status | Notes |
|---|---|---|
| Backend API | Built + tested via curl (session 1) | Auth, users, reports lifecycle, RBAC, audit log all pass. Unchanged in session 2. |
| Frontend | Redesigned + verified in browser (session 2) | Design system, light/dark, role dashboards, toasts, drawer, editor rail/progress. |
| Entra ID auth | **Working live** | Dual-mode. SPA sends the Entra ID token; API validates it with plain `AddJwtBearer` (audience = client id, no "Expose an API" scope) and maps to a Staff-List row by email. Verified with a real VRA account (session 3b). |
| HR role behaviour | Partly defined | Read-only everywhere + a dedicated **Analytics** page and richer overview cards (session 5). Still no write actions for HR by design. |
| HR analytics | Built + verified (session 5) | `GET /analytics/hr` — one aggregate for the overview cards and the Analytics page. Admin + HR. |
| Reinstate archived staff | Built + verified (session 5) | `POST /archive/{id}/reinstate`, Admin only. Rebuilds user + reports from the snapshot; 409 if the email was reused. |
| All-reports date filter + exports | Built + verified curl + browser (session 6) | Range filter on `GET /reports`; `GET /reports/export` (CSV, filtered list). |
| Full HR PDF report | Built + verified curl + browser (session 6c) | `GET /analytics/hr/export` — PDF only, every analytic the app tracks. See `Services/HrFullReport.cs` / `AnalyticsExports.cs`. |
| Target framework | **.NET 9** (was .NET 10 through session 6) | Downgraded session 7 so the project builds on Jeffrey's Windows laptop (.NET 9 SDK only). Build + fresh-DB migrate + smoke test all verified. |
| Git | **On GitHub** — `ElJhay-dxi/VRAPerformanceTracker` | Repo initialized and pushed since session 6; cloned onto a Windows laptop too. The downgrade in this session is uncommitted — Jeffrey to commit + push. |
| Deploy | Not started | Target: Azure App Service + Azure Database for PostgreSQL. |

## Open threads / next actions

- [ ] Entra sign-in works. Real users: `dti.apps@vra.com` Admin = Jeffrey, `hafiz.shaibu@vra.com` HR, `dennis.asiedu@vra.com` Supervisor (display name still "Yaw Owusu" — rename). The DB also holds a **demo set** loaded 2026-09-07 (3 supervisors, 15 `VRA-50xx` staff, 45 reports — see the session 5c log entry; reload via `scripts/seed_demo.py`). Replace with real recruits before go-live; fix the supervisor's display name.
- [ ] Config-drive the first seeded admin (`SeedAdmin:Email`) for a clean production deploy.
- [ ] HR now has the Analytics page + overview cards. Still open: does HR need any write/oversight action beyond read-only?
- [ ] `StampTimestamps()` now only stamps `CreatedAt`/`UpdatedAt` on Added when they're still `default` — so a reinstate can carry the original timestamps. Keep this in mind if any other insert path relies on the old always-overwrite behaviour (none currently do).
- [ ] Repo is on GitHub (`ElJhay-dxi/VRAPerformanceTracker`) and cloned onto a Windows laptop. The .NET 9 downgrade (session 7) is sitting uncommitted on the Mac — Jeffrey to commit + push, then pull on Windows.
- [ ] Add API integration tests for the report lifecycle and the RBAC guards.
- [ ] Production config: move connection string + (later) Entra secrets to env vars / `appsettings.Local.json`.
- [ ] Bundle is ~468 kB (motion + lucide). Fine for now; consider route-level code-splitting before deploy.

## Decisions & deferrals

- 2026-08-27: PostgreSQL (not SQL Server); identity from Azure AD. App-managed roles in our DB. Entra deferred, dev cookie auth built as a swappable shim. Folder `vra-performance-tracker` next to LexManager; repo holds its own CLAUDE.md + memory.md. `.slnx` solution format. Local `dotnet-ef` pinned to 10.0.11.
- 2026-08-27: Minimal APIs (not controllers) for the backend — flagged as a call Jeffrey can veto; nothing depends on it.
- 2026-08-27: Connection strings use `Host=127.0.0.1` not `localhost` (Npgsql IPv6 hang).
- 2026-08-31: Frontend design stack = `lucide-react` + `motion` + Google Fonts (Inter/Sora), hand-rolled CSS design system (no Tailwind / component lib), light + dark themes. Home route for all roles is `/overview` (role-aware Dashboard).

---

## Log

### 2026-08-27 — Session 1 (project start)

- Started the project from `PERFORMANCE TRACKING FORM (1).docx`. Read the form: Section A
  staff info, B monthly activities (7 rows), C achievements/innovation, D skills gained,
  E challenges, F next-month focus (3 rows) + staff sign-off, G supervisor appraisal
  (5 parameters rated 1–5 + comments + overall + general comments + sign-off).
- Scaffolded: .NET 10 solution (`VraPerformanceTracker.slnx`), `api/PerformanceTracker.Api`
  webapi project, `web/` Vite React-TS app, `docker-compose.yml` (Postgres 17 on 5433),
  `.claude/launch.json`, local `dotnet-tools.json` with `dotnet-ef` 10.0.11.
- Built the backend: domain entities, `AppDbContext` + `InitialSchema` migration, dev
  cookie auth + `CurrentUser` accessor, `ActivityLogger`, and four feature endpoint
  groups (Auth, Users, Reports, ActivityLog). Seed: 6 users across all roles.
- DB: created role `perftracker` + database `perftracker` in the machine's Postgres.app
  (v18, port 5432). App auto-migrates + seeds on startup in Development.
- Fixed two real bugs during bring-up: Npgsql `localhost`/IPv6 connect timeout (→
  `127.0.0.1`), and a `DbUpdateConcurrencyException` when saving Section B/F rows
  (client-set Guid keys via navigation assignment → add explicitly via DbSet). Both
  documented in `CLAUDE.md` → Gotchas.
- Verified the whole API via curl: dev-login for each role, `/auth/me`, users list,
  role change (+ self-change guard), supervisor assignment, report create → save (with
  child rows, DateOnly, enums) → submit → decline (auto overall rating 3.2) → edit →
  resubmit (verdict cleared) → approve (overall 4.4). RBAC: staff hitting `/users` and
  `/reports/assigned` both 403; editing an Approved report 403/400; admin self-demote
  400. Activity log captured all 9 events.
- Built the frontend: `api.ts` typed client, `auth.tsx` provider, router with per-role
  nav, and pages — Login (dev role picker), MyReports, ReportEditor (all form sections
  B–G, add/remove rows, save + submit, read-only when not Draft/Declined), AssignedReports,
  ReportView (staff sections readout + Section G appraisal form/readout), StaffAdmin
  (list + inline edit of profile/role/supervisor/active), AllReports (paginated),
  ActivityLog (paginated). `tsc -b` + `vite build` clean.
- Browser check (Chrome preview): signed in as Staff, Supervisor, Admin; confirmed the
  staff dashboard with Entra-mapped profile fields, the report editor showing real saved
  data and going read-only on Approved, the Section G readout, the supervisor "assigned
  to me" list with status filter, the admin staff table + edit panel, and the HR/admin
  activity log with all entries. Note: CoWork's `preview_start` launches LexManager's
  Vite on 5173 (cached binding) — used `pnpm dev` in `web/` directly.
- Left one sample report in the DB (Akosua Adjei, Aug 2026, Approved) as demo data;
  deleted the throwaway September draft.

<!-- Append new dated entries below this line -->

### 2026-08-31 — Session 2 (frontend design overhaul)

- Jeffrey asked for a much more polished, dynamic, interactive frontend. Rebuilt the
  view layer; data layer (`api.ts`, `auth.tsx`, `types.ts`) untouched.
- Added deps: `lucide-react` (icons), `motion` (framer-motion successor) for
  transitions/drawer/toasts. Google Fonts (Inter + Sora) via `index.html`.
- New design system in `src/index.css`: full token set (color, elevation, radius,
  motion), **light + dark themes** via `:root[data-theme]`, refined sidebar/topbar,
  buttons, form controls, tables, badges, stat cards, drawer, toasts, skeletons,
  timeline/feed, editor rail + progress bar, sticky action bar. Responsive: sidebar
  collapses to a hamburger drawer < 860px.
- New files: `theme.tsx` (ThemeProvider + toggle, persists to localStorage),
  `components/Toast.tsx` (ToastProvider/useToast, animated), `components/ui.tsx`
  (PageHead, Card, CardHead, StatusBadge, Stat, Loading, Empty, Segmented, Stars,
  Pager), extended `lib.tsx` (relativeTime, initials, avatarBg, useAsync now
  cancels on unmount).
- New page: `Dashboard.tsx` — role-aware overview at `/overview` (now the home route
  for every role). Staff: this-month CTA + declined alert + history timeline.
  Supervisor: review-queue + team. Admin: role counts + "staff without a supervisor"
  warning + directory. HR: report status breakdown bar + recent-activity feed. All
  counts computed client-side from existing list endpoints (no backend change).
- Every page restyled: Login (branded card, avatar rows), MyReports, ReportEditor
  (section rail, % progress, animated row add/remove, sticky Save/Submit bar,
  full-width readout when not editable), ReportView (document readout + star-rating
  appraisal form), AssignedReports + AllReports (segmented filters, icon search),
  StaffAdmin (slide-in edit drawer replacing the inline panel), ActivityLog (icon feed).
- `App.tsx`: sidebar with icons + active pill, topbar with theme toggle + user menu,
  route fade transition (`motion.div` keyed by pathname — dropped `AnimatePresence
  mode="wait"` around `<Routes>`, it stalled the outlet). Login now `navigate('/')`
  after sign-in.
- Fixes during the pass: read-only report was rendering into the 172px rail column
  (only apply `.editor-grid` when editable); ReportEditor auto-create now tolerates a
  409 (StrictMode double-invoke) by re-fetching.
- `tsc -b` + `vite build` clean (bundle ~424 kB / 131 kB gzip — motion + lucide;
  code-split later if it matters). Verified in-browser both themes, all role
  dashboards, staff drawer + toast, editor save round-trip, responsive collapse.
- Demo data now: Akosua Adjei Aug 2026 (Approved) + Oct 2026 (Draft, partly filled).

### 2026-08-31 — Session 2b ("Assigned to me" scoping)

- Jeffrey flagged that Admin sees an "Assigned to me" page even though an admin
  supervises nobody. Root cause: `GET /reports/assigned` had an Admin/HR branch that
  skipped the supervisor filter and returned every report — a mislabelled duplicate of
  "All reports".
- Fix: `/reports/assigned` now always filters to `StaffUser.SupervisorUserId == me`
  regardless of role (an admin who also supervises someone still works); role gate kept
  so a plain Staff gets 403. Frontend: "Assigned to me" nav + route are now
  Supervisor-only. Admin/HR oversight is "All reports" (filter to Submitted = the
  review queue); an Admin can still open any report there and appraise as a fallback.
- Both builds clean.

### 2026-08-31 — Session 2c (Staff List: add user + delete)

- Renamed the "Staff" page to **"Staff List"** (nav label + breadcrumb + page title;
  route stays `/staff`).
- **Add user**: new `POST /users` endpoint (Admin) + an "Add user" button opening a
  create drawer with the same columns (name, email, staff ID, department, job title,
  role, supervising user). Email required and unique (409 on dupe). New users are
  active by default.
- **Delete**: new `DELETE /users/{id}` endpoint (Admin) + a trash button per row with
  a confirm modal. **Guarded**: 409 if the person has any reports — the message tells
  the admin to deactivate instead, to keep the history. Can't delete own account
  (button disabled + backend 400). FK rules null out supervisees' `SupervisorUserId`
  and any `ReviewedByUserId` on delete; append-only activity log entries survive
  (ActorUserId is a plain Guid, no FK).
- New CSS `.modal` / `.modal-ico` for the confirm dialog.
- Verified in-browser end to end: create → 201 (row appears), delete a no-report user
  → 204 (row gone), delete a user with reports → 409 + error toast (row stays).
- Flag for Jeffrey: delete is intentionally conservative (blocked when history
  exists). Say if you want a true cascade-delete-everything instead.

### 2026-08-31 — Session 2d (delete → cascade, per Jeffrey)

- Jeffrey: this tool is only for new hires, so accounts get deleted after their
  window to make room — delete must actually delete, history included. Removed the
  report-count guard from `DELETE /users/{id}`. It now cascades (FK `ON DELETE
  CASCADE` on Reports→Users, Activities/FocusAreas→Reports; no migration needed).
  `ReviewedByUserId` / self-ref `SupervisorUserId` set null. Audit log kept; the
  `user.deleted` summary appends "with N report(s)".
- Confirm-dialog copy updated to say it deletes the account and every report they
  filed, can't be undone.
- Verified via curl + direct DB check: deleting Akosua (2 reports) → 204, user +
  both reports + their child rows gone, zero orphans, Kwame's supervisor link intact,
  2 `user.deleted` audit rows retained. Recreated Akosua as a user afterwards (her
  demo reports — Aug Approved, Oct Draft — are gone; regenerate if demo data needed).

### 2026-09-01 — Session 2e (delete → archive-then-delete, per Jeffrey)

- Jeffrey: still delete the person (free the slot) but keep their records "somewhere
  for safe keeping". Added an archive.
- Backend: new `ArchivedStaffRecord` entity (flat metadata + `SnapshotJson` jsonb of
  `{ user: UserResponse, reports: ReportResponse[] }`), migration `AddStaffArchive`.
  `DELETE /users/{id}` now snapshots the person + all their reports into that table,
  then removes the live rows (same FK cascade as before); logs `user.archived`.
  New read-only endpoints `GET /archive` (paged + `q`) and `GET /archive/{id}`
  (metadata + parsed snapshot), Admin/HR. `Contracts/Json.cs` = shared serializer
  options (camelCase + string enums) for the hand-built snapshot.
- Frontend: new "Archive" nav item (Admin/HR) → `Archive.tsx` (list) and
  `ArchiveDetail.tsx` (staff-info card + per-report accordion that reuses
  `StaffSectionsReadout` / `AppraisalReadout`). Staff List delete dialog + success
  toast reworded to say the record is copied to the Archive.
- Verified end to end: gave Akosua a submitted+approved Sept report, deleted her as
  admin → 204; `/archive` lists her (1 report, by admin@vra.com); `/archive/{id}`
  snapshot has the full report incl. Section G (ratings 4/5/4/4/5, overall 4.4,
  reviewer Yaw Owusu); DB shows the live user + activities gone, one `ArchivedStaff`
  row. Archive list + detail + report accordion all render in the browser. Recreated
  Akosua as a user after.
- No restore path (read-only archive) — add later if Jeffrey wants it.

### 2026-09-01 — Session 2f ("My reports" is Staff-only)

- Jeffrey: only new staff file reports; continuing workers (Admin, and by the same
  logic Supervisor + HR) have no personal report space. Extended his "remove it for
  Admin" to all non-Staff roles and flagged that.
- Frontend: "My reports" nav item + `/my-reports` + `/my-reports/:year/:month` routes
  are now `roles: ['Staff']`; non-Staff hitting the URL get the access-denied card.
- Backend: `GET /reports/mine`, `GET/POST /reports/mine/{y}/{m}` now 403 for non-Staff
  (`PUT /reports/{id}` and `/submit` were already ownership-gated, so covered
  transitively once nobody else can create a report).
- Deleted a stray `admin@vra.com` Sept Draft report from the dev DB (created by
  accident during earlier browser testing, before this rule). No reports in the DB now.
- Verified: admin → 403 on both mine endpoints and "Denied" on `/my-reports`; sidebar
  has no "My reports". Staff (Akosua) → still has the nav item, staff dashboard,
  `/reports/mine` 200.

### 2026-09-01 — Session 2g (Add User: free-text supervisor)

- The Add User drawer's supervisor picker was a dropdown of system accounts only.
  Added free-text "Supervisor name" + "Supervisor email" fields for when the
  supervisor isn't a system account. They disable (and a note says why) when a
  dropdown account is picked; `supervisorName`/`supervisorEmail` are sent as null in
  that case so the account's own name/email win.
- Frontend only — `POST /users` already accepted `supervisorName`/`supervisorEmail`
  and falls back to them when `supervisorUserId` is null. Verified via curl (user
  created with typed "Mr. Adjetey Sowah" / "adjetey.sowah@vra.com", no
  supervisorUserId) and in the browser (fields disable on dropdown select).

### 2026-09-01 — Session 2h (staff email in forms + columns)

- Staff email was only ever a subtitle under the name. Jeffrey wants it visible as a
  column and editable.
- Backend: `ReportSummaryResponse` + `ReportResponse` gained `StaffEmail` (from
  `r.StaffUser.Email`); `UpdateUserProfileRequest` + `PUT /users/{id}/profile` now
  take `Email` — validated (`@`, non-empty), lower-cased, uniqueness-checked (409 if
  another user has it), logged with `(email -> …)` when changed. No migration.
- Frontend: Staff List and Archive list got a dedicated **Email** column (name column
  is just the name now). Edit drawer got an editable **Email** field. My Reports
  staff-info card shows Email. All Reports / Assigned / Supervisor-queue staff cells
  show `email · staffId` as the sub-line. ReportView header meta line includes email.
  `types.ts` `ReportSummary`/`Report` carry `staffEmail`; `api.setProfile` body takes
  `email`.
- Verified via curl: email change round-trips, dept preserved, duplicate → 409,
  report summaries carry `staffEmail`. Browser: Email column renders, Edit drawer
  Email field present and editable.
- Note (again): a stale API binary was still on 5202 from a prior run and served the
  old handler — hard-killed, rebuilt, re-tested. Watch for zombie
  `PerformanceTracker.Api` procs.

### 2026-09-01 — Session 3 (Microsoft Entra ID sign-in)

- Jeffrey wants real "Sign in with Microsoft" — the only login option, redirect flow,
  map the Entra identity to our DB user. He shared his supervisor's MSAL pattern from
  another repo (msalConfig / msalInstance / MsalProvider / loginRedirect /
  Authenticated|UnauthenticatedTemplate / post-login `/me` gate / axios bearer
  interceptor / 401 -> logoutRedirect). Followed that shape.
- **Dual-mode, config-switched.** No Azure config -> dev cookie picker (unchanged).
  `AzureAd:ClientId` (API) + `VITE_ENTRA_CLIENT_ID` (SPA) set -> Entra only.
- Backend:
  - `Microsoft.Identity.Web` 4.14.2. `AuthSetup.AddAppAuth(config)` registers cookie
    always + JWT bearer (`AddMicrosoftIdentityWebApi`) when configured; default
    authz policy accepts either scheme. `AuthOptions(EntraEnabled)` singleton.
  - `EntraClaimsTransformation` (`IClaimsTransformation`, scoped): on an Entra token
    (has `tid`), look up `AppUser` by `EntraObjectId` then email, back-fill
    `EntraObjectId`, add `pt_uid` + `pt_role` (+ Email/Name) claims. Guarded by a
    `pt_mapped` marker so it runs once.
  - Renamed our claims to `pt_uid` / `pt_role` (`Auth/AppClaims.cs`) so they never
    collide with the token's own `nameidentifier`. `CurrentUser`, dev-login, the
    transformation all updated. Nothing else changed — role checks, `/auth/me`, etc.
    are identical.
  - `GET /auth/config` (anon) -> `{ mode }`. `GET /auth/me` now returns **403** (not
    401) for a valid token with no active matching user, so the SPA shows an access-
    denied screen instead of looping back to sign-in.
  - `appsettings.json` gained an empty `AzureAd` section; real values go in
    `appsettings.Local.json` / env.
- Frontend:
  - `@azure/msal-browser` + `@azure/msal-react` (v5). `src/auth/entra.ts` = config +
    singleton + `initEntra()` (initialize + handleRedirectPromise), called in
    `main.tsx` before render.
  - `auth.tsx` split: shared `AuthContext`/`useAuth` + `DevAuthProvider`.
    `authEntra.tsx` = `EntraAuthProvider` (uses `useMsal`/`useIsAuthenticated`,
    registers a token getter + 401 handler on `api.ts`, fetches `/auth/me` once
    authenticated, exposes `mode`, `accessDenied`). `App.tsx` `AuthLayer` picks
    provider by `entraEnabled` and wraps `MsalProvider` when Entra.
  - `api.ts`: `setTokenGetter` / `setUnauthorizedHandler`; bearer attached per call;
    non-`/auth/me` 401 -> `logoutRedirect`.
  - `Login.tsx` split into `DevLogin` (picker) and `EntraLogin` ("Sign in with
    Microsoft" button + MS logo; "signed in, no access" panel with "try another
    account" when `accessDenied`).
  - `web/.env.example` documents the four `VITE_ENTRA_*` vars.
- Verified: **dev mode unchanged** (curl: `/auth/config` -> dev, dev-login + role-
  gated calls all pass; browser: full login -> admin dashboard). **Entra mode boots**
  with fake env vars — MSAL initialises, no crash, login screen shows only the
  Microsoft button, no dev picker, no `/auth/me` calls pre-sign-in. Removed the fake
  `.env.local` after. Not tested against a real tenant (no app registration yet).
- Both builds clean. Bundle ~443 kB / 135 kB gz (+~6 kB gz for MSAL).
- Next: Jeffrey creates the Azure SPA app registration (steps in README), fills the
  config, and we do a live sign-in pass together — expect small fixes (scope/audience,
  redirect URI, exact claim names from the real token).
- Not relevant here: the excerpt's note about "offline-first hybrid auth (bcrypt
  cache, offline-sync)" is from a different project; this tool has no such requirement.

### 2026-09-02 — Session 3b (Entra live bring-up + fixes)

- Jeffrey made the Azure SPA app registration and did a live sign-in. Hit and fixed,
  in order:
  - `AADSTS50011` redirect mismatch → he added `http://localhost:5173` under a
    **Single-page application** platform.
  - `/auth/me` 401 with a valid token. Root cause 1: `Microsoft.Identity.Web`
    (`AddMicrosoftIdentityWebApi`) won't validate an **ID token**, and we deliberately
    skipped the "Expose an API" scope. Swapped it for plain `AddJwtBearer` with
    `Authority = login.microsoftonline.com/{tid}/v2.0`, `ValidAudiences =
    {clientId, api://clientId}`, `MapInboundClaims = false`. Root cause 2: `/auth/me`
    is an **anonymous** endpoint, so ASP.NET never ran the (non-default) Bearer scheme
    for it → added `.RequireAuthorization()` to `/auth/me`.
  - Added `Program.cs` load of `appsettings.Local.json` (git-ignored) — it isn't a
    default config source. Real `AzureAd:{TenantId,ClientId}` live there +
    `web/.env.local`; the committed `appsettings.json` keeps them blank.
  - Kept a dev-only `GET /auth/whoami` that echoes the Bearer validation result +
    claims (handy for the next auth issue). Diagnostic `JwtBearerEvents` log
    `>>> ENTRA TOKEN OK/REJECTED` on the API console.
- Real users now in the DB (Jeffrey Admin `dti.apps@vra.com`, Hafiz HR, Dennis
  Supervisor, Elijah Staff). Setup steps in `README.md` → Auth updated to the
  ID-token / no-scope flow.

### 2026-09-02 — Session 4 (rollover + per-item review)

Five linked changes; migration `RolloverAndItemReview` (adds enum defaults `"Pending"`
by hand — EF's `""` default would be an invalid enum on existing rows).

1. **Ongoing activities roll forward.** `POST /reports/mine/{y}/{m}` copies every
   still-`Ongoing` Section B row from the most recent earlier report into the new one
   (whole row + `RolledOver=true`). Keeps chaining until marked Completed.
2. **Focus-area status + rollover.** `FocusArea.Status` = Pending / Completed / Update
   (new `FocusStatus` enum, string col). Pending + Update roll forward; Completed
   drops. Staff pick it in a new column in Section F.
3. **Declined report hides scores from staff.** `ToResponse(hideScores)` /
   `ToSummary(hideScores)` null the 5 ratings + overall when the viewer is the staff
   owner and status is Declined. Frontend `AppraisalReadout` also drops the Rating
   column when `hideScores`. Comments stay visible.
4. **Supervisor's prior marks persist on resubmit.** Ratings were already kept across
   a decline; now the `ReportView` appraise form *seeds* from `report.*Rating` /
   `*Comment` (was starting blank).
5. **Per-row approve/decline.** `MonthlyActivity` / `FocusArea` gained `ReviewStatus`
   + `ReviewComment`. Supervisor marks each B/F row in `StaffSectionsReadout` (inline
   segmented Approve/Decline + comment when appraising). `appraise` takes
   `ActivityReviews`/`FocusReviews`. On decline, only `Declined` rows are editable by
   staff; Approved + untouched-Pending are locked (server-enforced in the PUT merge,
   UI-enforced with `disabled` + an "approved"/"needs work" tag). Approving the whole
   report locks every row.

- PUT rewritten from wholesale delete-recreate to **merge by row Id** (`MergeActivities`
  / `MergeFocusAreas`). Gotcha found + fixed: EF relationship-fixup pushes newly
  `Add`ed rows into `report.Activities`, so the cleanup loop must iterate a snapshot
  taken *before* the adds, or it deletes the rows it just created.
- `SaveReportBody` rows now carry `id`; focus rows carry `status`. New-row temp ids
  are `tmp-…` and sent as `null`.
- Verified end to end via curl (create→fill→submit→per-row decline→locked-row edit
  rejected→resubmit resets declined rows→final approve locks all→next month rolls the
  Ongoing/Pending items) and in the browser (staff: approved row disabled + tag,
  declined row editable, Section G Rating column gone; supervisor: inline
  Approve/Decline per row pre-filled from last round, Section G stars pre-filled 4/3/3/4/4).
- Bundle jumped to ~696 kB / 199 kB gz (vite 8 reporter counts differently; still
  fine, code-split before deploy).

### 2026-09-07 — Session 5 (HR analytics + overview cards + reinstate)

Three linked changes. No migration.

1. **`GET /analytics/hr`** (`Features/AnalyticsEndpoints.cs`, Admin + HR) — one
   aggregate computed once and used by two screens. Pulls a light projection of all
   users + all reports (dataset is small — new hires at one org) and computes in
   memory: active-staff count, added-in-last-30-days, staff-without-supervisor,
   supervisor count, department list, archived count, report-status pipeline +
   this-month figures, avg overall score, approval rate, per-parameter averages,
   per-department performance, a 6-month score trend (by month under review), and
   top-performer / needs-attention lists (needs-attention = any decline or avg < 3).
2. **HR overview cards** (`Dashboard.tsx` `HrHome`) — dropped the four
   `allReports({status})` count calls, now one `api.analyticsHr()`. Two rows of stat
   cards (new-staff/departments/no-supervisor/avg-performance, then
   totals/awaiting/this-month/supervisors+archived), a By-department table, and
   top/needs-attention lists above the activity feed.
3. **Analytics page** (`pages/Analytics.tsx`, nav item + route `['Admin','Hr']`) —
   stat cards, a **hand-rolled SVG line chart** for the 6-month trend (no chart lib,
   keeps the bundle flat), parameter-average bars, a sorted department table, and the
   two staff lists. Empty state until a report is finalised.
4. **Reinstate** (`POST /archive/{id}/reinstate` in `ArchiveEndpoints.cs`, Admin
   only) — deserialize `SnapshotJson` into `ArchiveSnapshot(UserResponse, List<ReportResponse>)`,
   recreate the `AppUser` + every `PerformanceReport` / `MonthlyActivity` / `FocusArea`.
   Reuses `OriginalUserId` and the original report/row ids **only if still free**,
   otherwise fresh ids with the graph relinked internally. Relinks `SupervisorUserId`
   / `ReviewedByUserId` only when those users still exist. **409 if the email is now
   taken.** Deletes the archive row, logs `user.reinstated`. `EntraObjectId` reset to
   null (they re-link on next sign-in).
   - `AppDbContext.StampTimestamps()` changed: on `Added`, only stamp
     `CreatedAt`/`UpdatedAt` when still `default`, so reinstate preserves the archived
     timestamps. `Modified` still always bumps `UpdatedAt`.
   - Frontend: `api.reinstateArchive(id)`, Reinstate button + confirm modal on both
     `Archive.tsx` (per row) and `ArchiveDetail.tsx` (header), Admin only — HR sees the
     plain row arrow.
- Verified via curl: analytics aggregate correct against seed data; reinstated Kojo
  (0 reports) and Akosua (2 reports, supervisor relinked, `CreatedAt` preserved);
  second Akosua archive record (same email) correctly 409s. Browser: HR overview cards
  + Analytics page (trend chart, parameter bars, department table, top/needs lists)
  render; HR does not see the Reinstate button. Test reinstates re-archived afterwards.
- Frontend build clean; bundle 462 kB / 140 kB gz (lucide-react v1 tree-shakes better
  than the v0 line noted last session).
- Follow-up same day: **top-performer / needs-attention lists trimmed from 5 to 3**
  (`Take(3)` on both, since they render as a side-by-side pair).

### 2026-09-07 — Session 5b (supervisor is Staff-only)

Jeffrey: "Admin, HR and Supervisors can't have Supervisors because they are the ones
running the app. The app is for new recruits only."

- `SupervisorUserId` / `SupervisorName` / `SupervisorEmail` are now only ever set on
  `Role == Staff`. Enforced in `UsersEndpoints.cs`:
  - `POST /users` — supervisor fields ignored (forced null) when `Role != Staff`.
  - `PUT /users/{id}/supervisor` — **400** if the target isn't Staff.
  - `PUT /users/{id}/role` — clears the three supervisor fields when the new role
    isn't Staff (promoting a recruit drops their supervisor link).
  - `PUT /users/{id}/profile` — nulls supervisor name/email for non-Staff.
- Migration `NormalizeNonStaffSupervisors` — **data-only**, empty model diff, a single
  `UPDATE "Users" SET supervisor cols = NULL WHERE "Role" <> 'Staff'`. Cleared the
  real rows (Jeffrey's Admin account had Yaw Owusu set).
- Frontend `StaffAdmin.tsx` — the Add-user drawer hides the whole Supervisor block
  unless role is Staff (shows a one-line note instead); the Edit drawer hides the
  supervisor-name/email fields and the Supervising-user assign section for non-Staff.
- Verified curl: migration cleared Admin/Supervisor/HR rows; `supervisor` endpoint
  400s for an HR target; creating an HR with a `supervisorUserId` ignores it; creating
  a Staff with one still works; promoting Staff→Admin clears the fields; profile update
  on a non-Staff user can't re-set them. Temp test users cleaned up.
- Note: the old seed staff (`akosua/efua/kwame@vra.com`, plus `elijah`) were deleted
  from the running app by Jeffrey mid-session (archived, as designed) — unrelated to
  this change. Active users now: Jeffrey (Admin), Hafiz (Hr), Yaw Owusu (Supervisor).

### 2026-09-07 — Session 5c (demo data loaded into the dev DB)

Jeffrey asked for a populated staff list to demo/test with. Loaded via
`scripts/seed_demo.py` (dev-cookie auth, one-shot script):

- **3 supervisors**: Yaw Owusu (existing) + Abena Owusu-Ansah (`abena.owusuansah@vra.com`,
  VRA-0011) + Kwesi Appiah (`kwesi.appiah@vra.com`, VRA-0012).
- **15 staff**, `VRA-5001..5015`, emails `first.last@vra.com`, 6 DTI + 6 Finance +
  3 MIS. Each supervisor has exactly 5 (2 DTI, 2 Finance, 1 MIS).
- **45 reports** — 3 per staff, Jul/Aug/Sep 2026: **July Approved**, **August fully
  Declined** (all activity + focus rows marked Declined so the staff can edit
  everything), **September part-approved** (activities 1-2 + focus 1 Approved and
  locked; activities 3-4 + focus 2 Declined with per-row comments; report status
  Declined). Appraised by each staff member's own assigned supervisor.
- Rating spread added afterwards with a direct SQL `UPDATE` on the rating columns
  (per-staff calibre from an md5 of the user id, correlated across their 3 months,
  Approved reports centred higher) — statuses, per-row verdicts and comments left
  untouched. Analytics now shows real variation: overall ~3.25, DTI 3.34 / Finance
  3.11 / MIS 3.33, trend 4.05 → 2.71 → 2.99, distinct top-3 / needs-attention lists.
- To wipe and reload: delete the 15 `VRA-50xx` users + 2 new supervisors from the
  Staff List (archives them) and re-run the script, or reset the DB.

### 2026-09-15 — Session 6 (date-range filter + CSV exports)

Jeffrey: "anywhere with an 'all reports' should have a date filter for analytic
purposes so we can see the number of reports within a current month, or even within a
certain range. There should also be a way to download the analytics into a report."

- **`GET /reports` date-range filter** (`ReportsEndpoints.cs`) — new optional
  `fromYear`/`fromMonth`/`toYear`/`toMonth`, alongside the existing exact `year`/`month`.
  Compared as `Year*12+Month` against the bound's own index (not a timestamp column,
  since a report's date *is* its Year/Month), so either bound can be given alone for
  an open-ended range. Filter-building factored into `FilterReports(...)`, shared with
  the new export endpoint so the two can't drift.
- **`GET /reports/export`** (Admin, Hr) — same filters, unpaged, written as CSV via
  `Results.File` (sets `Content-Disposition: attachment` with a timestamped filename
  automatically).
- **All reports page** (`pages/AllReports.tsx`) — quick-preset buttons (This month /
  Last 3 months / Last 6 months / This year / All time, computed client-side) plus two
  native `<input type="month">` pickers for a custom range; a live
  "N reports in range …" line above the table; an "Export CSV" button in the page
  header.
- **`GET /analytics/hr/export`** (Admin, Hr) — the `/analytics/hr` aggregate, refactored
  into a shared `ComputeAsync(db)` so the page and the download can never disagree,
  written as a multi-section CSV (Summary, By department, 6-month trend, Top
  performers, Needs attention). "Download report" button added to the Analytics page
  header.
- **`Services/Csv.cs`** — a ~15-line hand-rolled CSV writer (comma/quote/newline
  escaping only). No CsvHelper or similar — the exports are small, controlled tables,
  not worth a dependency.
- **`web/src/api.ts`** — new `downloadFile(path, fallbackName)` helper: fetches with
  the same bearer-token attachment as `request()`, reads the filename off
  `Content-Disposition` if the browser exposes it, and triggers the save via a
  blob-URL `<a download>` click (a plain `<a href>` can't carry the Entra bearer
  token on navigation, so a real request + blob download was needed). `ReportsQuery`
  type + `reportsQs()` shared between `allReports` and the new `exportReportsCsv`.
- Verified via curl against a **throwaway API instance on port 5299**
  (`ASPNETCORE_URLS=http://127.0.0.1:5299 dotnet run --no-launch-profile`) — Jeffrey
  had his own `dotnet run` live on 5202 at the time (from the terminal, after last
  session's port clash) and it was left completely alone. Confirmed: unfiltered total
  45, Sep-2026-only 15, Jul+Aug 30, open-ended "from Sep 2026" 15; both CSV exports
  download with correct `Content-Disposition` filenames and correct section content
  (spot-checked against the session 5c demo data numbers). `tsc -b && vite build`
  clean. Not click-tested in the browser that session, to avoid touching Jeffrey's live
  dev server — done in the same-day follow-up below instead.

### 2026-09-15 — Session 6b (analytics: PDF / Word / Excel, not just CSV)

Jeffrey: "I need more options for the analytics besides CSV." Asked which — he picked
PDF, then Word + Excel ("Could I get both Word and Excel").

- **Three new backend packages**, deliberately not QuestPDF: its Community (free)
  license only covers orgs under US$1M annual revenue, and VRA is a state utility well
  above that — using it without a paid license would be a real compliance problem for
  Jeffrey's employer. Used **PDFsharp-MigraDoc** 6.2.4 (MIT, no revenue gate) for PDF
  instead, **DocumentFormat.OpenXml** 3.5.1 (Microsoft's own, MIT) for Word, and
  **ClosedXML** 0.105.1 (MIT) for Excel.
- **`Services/AnalyticsExports.cs`** — `ToCsv` (moved out of the endpoint), `ToPdf`,
  `ToDocx`, `ToXlsx`, all reading the same `HrAnalyticsResponse` and the same
  `SummaryRows()` helper so the four formats can't disagree with each other or the
  page. PDF built with MigraDoc's document-object-model API (sections, styled
  paragraphs, bordered tables) rendered to PDF via PDFsharp — not raw `XGraphics`
  drawing. Word built with raw OOXML (`W.Paragraph`/`W.Table`/... aliased from
  `DocumentFormat.OpenXml.Wordprocessing` to dodge a namespace clash with MigraDoc's
  own `Paragraph`/`Table` types in the same file). Excel gets one worksheet per
  section (Summary, By department, 6-month trend, Top performers, Needs attention),
  bold header row, auto-fit columns.
- **Font gotcha, fixed** — see `CLAUDE.md` → Gotchas. PDFsharp 6 has no OS font access
  by default; even though the doc only asked for one font, `RenderDocument()` crashed
  resolving MigraDoc's *internal* Courier-New error-font fallback. Fixed with an
  `IFontResolver` (`Services/PdfFontResolver.cs`) that maps every requested family to
  one bundled Open Sans TTF (Apache 2.0, via the `OpenSans` NuGet package, copied into
  `Assets/Fonts/` and embedded as a resource), registered once in `Program.cs`. Also
  means PDF export renders identically on Linux (the eventual Azure App Service host)
  instead of depending on whatever's installed there.
- **`GET /analytics/hr/export`** now takes `?format=csv|pdf|docx|xlsx` (default csv,
  400 on anything else) instead of being CSV-only.
- **Frontend** — the Analytics "Download report" button became a dropdown (reused the
  existing `.usermenu`/`.menu` popover pattern from the user-account menu): PDF / Word
  (.docx) / Excel (.xlsx) / CSV, each with an icon and a one-line hint, closes on
  outside-click, button shows "Exporting PDF…" etc. while in flight. `api.ts`
  `exportAnalyticsHr(format)` replaces the old CSV-only `exportAnalyticsHrCsv`.
- **Verified thoroughly** — curl: all four formats download with the right
  `Content-Type`/filename; `file` confirms real PDF 1.7 / Word 2007+ / Excel 2007+
  containers; unzipped the docx/xlsx and grepped the XML for expected text; read the
  PDF back through the Read tool and visually confirmed a clean one-page layout with
  all five sections and no missing-glyph boxes. Browser: temporarily repointed
  `vite.config.ts`'s proxy at the throwaway API and ran a second Vite instance on a
  spare port (5299 / 5179) rather than touch Jeffrey's live `dotnet run`/`pnpm dev`;
  clicked the dropdown open, downloaded all four formats for real (network tab showed
  four 200s), watched the button label update and reset; reverted `vite.config.ts` to
  byte-identical afterward (`diff` confirmed) and killed only the throwaway processes.
  Both projects build clean.

### 2026-09-15 — Session 6c (PDF only, and make it comprehensive)

Jeffrey: "let's get rid of the csv files and keep just the pdf, cause its cleaner and
it's exactly what I need. Add all possible information and analytics that can be
gotten from the app to it."

- **Format picker removed.** `GET /analytics/hr/export` no longer takes `?format=` —
  always PDF. `ToCsv`/`ToDocx`/`ToXlsx` deleted from `AnalyticsExports.cs`;
  `ClosedXML` and `DocumentFormat.OpenXml` package references removed (`dotnet remove
  package`). `Services/Csv.cs` stays — `GET /reports/export` (the All-reports list
  export) still uses it and wasn't in scope here. Frontend: the dropdown menu
  (`DownloadMenu`, added session 6b) replaced with a single
  `<button>Download full report (PDF)</button>`; `api.ts`'s `exportAnalyticsHr(format)`
  simplified to `exportAnalyticsHrPdf()`.
- **New `Services/HrFullReport.cs`** — `HrFullReportData` + a `ComputeAsync(db)` that
  wraps the existing `AnalyticsEndpoints.ComputeAsync` (made `internal` so this file
  can call it — the JSON `/hr` endpoint and the PDF still can't disagree on the
  numbers they share) and adds everything the on-screen page doesn't show:
  - **By supervisor** — team size, total reports, awaiting-review count, avg team
    score, avg turnaround (submit → decision, in days) per supervisor.
  - **Report status breakdown** — Draft/Submitted/Approved/Declined as counts *and*
    percentages, plus the org-wide avg turnaround.
  - **New-staff trend** — 6 months of hires added, same shape as the score trend.
  - **Rollover / unfinished work** — total activities + focus areas still marked
    `RolledOver` org-wide, plus a top-5 "who's carrying the most forward" table
    (two small queries against `Activities`/`FocusAreas`, merged in memory).
  - **Full staff table** — every active Staff-role person, not just the top/needs-
    attention 3 the dashboard cards sample — reports filed (any status), reviewed,
    declined, avg score, latest score, department, supervisor. Staff with zero scored
    reports still show up (with `—`), which the old top-3/needs-attention lists never
    surfaced.
- **`AnalyticsExports.ToPdf`** now takes `HrFullReportData` instead of
  `HrAnalyticsResponse` and renders 8 sections across what's usually 2 pages (was 1
  section-light page). Top-performers/needs-attention tables dropped in favour of the
  one full sorted staff table — redundant otherwise.
- Verified: curl (`file` confirms `PDF document, version 1.7, 2 pages`; old
  `?format=csv` query param now harmlessly ignored, still returns the PDF), then read
  the actual PDF back through the file tool and checked every section — data matched
  the demo set, no missing-glyph boxes, the "Staff performance" table correctly
  listed all 15 with zero missing. One column-width tweak after the first look
  (Reviewed column was cramped). Same throwaway-port pattern as 6b (API on 5299) to
  avoid touching Jeffrey's dev servers — his API happened to already be stopped this
  time, his Vite untouched either way. Sent the actual PDF to Jeffrey via SendUserFile
  so he could look at it directly rather than take a description on faith. Both
  projects build clean.

### 2026-09-23 — Session 7 (downgrade to .NET 9 for the Windows laptop)

Jeffrey pushed the repo to GitHub (`ElJhay-dxi/VRAPerformanceTracker`) between
sessions and cloned it onto a Windows laptop (`elijah.agyei`'s machine) to work from
there too — `dotnet run` failed there with `NETSDK1045: The current .NET SDK does not
support targeting .NET 10.0`, because that machine only has .NET SDK `9.0.318`
installed. Jeffrey can't install .NET 10 there ("for certain reasons" — sounded like a
locked-down work machine, not a technical conflict; confirmed installing a newer SDK
alongside an older one is safe and doesn't touch other projects, since the SDK used is
chosen per-project by `TargetFramework`, not machine-wide — but that didn't change his
constraint). Asked him to downgrade the project instead of the laptop.

- **`PerformanceTracker.Api.csproj`** — `TargetFramework` → `net9.0`.
  `Microsoft.AspNetCore.OpenApi` 10.0.2 → **9.0.20**,
  `Microsoft.EntityFrameworkCore.Design` 10.0.11 → **9.0.20**,
  `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 → **9.0.4** (checked NuGet's flat
  container index directly for each package's latest stable 9.x — `dotnet package
  search` only surfaces the newest version overall, not per-major). Left
  `Microsoft.Identity.Web`, `PDFsharp-MigraDoc`, `OpenSans` untouched — none are
  framework-version-locked.
- **`dotnet-tools.json`** — local `dotnet-ef` pin 10.0.11 → **9.0.20**, matching the
  EF Core package version (a mismatched `dotnet-ef` is a classic source of confusing
  design-time errors).
- **Real compile break, not a version-number formality**: three call sites —
  `Features/ReportsEndpoints.cs` — did `.Select(r => r.ToSummary())` inside an
  `IQueryable<PerformanceReport>` pipeline. `ToSummary(bool hideScores = false)`'s
  default argument, filled in inside a lambda that compiles to an `Expression<Func<>>`
  for EF Core, is a **CS0854** error under C# 13 (net9.0's default `LangVersion`) but
  compiled silently under C# 14 (net10.0's default) — the .NET 10 project never hit
  this. Fixed by making the default explicit: `.Select(r => r.ToSummary(false))` at
  all three sites (`/assigned`, `/` admin list, `/export`) — zero behavior change,
  `false` was already the implied default. Full detail + the general lesson (always
  pass every argument explicitly to a defaulted extension method inside an EF Core
  query) is in `CLAUDE.md` → Gotchas.
- **Verified properly, not just "it compiled"**:
  1. `dotnet build` clean, 0 errors.
  2. Ran against the *existing* dev database — migrations reported already up to date,
     server started, smoke-tested `/health`, dev-login, `/users`, `/reports` (exercises
     the fixed `.ToSummary(false)` calls), `/reports/export` CSV, `/analytics/hr`, and
     the PDF export — all 200s, correct data.
  3. The more important check: created a **throwaway blank database**
     (`perftracker_net9check`) and pointed the app at it via an env-var connection
     string override, to prove a *fresh clone* — exactly what the Windows laptop just
     did — migrates cleanly under EF Core 9 tooling rather than only working because
     the existing dev DB's schema predates the downgrade. All 4 migrations
     (`InitialSchema` → `AddStaffArchive` → `RolloverAndItemReview` →
     `NormalizeNonStaffSupervisors`) applied in order from nothing, `DbSeeder` seeded
     the usual 6 demo users, health check passed. Dropped the throwaway DB afterward.
  4. Frontend rebuilt too (sanity check only — Vite/React has no .NET dependency, was
     never going to be affected).
- **This Mac had no .NET 9 SDK either** (only 6/7/8/10 — checked `dotnet --list-sdks`
  before touching anything). Build and run both worked anyway via .NET 10 runtime
  roll-forward, but flagged it as worth installing properly. Jeffrey ran
  `brew install --cask dotnet-sdk@9` himself in his own terminal the same session
  (the cask installer needs a `sudo` password the sandbox can't supply) — resolved to
  `9.0.318`, the exact same patch as the Windows laptop. Rebuilt and re-ran afterward
  to confirm it's genuinely on the real SDK now, not just rolling forward. Resolved.
- Did not touch git — no `git add`/`commit`/`push` run from here, per the standing
  rule. Everything above is sitting as uncommitted changes on the Mac, ready for
  Jeffrey to commit and push himself, then pull on the Windows laptop.

## Follow-ups for next session

- [ ] Confirm Jeffrey successfully committed/pushed the .NET 9 downgrade and that
  `dotnet run` now works clean on the Windows laptop.
