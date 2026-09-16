import { useState } from 'react'
import { Download, Sparkles, TriangleAlert } from 'lucide-react'
import { ApiError, api } from '../api'
import { monthShort, useAsync } from '../lib'
import { Card, CardHead, Empty, Loading, PageHead, Stat } from '../components/ui'
import { useToast } from '../components/Toast'
import type { HrAnalytics, StaffPerformance } from '../types'

const PARAMS: { key: keyof HrAnalytics['parameters']; label: string }[] = [
  { key: 'qualityOfWork', label: 'Quality of work' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'initiative', label: 'Initiative' },
  { key: 'teamwork', label: 'Teamwork' },
  { key: 'compliance', label: 'Compliance' },
]

export function Analytics() {
  const { data: a, loading, error } = useAsync(() => api.analyticsHr(), [])
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  if (loading) return <Loading />
  if (error) return <div className="card" style={{ color: 'var(--bad)' }}>{error}</div>
  if (!a) return null

  const noScores = a.approvedReports + a.declinedReports === 0

  const download = async () => {
    setExporting(true)
    try {
      await api.exportAnalyticsHrPdf()
    } catch (e) {
      toast.err(e instanceof ApiError ? e.message : 'Could not export')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHead
        title="Analytics"
        sub="How new hires are performing across the organisation, drawn from finalised reports."
        actions={
          <button className="btn secondary sm" onClick={download} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Exporting…' : 'Download full report (PDF)'}
          </button>
        }
      />

      <div className="stats">
        <Stat k="Avg overall score" v={a.avgOverallRating != null ? `${a.avgOverallRating} / 5` : '—'} tint="ok" />
        <Stat k="Approval rate" v={a.approvalRate != null ? `${a.approvalRate}%` : '—'}
          foot={`${a.approvedReports} approved · ${a.declinedReports} declined`} />
        <Stat k="Reports scored" v={a.approvedReports + a.declinedReports} foot={`of ${a.totalReports} total`} />
        <Stat k="Active new staff" v={a.activeStaff} foot={`${a.departments} departments`} />
      </div>

      {noScores ? (
        <Card>
          <Empty icon={<Sparkles />} title="No finalised reports yet"
            hint="Once supervisors start approving or declining reports, the trends and rankings show up here." />
        </Card>
      ) : (
        <>
          <Card>
            <CardHead title="Overall score — last 6 months" />
            <TrendChart trend={a.trend} />
          </Card>

          <Card>
            <CardHead title="Average by appraisal parameter" />
            <div className="breakdown">
              {PARAMS.map(({ key, label }) => {
                const v = a.parameters[key]
                return (
                  <div key={key} className="bd-row">
                    <span style={{ width: 130, fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
                    <div className="pbar" style={{ flex: 1 }}>
                      <i style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
                    </div>
                    <span className="num" style={{ width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {v != null ? `${v}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>

          {a.byDepartment.length > 0 && (
            <Card>
              <CardHead title="Performance by department" />
              <div className="tablewrap">
                <table className="tbl">
                  <thead><tr><th>Department</th><th>Staff</th><th>Reports</th><th>Avg score</th><th></th></tr></thead>
                  <tbody>
                    {[...a.byDepartment]
                      .sort((x, y) => (y.avgOverallRating ?? -1) - (x.avgOverallRating ?? -1))
                      .map((d) => (
                        <tr key={d.department}>
                          <td className="cell-strong">{d.department}</td>
                          <td className="num">{d.staffCount}</td>
                          <td className="num">{d.reportCount}</td>
                          <td className="num">{d.avgOverallRating != null ? `${d.avgOverallRating} / 5` : '—'}</td>
                          <td style={{ width: 120 }}>
                            <div className="pbar"><i style={{ width: `${((d.avgOverallRating ?? 0) / 5) * 100}%` }} /></div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="row" style={{ alignItems: 'start' }}>
            <Card>
              <CardHead title="Top performers" right={<Sparkles size={15} style={{ color: 'var(--ok)' }} />} />
              <StaffList rows={a.topPerformers} empty="No scored reports yet." />
            </Card>
            <Card>
              <CardHead title="Needs attention" right={<TriangleAlert size={15} style={{ color: 'var(--warn)' }} />} />
              <StaffList rows={a.needsAttention} empty="Nobody flagged — no declines or low scores." />
            </Card>
          </div>
        </>
      )}
    </>
  )
}

function StaffList({ rows, empty }: { rows: StaffPerformance[]; empty: string }) {
  if (rows.length === 0) return <div className="muted" style={{ padding: '8px 2px' }}>{empty}</div>
  return (
    <div className="tl">
      {rows.map((s) => (
        <div key={s.userId} className="tl-item">
          <div className="wrap" style={{ justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontWeight: 500 }}>{s.fullName}</span>
              <div className="muted">
                {s.department ?? '—'} · {s.reviewedReports} report{s.reviewedReports === 1 ? '' : 's'}
                {s.declinedReports > 0 ? ` · ${s.declinedReports} declined` : ''}
              </div>
            </div>
            <span className="cell-strong">{s.avgOverallRating != null ? `${s.avgOverallRating} / 5` : '—'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Hand-rolled SVG line chart — kept dependency-free to match the rest of the app. */
function TrendChart({ trend }: { trend: HrAnalytics['trend'] }) {
  const W = 640
  const H = 200
  const padX = 34
  const padY = 22
  const pts = trend.map((t, i) => {
    const x = padX + (i * (W - padX * 2)) / Math.max(1, trend.length - 1)
    const score = t.avgOverallRating ?? 0
    const y = padY + (1 - score / 5) * (H - padY * 2)
    return { ...t, x, y, score }
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${H - padY} L${pts[0].x.toFixed(1)},${H - padY} Z`

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block' }} role="img"
        aria-label="Average overall score over the last six months">
        {[0, 1, 2, 3, 4, 5].map((g) => {
          const y = padY + (1 - g / 5) * (H - padY * 2)
          return (
            <g key={g}>
              <line x1={padX} x2={W - padX} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={padX - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--ink-3)">{g}</text>
            </g>
          )
        })}
        <path d={area} fill="var(--primary)" opacity="0.10" />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p) => (
          <g key={`${p.year}-${p.month}`}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="var(--primary)" />
            {p.avgOverallRating != null && (
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--ink-2)">
                {p.avgOverallRating}
              </text>
            )}
            <text x={p.x} y={H - padY + 14} textAnchor="middle" fontSize="10" fill="var(--ink-3)">
              {monthShort(p.year, p.month)}
            </text>
            <text x={p.x} y={H - padY + 26} textAnchor="middle" fontSize="9" fill="var(--ink-3)">
              {p.reportCount} rpt
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
