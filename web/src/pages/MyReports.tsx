import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, FileText, IdCard } from 'lucide-react'
import { ApiError, api } from '../api'
import { useAuth } from '../auth'
import { MONTHS, monthLabel, relativeTime, useAsync } from '../lib'
import { Card, CardHead, Empty, Loading, PageHead, StatusBadge } from '../components/ui'
import { useToast } from '../components/Toast'

export function MyReports() {
  const { me } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const now = new Date()
  const { data: reports, loading, error } = useAsync(() => api.myReports(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [busy, setBusy] = useState(false)

  const open = async () => {
    setBusy(true)
    try {
      await api.createMyReport(year, month)
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) {
        toast.err(e instanceof Error ? e.message : 'Could not open report')
        setBusy(false)
        return
      }
    }
    nav(`/my-reports/${year}/${month}`)
  }

  return (
    <>
      <PageHead title="My reports" sub="Your monthly performance tracking forms." />

      <Card>
        <CardHead tag="A" title="Staff information" right={<span className="muted"><IdCard size={13} style={{ verticalAlign: -2 }} /> maintained by an admin</span>} />
        <div className="row">
          <Info label="Email" value={me?.email} />
          <Info label="Staff ID" value={me?.staffId} />
          <Info label="Department / unit" value={me?.department} />
          <Info label="Job title / role" value={me?.jobTitle} />
          <Info label="Supervisor" value={me?.supervisorName ?? me?.supervisorEmail ?? 'Not assigned'} />
        </div>
      </Card>

      <Card>
        <CardHead title="Open a monthly report" />
        <div className="row tight" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ maxWidth: 200 }}>
            <label>Month</label>
            <select className="select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 130 }}>
            <label>Year</label>
            <input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <button className="btn" disabled={busy} onClick={open}>
            <CalendarPlus size={15} /> Open
          </button>
        </div>
      </Card>

      <Card className="card-pad-0">
        <div style={{ padding: '18px 20px 0' }}>
          <CardHead title="History" />
        </div>
        {loading && <div style={{ padding: 20 }}><Loading /></div>}
        {error && <div style={{ padding: 20, color: 'var(--bad)' }}>{error}</div>}
        {reports && reports.length === 0 && (
          <Empty icon={<FileText />} title="No reports yet" hint="Open one for the current month above." />
        )}
        {reports && reports.length > 0 && (
          <table className="tbl">
            <thead>
              <tr><th>Month</th><th>Status</th><th>Overall</th><th>Updated</th><th></th></tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => nav(`/my-reports/${r.year}/${r.month}`)}>
                  <td className="cell-strong">{monthLabel(r.year, r.month)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="num">{r.overallRating != null ? `${r.overallRating} / 5` : '—'}</td>
                  <td className="cell-sub">{relativeTime(r.updatedAt)}</td>
                  <td className="right">
                    <span className="btn secondary sm">{r.status === 'Draft' || r.status === 'Declined' ? 'Edit' : 'View'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="kv">
      <span className="k">{label}</span>
      <span style={{ fontWeight: 500 }}>{value || '—'}</span>
    </div>
  )
}
