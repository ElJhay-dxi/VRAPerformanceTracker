import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardCheck, Search } from 'lucide-react'
import { api } from '../api'
import { monthLabel, relativeTime, useAsync } from '../lib'
import { Card, Empty, Loading, PageHead, Segmented, StatusBadge } from '../components/ui'
import type { ReportStatus } from '../types'

type Filter = 'Submitted' | 'Approved' | 'Declined' | 'all'

export function AssignedReports() {
  const nav = useNavigate()
  const [status, setStatus] = useState<Filter>('Submitted')
  const [q, setQ] = useState('')
  const { data, loading, error } = useAsync(
    () => api.assignedReports({ status: status === 'all' ? undefined : (status as ReportStatus), q: q || undefined }),
    [status, q],
  )
  const supervisees = useAsync(() => api.supervisees().catch(() => []), [])

  return (
    <>
      <PageHead
        title="Assigned to me"
        sub={
          supervisees.data && supervisees.data.length > 0
            ? `You supervise ${supervisees.data.length}: ${supervisees.data.map((u) => u.fullName).join(', ')}`
            : 'Reports from the people you supervise.'
        }
      />

      <div className="wrap" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
        <Segmented<Filter>
          value={status}
          onChange={setStatus}
          options={[
            { value: 'Submitted', label: 'To review' },
            { value: 'Approved', label: 'Approved' },
            { value: 'Declined', label: 'Declined' },
            { value: 'all', label: 'All' },
          ]}
        />
        <div className="input-wrap" style={{ width: 260 }}>
          <Search />
          <input className="input" placeholder="Search staff" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading && <Loading />}
      {error && <div className="card" style={{ color: 'var(--bad)' }}>{error}</div>}
      {data && data.length === 0 && (
        <Card><Empty icon={<ClipboardCheck />} title="Nothing here" hint="Reports matching this filter will appear here." /></Card>
      )}
      {data && data.length > 0 && (
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr><th>Staff</th><th>Month</th><th>Status</th><th>Overall</th><th>Submitted</th><th></th></tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => nav(`/reports/${r.id}`)}>
                  <td className="cell-strong">{r.staffName}<div className="cell-sub">{r.staffEmail}{r.staffId ? ` · ${r.staffId}` : ''}</div></td>
                  <td>{monthLabel(r.year, r.month)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="num">{r.overallRating != null ? `${r.overallRating} / 5` : '—'}</td>
                  <td className="cell-sub">{relativeTime(r.submittedAt)}</td>
                  <td className="right">
                    <span className="btn secondary sm">{r.status === 'Submitted' ? 'Review' : 'Open'} <ArrowRight size={13} /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
