# VRA Performance Tracker

Web app that replaces the VRA Academy **Monthly Performance Tracking Form** (a Word
document). New hires fill their monthly report online, supervisors appraise it, HR and
admins oversee everything.

- **Backend:** ASP.NET Core (.NET 9) minimal API, EF Core 9, PostgreSQL.
- **Frontend:** React 19 + TypeScript + Vite, React Router. Plain fetch, no UI library.
- **Auth:** dev cookie sign-in now; Microsoft Entra ID (Azure AD) later — see [Auth](#auth).

## Roles

| Role | Can do |
|---|---|
| **Staff** | Fill and submit their own monthly report (Sections B–F + sign-off). See supervisor's appraisal once returned. |
| **Supervisor** | See reports for the people they supervise. Complete Section G, then approve or decline with a comment. |
| **Admin** | Manage the staff list: edit staff information, set roles, assign each person's supervising user, deactivate accounts. |
| **HR** | Read-only oversight of every report, the staff list, and the activity log. |

Roles live in our database. An Admin changes them in the app — Entra only proves identity.

## Prerequisites

- .NET SDK 9
- Node 20+ and pnpm
- PostgreSQL 14+ running locally (Postgres.app, Homebrew, or the bundled `docker-compose.yml`)

## First-time setup

### 1. Database

Using an existing local PostgreSQL (e.g. Postgres.app on port 5432):

```bash
psql -d postgres -c "CREATE ROLE perftracker LOGIN PASSWORD 'perftracker';"
psql -d postgres -c "CREATE DATABASE perftracker OWNER perftracker;"
```

Or with Docker (serves PostgreSQL on **5433** to avoid clashing with a local one):

```bash
docker compose up -d
```

If you use Docker, change the port in
`api/PerformanceTracker.Api/appsettings.Development.json` from `5432` to `5433`.

### 2. API

```bash
dotnet tool restore
dotnet run --project api/PerformanceTracker.Api --launch-profile http
```

On first run in Development it applies migrations and seeds six demo users
(`admin@vra.com`, `hr@vra.com`, `supervisor@vra.com`, and three staff). The API
listens on `http://localhost:5202`.

### 3. Frontend

```bash
cd web
pnpm install
pnpm dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` to the API, so the auth cookie
stays first-party. Pick a demo user on the sign-in screen.

## Project layout

```
api/PerformanceTracker.Api/
  Domain/        entities (AppUser, PerformanceReport, MonthlyActivity, FocusArea, ActivityLogEntry, ArchivedStaffRecord)
  Data/          AppDbContext, DbSeeder, design-time factory, Migrations/
  Auth/          dev cookie auth, Roles, CurrentUser accessor
  Features/      endpoint groups: AuthEndpoints, UsersEndpoints, ReportsEndpoints, ActivityLogEndpoints, ArchiveEndpoints, AnalyticsEndpoints
  Contracts/     request/response DTOs + entity->DTO mapping
  Services/      ActivityLogger (writes the audit trail)
web/src/
  api.ts         typed fetch client
  auth.tsx       AuthProvider / useAuth
  pages/         one file per screen
```

## Data model

`PerformanceReport` is one form for one staff member for one month
(`unique (StaffUserId, Year, Month)`). Status flow:

```
Draft ──submit──> Submitted ──approve──> Approved
  ▲                    │
  └──── (edit) ───── Declined <──decline──┘
```

A declined report goes back to the staff member to edit and resubmit; resubmitting
clears the previous verdict. Section B rows are `MonthlyActivity`, Section F rows are
`FocusArea`. Every write appends an `ActivityLogEntry`.

Deleting a staff member snapshots the person plus every report they filed into an
`ArchivedStaffRecord` (jsonb) before the row is removed. An Admin can **reinstate**
one from the Archive (`POST /archive/{id}/reinstate`) — it rebuilds the user and all
their reports from that snapshot, reusing the original ids when still free, and is
blocked if the email has since been reused.

`GET /analytics/hr` (Admin + HR) is one read-only aggregate over users and reports —
staff/department counts, the report pipeline, average scores by parameter and by
department, a six-month trend, and top-performer / needs-attention lists. It backs
both the HR overview cards and the **Analytics** page. `GET /analytics/hr/export`
downloads the full report as a **PDF** — everything `/hr` shows plus by-supervisor
performance, a status breakdown, a new-staff trend, rollover stats, and every active
staff member's performance. `GET /reports/export` downloads the (optionally
date-filtered) **All reports** list as CSV. No manual setup needed for either — the
PDF package and its bundled font restore automatically with the rest of the NuGet
packages.

## Auth

Two modes, chosen by configuration:

| | Dev (default) | Entra ID |
|---|---|---|
| Trigger | `AzureAd:ClientId` **blank** on the API, `VITE_ENTRA_CLIENT_ID` **unset** on the SPA | both **set** |
| Sign-in UI | seeded user-picker | "Sign in with Microsoft" only |
| Token | `pt_session` cookie from `POST /auth/dev-login` | Entra bearer token, silently attached to every `/api` call by MSAL |

Both paths end up with the same `pt_uid` / `pt_role` claims, so `CurrentUser`, every
`RequireAuthorization()` check, and `GET /auth/me` are identical either way. The API
runs **both** schemes at once when Entra is configured, so a stale dev cookie still
works during the switch-over.

### Turning on Microsoft sign-in

**1. Azure app registration** (Entra admin center → App registrations → New):

- Name it (e.g. `VRA Performance Tracker`), single tenant.
- **Authentication** → Add platform → **Single-page application** → redirect URI
  `http://localhost:5173` (add your deployed origin later). No implicit-grant checkboxes.
- Copy the **Application (client) ID** and **Directory (tenant) ID**. That's it —
  the API validates the **ID token** (audience = the client id), so there's no
  "Expose an API" scope, no consent step.

**2. Frontend** — `web/.env.local` (see `web/.env.example`):

```
VITE_ENTRA_CLIENT_ID=<client id>
VITE_ENTRA_TENANT_ID=<tenant id>
VITE_ENTRA_REDIRECT_URI=http://localhost:5173
```

**3. API** — `api/PerformanceTracker.Api/appsettings.Local.json` (git-ignored,
loaded on top of `appsettings.json`) or env vars:

```json
{ "AzureAd": {
  "Instance": "https://login.microsoftonline.com/",
  "TenantId": "<tenant id>",
  "ClientId": "<client id>"
} }
```

Restart both. The SPA now shows only "Sign in with Microsoft"; on return it calls
`GET /auth/me`, which maps the token (by Entra object id, then by email) to a row in
the staff list. **A person must already be in the Staff List** (added by an admin) —
an unknown Microsoft account gets a "signed in, but no access" screen, not entry.
First successful sign-in back-fills that user's `EntraObjectId`.

To fall back to the dev picker, unset `VITE_ENTRA_CLIENT_ID` and clear `AzureAd:ClientId`.
A dev-only `GET /auth/whoami` echoes what the API makes of a bearer token, for
debugging.

## Migrations

```bash
dotnet tool restore
dotnet dotnet-ef migrations add <Name> --project api/PerformanceTracker.Api --output-dir Data/Migrations
```

Development applies migrations automatically on startup. For other environments run
`dotnet dotnet-ef database update`.

## Tests

None yet. See `memory.md` for the planned next steps.
