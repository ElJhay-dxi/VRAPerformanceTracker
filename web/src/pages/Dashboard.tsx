import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Building2, CheckCircle2, ClipboardList, Clock, FileText, Files,
  Sparkles, Star, TriangleAlert, UserCog, UserPlus, Users,
} from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { avatarBg, initials, monthLabel, relativeTime, useAsync } from '../lib'
import { Card, CardHead, Empty, Loading, PageHead, Stat, StatusBadge } from '../components/ui'
import type { ReportStatus } from '../types'

export function Dashboard() {
  const { me } = useAuth()
  if (!me) return null
  const first = me.fullName.split(' ')[0]
  return (
    <>
      <PageHead title={`Welcome back, ${first}`} sub={hint(me.role)} />
      {me.role === 'Staff' && <StaffHome />}
      {me.role === 'Supervisor' && <SupervisorHome />}
      {me.role === 'Admin' && <AdminHome />}
      {me.role === 'Hr' && <HrHome />}
    </>
  )
}

const hint = (r: string) =>
  r === 'Staff'
    ? 'Your monthly performance reports at a glance.'
    : r === 'Supervisor'
      ? 'Reports from the people you supervise.'
      : r === 'Admin'
        ? 'The staff directory and how the team is set up.'
        : 'Organisation-wide performance reporting.'

/* ---------------- Staff ---------------- */
function StaffHome() {
  const nav = useNavigate()
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const { data, loading } = useAsync(() => api.myReports(), [])
  if (loading) return <Loading />
  const reports = data ?? []
  const current = reports.find((r) => r.year === y && r.month === m)
  const declined = reports.filter((r) => r.status === 'Declined')
  const approved = reports.filter((r) => r.status === 'Approved').length

  return (
    <>
      <div className="stats">
        <Stat k="This month" v={current ? <StatusBadge status={current.status} /> : 'Not started'}
          foot={monthLabel(y, m)} icon={<FileText />} />
        <Stat k="Approved" v={approved} foot="all time" icon={<CheckCircle2 />} tint="ok" />
        <Stat k="Needs changes" v={declined.length} icon={<TriangleAlert />} tint={declined.length ? 'bad' : undefined} />
        <Stat k="Total reports" v={reports.length} icon={<ClipboardList />} />
      </div>

      {declined.length > 0 && (
        <Card style={{ borderColor: 'var(--bad)', background: 'var(--bad-soft)' }}>
          <div className="wrap">
            <TriangleAlert size={18} style={{ color: 'var(--bad)' }} />
            <b>{declined.length} report{declined.length > 1 ? 's' : ''} sent back for changes.</b>
            <button className="btn sm danger" style={{ marginLeft: 'auto' }}
              onClick={() => nav(`/my-reports/${declined[0].year}/${declined[0].month}`)}>
              Fix {monthLabel(declined[0].year, declined[0].month)}
            </button>
          </div>
        </Card>
      )}

      <Card>
        <CardHead title={current ? 'Continue this month' : 'Start this month'} />
        <div className="wrap" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{monthLabel(y, m)}</div>
            <div className="muted">
              {current
                ? `Status: ${current.status}. Last updated ${relativeTime(current.updatedAt)}.`
                : 'You haven’t opened a report for this month yet.'}
            </div>
          </div>
          <button className="btn" onClick={() => nav(`/my-reports/${y}/${m}`)}>
            {current ? 'Open report' : 'Start report'} <ArrowRight size={15} />
          </button>
        </div>
      </Card>

      <Card>
        <CardHead title="Recent reports" right={<button className="btn ghost sm" onClick={() => nav('/my-reports')}>View all</button>} />
        {reports.length === 0 ? (
          <Empty icon={<FileText />} title="No reports yet" hint="Open one for the current month to get started." />
        ) : (
          <div className="tl">
            {reports.slice(0, 5).map((r) => (
              <div key={r.id} className="tl-item">
                <div className="wrap" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <button className="linkish" onClick={() => nav(`/my-reports/${r.year}/${r.month}`)}>
                      {monthLabel(r.year, r.month)}
                    </button>
                    <div className="muted">
                      {r.overallRating != null ? `Rated ${r.overallRating}/5 · ` : ''}
                      updated {relativeTime(r.updatedAt)}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

/* ---------------- Supervisor ---------------- */
function SupervisorHome() {
  const nav = useNavigate()
  const reports = useAsync(() => api.assignedReports({}), [])
  const people = useAsync(() => api.supervisees().catch(() => []), [])
  if (reports.loading) return <Loading />
  const all = reports.data ?? []
  const pending = all.filter((r) => r.status === 'Submitted')
  const approved = all.filter((r) => r.status === 'Approved').length
  const declined = all.filter((r) => r.status === 'Declined').length

  return (
    <>
      <div className="stats">
        <Stat k="Awaiting your review" v={pending.length} icon={<Clock />} tint={pending.length ? 'info' : undefined} />
        <Stat k="Approved" v={approved} icon={<CheckCircle2 />} tint="ok" />
        <Stat k="Declined" v={declined} icon={<TriangleAlert />} />
        <Stat k="People supervised" v={people.data?.length ?? '—'} icon={<Users />} />
      </div>

      <Card>
        <CardHead title="Review queue"
          right={<button className="btn ghost sm" onClick={() => nav('/assigned')}>Open queue</button>} />
        {pending.length === 0 ? (
          <Empty icon={<CheckCircle2 />} title="Nothing to review" hint="Submitted reports will show up here." />
        ) : (
          <div className="tablewrap">
            <table className="tbl">
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => nav(`/reports/${r.id}`)}>
                    <td className="cell-strong">{r.staffName}<div className="cell-sub">{r.staffEmail}{r.staffId ? ` · ${r.staffId}` : ''}</div></td>
                    <td>{monthLabel(r.year, r.month)}</td>
                    <td>submitted {relativeTime(r.submittedAt)}</td>
                    <td className="right"><ArrowRight size={15} style={{ color: 'var(--ink-3)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {people.data && people.data.length > 0 && (
        <Card>
          <CardHead title="Your team" />
          <div className="people-grid">
            {people.data.map((u) => (
              <div key={u.id} className="person">
                <span className="avatar" style={{ background: avatarBg(u.email) }}>{initials(u.fullName)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="cell-strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.fullName}</div>
                  <div className="cell-sub">{u.jobTitle ?? u.department ?? ''}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}

/* ---------------- Admin ---------------- */
function AdminHome() {
  const nav = useNavigate()
  const { data, loading } = useAsync(() => api.users({}), [])
  if (loading) return <Loading />
  const users = data ?? []
  const byRole = (r: string) => users.filter((u) => u.role === r).length
  const noSupervisor = users.filter((u) => u.role === 'Staff' && !u.supervisorUserId).length
  const inactive = users.filter((u) => !u.isActive).length

  return (
    <>
      <div className="stats">
        <Stat k="People" v={users.length} foot={`${inactive} inactive`} icon={<Users />} />
        <Stat k="Supervisors" v={byRole('Supervisor')} icon={<UserCog />} />
        <Stat k="Staff without a supervisor" v={noSupervisor} icon={<TriangleAlert />}
          tint={noSupervisor ? 'warn' : undefined} />
        <Stat k="Admins / HR" v={byRole('Admin') + byRole('Hr')} icon={<ClipboardList />} />
      </div>

      {noSupervisor > 0 && (
        <Card style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)' }}>
          <div className="wrap">
            <TriangleAlert size={18} style={{ color: 'var(--warn)' }} />
            <b>{noSupervisor} staff member{noSupervisor > 1 ? 's have' : ' has'} no supervising user.</b>
            <span className="muted">Their reports won’t land in anyone’s queue.</span>
            <button className="btn sm secondary" style={{ marginLeft: 'auto' }} onClick={() => nav('/staff')}>
              Fix in Staff
            </button>
          </div>
        </Card>
      )}

      <Card>
        <CardHead title="Directory"
          right={<button className="btn ghost sm" onClick={() => nav('/staff')}>Manage staff</button>} />
        <div className="tablewrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Supervisor</th></tr></thead>
            <tbody>
              {users.slice(0, 8).map((u) => (
                <tr key={u.id} className="clickable" onClick={() => nav('/staff')}>
                  <td className="cell-strong">{u.fullName}<div className="cell-sub">{u.email}</div></td>
                  <td>{u.role}</td>
                  <td>{u.department ?? '—'}</td>
                  <td>{u.supervisorUserName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ---------------- HR ---------------- */
const STATS_ORDER: { key: 'draftReports' | 'awaitingReview' | 'approvedReports' | 'declinedReports'; label: ReportStatus }[] = [
  { key: 'draftReports', label: 'Draft' },
  { key: 'awaitingReview', label: 'Submitted' },
  { key: 'approvedReports', label: 'Approved' },
  { key: 'declinedReports', label: 'Declined' },
]
function HrHome() {
  const nav = useNavigate()
  const { data: a, loading } = useAsync(() => api.analyticsHr(), [])
  const feed = useAsync(() => api.activityLog({ page: 1 }), [])
  if (loading || !a) return <Loading />

  const total = a.totalReports
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  return (
    <>
      <div className="stats">
        <Stat k="Active new staff" v={a.activeStaff} foot={`${a.departments} department${a.departments === 1 ? '' : 's'}`} icon={<Users />} />
        <Stat k="Added in last 30 days" v={a.newStaffLast30Days} icon={<UserPlus />} tint={a.newStaffLast30Days ? 'info' : undefined} />
        <Stat k="Without a supervisor" v={a.staffWithoutSupervisor} icon={<TriangleAlert />}
          tint={a.staffWithoutSupervisor ? 'warn' : undefined} />
        <Stat k="Avg performance" v={a.avgOverallRating != null ? `${a.avgOverallRating} / 5` : '—'}
          foot={a.approvalRate != null ? `${a.approvalRate}% approved` : 'no scores yet'} icon={<Star />} tint="ok" />
      </div>

      <div className="stats">
        <Stat k="Total reports" v={total} icon={<Files />} />
        <Stat k="Awaiting review" v={a.awaitingReview} icon={<Clock />} tint={a.awaitingReview ? 'info' : undefined} />
        <Stat k="Filed this month" v={a.submittedThisMonth} foot={monthLabel(new Date().getFullYear(), new Date().getMonth() + 1)} icon={<FileText />} />
        <Stat k="Supervisors" v={a.supervisors} foot={`${a.archivedStaff} archived`} icon={<UserCog />} />
      </div>

      <Card>
        <CardHead title="Status breakdown"
          right={
            <div className="wrap">
              <button className="btn ghost sm" onClick={() => nav('/analytics')}><BarChart3 size={15} /> Analytics</button>
              <button className="btn ghost sm" onClick={() => nav('/all-reports')}>All reports</button>
            </div>
          } />
        <div className="breakdown">
          {STATS_ORDER.map(({ key, label }) => {
            const n = a[key]
            return (
              <div key={label} className="bd-row">
                <span className={`badge ${label}`}><span className="dot" />{label}</span>
                <div className="pbar" style={{ flex: 1 }}><i style={{ width: `${pct(n)}%` }} /></div>
                <span className="num" style={{ width: 46, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {a.byDepartment.length > 0 && (
        <Card>
          <CardHead title="By department" right={<Building2 size={15} style={{ color: 'var(--ink-3)' }} />} />
          <div className="tablewrap">
            <table className="tbl">
              <thead><tr><th>Department</th><th>Staff</th><th>Reports</th><th>Avg score</th></tr></thead>
              <tbody>
                {a.byDepartment.map((d) => (
                  <tr key={d.department}>
                    <td className="cell-strong">{d.department}</td>
                    <td className="num">{d.staffCount}</td>
                    <td className="num">{d.reportCount}</td>
                    <td className="num">{d.avgOverallRating != null ? `${d.avgOverallRating} / 5` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(a.topPerformers.length > 0 || a.needsAttention.length > 0) && (
        <div className="row" style={{ alignItems: 'start' }}>
          {a.topPerformers.length > 0 && (
            <Card>
              <CardHead title="Top performers" right={<Sparkles size={15} style={{ color: 'var(--ok)' }} />} />
              <div className="tl">
                {a.topPerformers.map((s) => (
                  <div key={s.userId} className="tl-item">
                    <div className="wrap" style={{ justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{s.fullName}</span>
                        <div className="muted">{s.department ?? '—'} · {s.reviewedReports} report{s.reviewedReports === 1 ? '' : 's'}</div>
                      </div>
                      <span className="cell-strong">{s.avgOverallRating != null ? `${s.avgOverallRating} / 5` : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {a.needsAttention.length > 0 && (
            <Card>
              <CardHead title="Needs attention" right={<TriangleAlert size={15} style={{ color: 'var(--warn)' }} />} />
              <div className="tl">
                {a.needsAttention.map((s) => (
                  <div key={s.userId} className="tl-item">
                    <div className="wrap" style={{ justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{s.fullName}</span>
                        <div className="muted">
                          {s.department ?? '—'}
                          {s.declinedReports > 0 ? ` · ${s.declinedReports} declined` : ''}
                        </div>
                      </div>
                      <span className="cell-strong">{s.avgOverallRating != null ? `${s.avgOverallRating} / 5` : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHead title="Recent activity"
          right={<button className="btn ghost sm" onClick={() => nav('/activity-log')}>Full log</button>} />
        {feed.loading && <Loading />}
        {feed.data && (
          <div className="tl">
            {feed.data.items.slice(0, 7).map((e) => (
              <div key={e.id} className="tl-item">
                <div className="wrap" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{e.summary}</span>
                    <div className="muted">{e.actorEmail}</div>
                  </div>
                  <span className="muted" style={{ whiteSpace: 'nowrap' }}>{relativeTime(e.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
