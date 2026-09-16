import type {
  ActivityLogItem, ArchivedStaffDetail, ArchivedStaffSummary, HrAnalytics, Me, Paged, Report,
  ReportStatus, ReportSummary, Role, UserItem,
} from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// In Entra mode the auth layer registers these: one to mint a bearer token per call,
// one to handle a hard 401 (token rejected -> bounce to Microsoft sign-out).
let tokenGetter: (() => Promise<string | null>) | null = null
let onUnauthorized: (() => void) | null = null
export const setTokenGetter = (fn: (() => Promise<string | null>) | null) => { tokenGetter = fn }
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) }
  if (init?.body) headers['Content-Type'] = 'application/json'
  if (tokenGetter) {
    const token = await tokenGetter()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`/api${path}`, { credentials: 'include', ...init, headers })

  if (res.status === 401 && onUnauthorized && path !== '/auth/me') onUnauthorized()
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const body = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    const msg = body?.message ?? body?.title ?? `Request failed (${res.status})`
    throw new ApiError(res.status, msg)
  }
  return body as T
}

const post = (path: string, data?: unknown) =>
  request(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) })
const put = (path: string, data: unknown) =>
  request(path, { method: 'PUT', body: JSON.stringify(data) })
const del = (path: string) => request(path, { method: 'DELETE' })

// File downloads need the same bearer-token attachment as `request`, but return a
// blob instead of parsed JSON, and read the filename the server suggested.
function filenameFrom(res: Response, fallback: string) {
  const m = /filename="?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') || '')
  return m?.[1] || fallback
}

async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const headers: Record<string, string> = {}
  if (tokenGetter) {
    const token = await tokenGetter()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`/api${path}`, { credentials: 'include', headers })
  if (res.status === 401 && onUnauthorized) onUnauthorized()
  if (!res.ok) {
    const text = await res.text()
    const body = text ? JSON.parse(text) : undefined
    throw new ApiError(res.status, body?.message ?? body?.title ?? `Request failed (${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filenameFrom(res, fallbackName)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export interface CreateUserBody {
  email: string
  fullName: string
  staffId?: string | null
  department?: string | null
  jobTitle?: string | null
  supervisorName?: string | null
  supervisorEmail?: string | null
  role: Role
  supervisorUserId?: string | null
}

export const api = {
  // auth
  me: () => request<Me>('/auth/me'),
  devUsers: () => request<UserItem[]>('/auth/dev-users'),
  devLogin: (email: string) => post('/auth/dev-login', { email }) as Promise<Me>,
  logout: () => post('/auth/logout'),

  // users
  users: (params: { role?: Role; q?: string; active?: boolean } = {}) => {
    const qs = new URLSearchParams()
    if (params.role) qs.set('role', params.role)
    if (params.q) qs.set('q', params.q)
    if (params.active !== undefined) qs.set('active', String(params.active))
    const s = qs.toString()
    return request<UserItem[]>(`/users/${s ? `?${s}` : ''}`)
  },
  supervisees: () => request<UserItem[]>('/users/me/supervisees'),
  createUser: (data: CreateUserBody) => post('/users/', data) as Promise<UserItem>,
  deleteUser: (id: string) => del(`/users/${id}`),
  setRole: (id: string, role: Role) => put(`/users/${id}/role`, { role }) as Promise<UserItem>,
  setSupervisor: (id: string, supervisorUserId: string | null, supervisorEmail?: string | null) =>
    put(`/users/${id}/supervisor`, { supervisorUserId, supervisorEmail }) as Promise<UserItem>,
  setProfile: (id: string, data: {
    fullName: string; email: string; staffId?: string | null; department?: string | null;
    jobTitle?: string | null; supervisorName?: string | null; supervisorEmail?: string | null
  }) => put(`/users/${id}/profile`, data) as Promise<UserItem>,
  setActive: (id: string, isActive: boolean) =>
    put(`/users/${id}/active`, { isActive }) as Promise<UserItem>,

  // reports
  myReports: () => request<ReportSummary[]>('/reports/mine'),
  myReport: (year: number, month: number) =>
    request<Report | null>(`/reports/mine/${year}/${month}`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }),
  createMyReport: (year: number, month: number) =>
    post(`/reports/mine/${year}/${month}`) as Promise<Report>,
  saveReport: (id: string, data: SaveReportBody) => put(`/reports/${id}`, data) as Promise<Report>,
  submitReport: (id: string) => post(`/reports/${id}/submit`) as Promise<Report>,
  report: (id: string) => request<Report>(`/reports/${id}`),
  assignedReports: (params: { status?: ReportStatus; q?: string } = {}) => {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.q) qs.set('q', params.q)
    const s = qs.toString()
    return request<ReportSummary[]>(`/reports/assigned${s ? `?${s}` : ''}`)
  },
  appraiseReport: (id: string, data: AppraiseBody) =>
    post(`/reports/${id}/appraise`, data) as Promise<Report>,
  allReports: (params: ReportsQuery & { page?: number } = {}) => {
    const qs = reportsQs(params)
    qs.set('page', String(params.page ?? 1))
    return request<Paged<ReportSummary>>(`/reports/?${qs.toString()}`)
  },
  exportReportsCsv: (params: ReportsQuery = {}) =>
    downloadFile(`/reports/export?${reportsQs(params).toString()}`, 'vra-reports.csv'),

  // activity log
  activityLog: (params: { q?: string; page?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    qs.set('page', String(params.page ?? 1))
    return request<Paged<ActivityLogItem>>(`/activity-logs/?${qs.toString()}`)
  },

  // archived staff
  archive: (params: { q?: string; page?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    qs.set('page', String(params.page ?? 1))
    return request<Paged<ArchivedStaffSummary>>(`/archive/?${qs.toString()}`)
  },
  archiveRecord: (id: string) => request<ArchivedStaffDetail>(`/archive/${id}`),
  reinstateArchive: (id: string) => post(`/archive/${id}/reinstate`) as Promise<UserItem>,

  // analytics
  analyticsHr: () => request<HrAnalytics>('/analytics/hr'),
  exportAnalyticsHrPdf: () => downloadFile('/analytics/hr/export', 'vra-hr-analytics.pdf'),
}

export interface ReportsQuery {
  status?: ReportStatus
  q?: string
  /** Both fields of a bound are required together; either bound may be omitted for an open-ended range. */
  fromYear?: number
  fromMonth?: number
  toYear?: number
  toMonth?: number
}

function reportsQs(params: ReportsQuery) {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.q) qs.set('q', params.q)
  if (params.fromYear && params.fromMonth) {
    qs.set('fromYear', String(params.fromYear))
    qs.set('fromMonth', String(params.fromMonth))
  }
  if (params.toYear && params.toMonth) {
    qs.set('toYear', String(params.toYear))
    qs.set('toMonth', String(params.toMonth))
  }
  return qs
}

export interface SaveReportBody {
  keyAchievements?: string | null
  innovations?: string | null
  newSkills?: string | null
  knowledgeGained?: string | null
  toolsLearned?: string | null
  keyChallenges?: string | null
  supportRequired?: string | null
  staffSignatureName?: string | null
  staffSignOffDate?: string | null
  activities: {
    id?: string | null; lineNo: number; keyActivity?: string | null
    descriptionOfWork?: string | null; outputResult?: string | null; status?: string | null
  }[]
  focusAreas: {
    id?: string | null; lineNo: number; plannedActivity?: string | null
    expectedOutcome?: string | null; supportRequired?: string | null; status: string
  }[]
}

export interface ItemReviewBody {
  id: string
  status: 'Pending' | 'Approved' | 'Declined'
  comment?: string | null
}

export interface AppraiseBody {
  qualityOfWorkRating?: number | null; qualityOfWorkComment?: string | null
  productivityRating?: number | null; productivityComment?: string | null
  initiativeRating?: number | null; initiativeComment?: string | null
  teamworkRating?: number | null; teamworkComment?: string | null
  complianceRating?: number | null; complianceComment?: string | null
  overallRating?: number | null
  supervisorGeneralComments?: string | null
  supervisorSignatureName?: string | null
  supervisorSignOffDate?: string | null
  decision: 'Approved' | 'Declined'
  decisionComment?: string | null
  activityReviews?: ItemReviewBody[]
  focusReviews?: ItemReviewBody[]
}
