import { useState } from 'react'
import { Activity, ArrowRightLeft, FileText, LogIn, Search, Trash2, UserRoundCog } from 'lucide-react'
import { api } from '../api'
import { fmtDateTime, useAsync } from '../lib'
import { Card, Empty, Loading, Pager, PageHead } from '../components/ui'

function iconFor(action: string) {
  if (action.startsWith('report.created') || action.includes('updated')) return <FileText />
  if (action.includes('submitted') || action.includes('approved') || action.includes('declined')) return <ArrowRightLeft />
  if (action.startsWith('user.role') || action.startsWith('user.supervisor') || action.startsWith('user.profile')) return <UserRoundCog />
  if (action.includes('active')) return <UserRoundCog />
  if (action.includes('login')) return <LogIn />
  if (action.includes('delete')) return <Trash2 />
  return <Activity />
}

export function ActivityLog() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error } = useAsync(() => api.activityLog({ q: q || undefined, page }), [q, page])
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <PageHead title="Activity log" sub="Every change, appended and never edited." />

      <div className="input-wrap" style={{ maxWidth: 340, marginBottom: 16 }}>
        <Search />
        <input className="input" placeholder="Action, summary or user email" value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value) }} />
      </div>

      {loading && <Loading />}
      {error && <div className="card" style={{ color: 'var(--bad)' }}>{error}</div>}
      {data && (
        <>
          {data.items.length === 0 ? (
            <Card><Empty icon={<Activity />} title="Nothing logged yet" /></Card>
          ) : (
            <Card>
              <div className="feed">
                {data.items.map((e) => (
                  <div key={e.id} className="feed-item">
                    <span className="feed-ico">{iconFor(e.action)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{e.summary}</div>
                      <div className="cell-sub">
                        <code>{e.action}</code> · {e.actorEmail}
                      </div>
                    </div>
                    <span className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.createdAt)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Pager page={page} totalPages={totalPages} total={data.total} unit="entries" onPage={setPage} />
        </>
      )}
    </>
  )
}
