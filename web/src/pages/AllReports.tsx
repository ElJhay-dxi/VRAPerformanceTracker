import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Download, Files, Search } from 'lucide-react'
import { ApiError, api } from '../api'
import { monthLabel, relativeTime, useAsync } from '../lib'
import { Card, Empty, Loading, Pager, PageHead, Segmented, StatusBadge } from '../components/ui'
import { useToast } from '../components/Toast'
import type { ReportStatus } from '../types'

type Filter = ReportStatus | 'all'

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const parseYm = (s: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(s)
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null
}
const monthsAgo = (n: number) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return ym(d)
}
const THIS_MONTH = ym(new Date())

const PRESETS: { label: string; from: string; to: string }[] = [
  { label: 'All time', from: '', to: '' },
  { label: 'This month', from: THIS_MONTH, to: THIS_MONTH },
  { label: 'Last 3 months', from: monthsAgo(2), to: THIS_MONTH },
  { label: 'Last 6 months', from: monthsAgo(5), to: THIS_MONTH },
  { label: 'This year', from: `${new Date().getFullYear()}-01`, to: THIS_MONTH },
]

export function AllReports() {
  const nav = useNavigate()
  const toast = useToast()
  const [status, setStatus] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const fromYm = parseYm(from)
  const toYm = parseYm(to)
  const rangeParams = {
    status: status === 'all' ? undefined : status,
    q: q || undefined,
    fromYear: fromYm?.year,
    fromMonth: fromYm?.month,
    toYear: toYm?.year,
    toMonth: toYm?.month,
  }

  const { data, loading, error } = useAsync(
    () => api.allReports({ ...rangeParams, page }),
    [status, q, from, to, page],
  )
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  const exportCsv = async () => {
    setExporting(true)
    try {
      await api.exportReportsCsv(rangeParams)
    } catch (e) {
      toast.err(e instanceof ApiError ? e.message : 'Could not export')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHead
        title="All reports"
        sub="Every monthly report across the organisation."
        actions={
          <button className="btn secondary sm" onClick={exportCsv} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        }
      />

      <div className="wrap" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
        <Segmented<Filter>
          value={status}
          onChange={(v) => { setPage(1); setStatus(v) }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'Draft', label: 'Draft' },
            { value: 'Submitted', label: 'Submitted' },
            { value: 'Approved', label: 'Approved' },
            { value: 'Declined', label: 'Declined' },
          ]}
        />
        <div className="input-wrap" style={{ width: 260 }}>
          <Search />
          <input className="input" placeholder="Staff name or department" value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value) }} />
        </div>
      </div>

      <div className="wrap" style={{ marginBottom: 18, alignItems: 'center' }}>
        {PRESETS.map((p) => {
          const active = p.from === from && p.to === to
          return (
            <button
              key={p.label}
              className="btn ghost sm"
              style={active ? { background: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--primary)' } : undefined}
              onClick={() => { setPage(1); setFrom(p.from); setTo(p.to) }}
            >
              {p.label}
            </button>
          )
        })}
        <span className="muted" style={{ marginLeft: 4 }}>or</span>
        <input type="month" className="input" style={{ width: 150 }} value={from}
          onChange={(e) => { setPage(1); setFrom(e.target.value) }} aria-label="From month" />
        <span className="muted">to</span>
        <input type="month" className="input" style={{ width: 150 }} value={to}
          onChange={(e) => { setPage(1); setTo(e.target.value) }} aria-label="To month" />
      </div>

      {loading && <Loading />}
      {error && <div className="card" style={{ color: 'var(--bad)' }}>{error}</div>}
      {data && (
        <>
          <div className="muted" style={{ marginBottom: 10 }}>
            <b style={{ color: 'var(--ink-1)' }}>{data.total}</b> report{data.total === 1 ? '' : 's'}
            {(from || to) && (
              <> in range{from && ` from ${monthLabel(fromYm!.year, fromYm!.month)}`}{to && ` to ${monthLabel(toYm!.year, toYm!.month)}`}</>
            )}
          </div>

          {data.items.length === 0 ? (
            <Card><Empty icon={<Files />} title="No reports match" /></Card>
          ) : (
            <div className="tablewrap">
              <table className="tbl">
                <thead>
                  <tr><th>Staff</th><th>Department</th><th>Month</th><th>Status</th><th>Overall</th><th>Reviewed</th><th></th></tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => nav(`/reports/${r.id}`)}>
                      <td className="cell-strong">{r.staffName}<div className="cell-sub">{r.staffEmail}{r.staffId ? ` · ${r.staffId}` : ''}</div></td>
                      <td>{r.department ?? '—'}</td>
                      <td>{monthLabel(r.year, r.month)}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="num">{r.overallRating != null ? `${r.overallRating} / 5` : '—'}</td>
                      <td className="cell-sub">{relativeTime(r.reviewedAt)}</td>
                      <td className="right"><ArrowRight size={15} style={{ color: 'var(--ink-3)' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={totalPages} total={data.total} unit="reports" onPage={setPage} />
        </>
      )}
    </>
  )
}
