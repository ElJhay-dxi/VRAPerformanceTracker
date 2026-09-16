import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X } from 'lucide-react'
import { api, type AppraiseBody, type ItemReviewBody } from '../api'
import { useAuth } from '../auth'
import { fmtDateTime, monthLabel, useAsync } from '../lib'
import { Card, CardHead, Loading, StatusBadge, Stars } from '../components/ui'
import { useToast } from '../components/Toast'
import type { ItemReviewStatus, Report } from '../types'

const PARAMS = [
  ['qualityOfWork', 'Quality of Work', 'Accuracy, attention to detail, standards'],
  ['productivity', 'Productivity & Timeliness', 'Output level, meeting deadlines'],
  ['initiative', 'Initiative & Problem Solving', 'Proactiveness, creativity'],
  ['teamwork', 'Teamwork & Communication', 'Collaboration, interpersonal effectiveness'],
  ['compliance', 'Compliance & Professional Conduct', 'Adherence to rules, safety, ethics'],
] as const

const RATING_KEY = (p: string) => `${p}Rating` as keyof Report
const COMMENT_KEY = (p: string) => `${p}Comment` as keyof Report

// ---------------------------------------------------------------------------
// Section G readout. hideScores => only the comments, no stars / overall.
// ---------------------------------------------------------------------------
export function AppraisalReadout({ report, hideScores = false }: { report: Report; hideScores?: boolean }) {
  return (
    <>
      <div className="tablewrap" style={{ marginBottom: 14 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Parameter</th>
              {!hideScores && <th style={{ width: 130 }}>Rating</th>}
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {PARAMS.map(([p, label]) => (
              <tr key={p}>
                <td className="cell-strong">{label}</td>
                {!hideScores && (
                  <td><Stars value={(report[RATING_KEY(p)] as number | null) ?? 0} size={15} /></td>
                )}
                <td className="cell-sub">{(report[COMMENT_KEY(p)] as string | null) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!hideScores && (
        <div className="wrap" style={{ marginBottom: 12 }}>
          <span className="eyebrow">Overall</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>
            {report.overallRating != null ? `${report.overallRating} / 5` : '—'}
          </span>
          <Stars value={Math.round(report.overallRating ?? 0)} size={16} />
        </div>
      )}
      <div className="kv"><span className="k">Supervisor's general comments</span><span className="readout">{report.supervisorGeneralComments || '—'}</span></div>
      {report.decisionComment && (
        <div className="kv"><span className="k">Decision note</span><span className="readout">{report.decisionComment}</span></div>
      )}
      <div className="muted">
        {report.reviewedByName
          ? `${report.status} by ${report.reviewedByName} · ${fmtDateTime(report.reviewedAt)}`
          : 'Not yet reviewed'}
        {report.supervisorSignatureName ? ` · Signed: ${report.supervisorSignatureName}` : ''}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Row review chip (read-only) + inline control (when appraising)
// ---------------------------------------------------------------------------
function ReviewChip({ status }: { status: ItemReviewStatus }) {
  if (status === 'Approved') return <span className="badge Approved"><span className="dot" />Approved</span>
  if (status === 'Declined') return <span className="badge Declined"><span className="dot" />Needs work</span>
  return null
}

export interface RowReview {
  get: (id: string) => { status: ItemReviewStatus; comment: string }
  set: (id: string, patch: Partial<{ status: ItemReviewStatus; comment: string }>) => void
}
interface ReviewControls { act: RowReview; foc: RowReview }

function InlineReview({ id, r }: { id: string; r: RowReview }) {
  const cur = r.get(id)
  return (
    <div className="row-review">
      <div className="seg">
        <button className={cur.status === 'Approved' ? 'on' : ''} onClick={() => r.set(id, { status: 'Approved' })}>Approve</button>
        <button className={cur.status === 'Declined' ? 'on' : ''} onClick={() => r.set(id, { status: 'Declined' })}>Decline</button>
      </div>
      {cur.status === 'Declined' && (
        <textarea
          className="textarea"
          placeholder="What needs to change?"
          value={cur.comment}
          onChange={(e) => r.set(id, { comment: e.target.value })}
          style={{ minHeight: 40, marginTop: 6 }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report content readout. `review` present => supervisor is appraising rows.
// ---------------------------------------------------------------------------
export function StaffSectionsReadout({ report, review }: { report: Report; review?: ReviewControls }) {
  const F = ({ label, value }: { label: string; value: string | null }) => (
    <div className="kv"><span className="k">{label}</span><span className="readout">{value || '—'}</span></div>
  )
  return (
    <>
      <Card>
        <CardHead tag="B" title="Monthly activities performed" />
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th><th>Key activity</th><th>Description</th>
                <th>Output / result</th><th style={{ width: 110 }}>Status</th>
                <th style={{ width: review ? 260 : 130 }}>{review ? 'Your review' : 'Review'}</th>
              </tr>
            </thead>
            <tbody>
              {report.activities.length === 0 && <tr><td colSpan={6} className="muted">No activities recorded.</td></tr>}
              {report.activities.map((a) => (
                <tr key={a.id}>
                  <td className="cell-sub">{a.lineNo}</td>
                  <td className="cell-strong">
                    {a.keyActivity || '—'}
                    {a.rolledOver && <span className="tag-roll">carried over</span>}
                  </td>
                  <td>{a.descriptionOfWork || '—'}</td>
                  <td>{a.outputResult || '—'}</td>
                  <td>{a.status ? <span className={`badge ${a.status === 'Completed' ? 'Approved' : 'Submitted'}`}>{a.status}</span> : '—'}</td>
                  <td>
                    {review
                      ? <InlineReview id={a.id} r={review.act} />
                      : <><ReviewChip status={a.reviewStatus} />{a.reviewComment && <div className="cell-sub" style={{ marginTop: 3 }}>{a.reviewComment}</div>}</>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardHead tag="C" title="Key achievements, innovation and creativity" />
        <F label="Major accomplishments" value={report.keyAchievements} />
        <F label="Major innovations" value={report.innovations} />
      </Card>
      <Card>
        <CardHead tag="D" title="Skills & experience gained" />
        <F label="New skills acquired" value={report.newSkills} />
        <F label="Knowledge / experience gained" value={report.knowledgeGained} />
        <F label="Tools / systems learned" value={report.toolsLearned} />
      </Card>
      <Card>
        <CardHead tag="E" title="Challenges encountered" />
        <F label="Key challenges faced" value={report.keyChallenges} />
        <F label="Support required" value={report.supportRequired} />
      </Card>
      <Card>
        <CardHead tag="F" title="Key focus areas for next month" />
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th><th>Planned activity</th><th>Expected outcome</th>
                <th>Support required</th><th style={{ width: 110 }}>Status</th>
                <th style={{ width: review ? 260 : 130 }}>{review ? 'Your review' : 'Review'}</th>
              </tr>
            </thead>
            <tbody>
              {report.focusAreas.length === 0 && <tr><td colSpan={6} className="muted">Nothing recorded.</td></tr>}
              {report.focusAreas.map((f) => (
                <tr key={f.id}>
                  <td className="cell-sub">{f.lineNo}</td>
                  <td className="cell-strong">
                    {f.plannedActivity || '—'}
                    {f.rolledOver && <span className="tag-roll">carried over</span>}
                  </td>
                  <td>{f.expectedOutcome || '—'}</td>
                  <td>{f.supportRequired || '—'}</td>
                  <td><span className="badge Draft">{f.status}</span></td>
                  <td>
                    {review
                      ? <InlineReview id={f.id} r={review.foc} />
                      : <><ReviewChip status={f.reviewStatus} />{f.reviewComment && <div className="cell-sub" style={{ marginTop: 3 }}>{f.reviewComment}</div>}</>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardHead title="Staff sign-off" />
        <div className="muted">
          {report.staffSignatureName || '—'}
          {report.staffSignOffDate ? ` · ${report.staffSignOffDate}` : ''}
          {report.submittedAt ? ` · submitted ${fmtDateTime(report.submittedAt)}` : ''}
        </div>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Supervisor review page
// ---------------------------------------------------------------------------
type Rec = Record<string, { status: ItemReviewStatus; comment: string }>

export function ReportView() {
  const { id } = useParams()
  const { me } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const { data: report, error, loading, setData } = useAsync<Report>(() => api.report(id!), [id])

  const canAppraise =
    (me?.role === 'Supervisor' || me?.role === 'Admin') && report?.status === 'Submitted'

  // form state, seeded from whatever the supervisor set last round
  const seed = useMemo(() => {
    if (!report) return null
    const ratings: Record<string, number> = {}
    const comments: Record<string, string> = {}
    for (const [p] of PARAMS) {
      const rv = report[RATING_KEY(p)] as number | null
      if (rv != null) ratings[p] = rv
      const cv = report[COMMENT_KEY(p)] as string | null
      if (cv) comments[p] = cv
    }
    const act: Rec = {}
    for (const a of report.activities) act[a.id] = { status: a.reviewStatus, comment: a.reviewComment ?? '' }
    const foc: Rec = {}
    for (const f of report.focusAreas) foc[f.id] = { status: f.reviewStatus, comment: f.reviewComment ?? '' }
    return { ratings, comments, general: report.supervisorGeneralComments ?? '', signature: '', act, foc }
  }, [report])

  const [form, setForm] = useState<typeof seed>(null)
  const f = form ?? seed
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <div className="card" style={{ color: 'var(--bad)' }}>{error}</div>
  if (!report || !f) return null

  const patch = (p: Partial<NonNullable<typeof seed>>) => setForm({ ...(form ?? seed!), ...p })

  const rowReview = (key: 'act' | 'foc'): RowReview => ({
    get: (rid) => (form ?? seed!)[key][rid] ?? { status: 'Pending', comment: '' },
    set: (rid, pt) => {
      const base = form ?? seed!
      patch({ [key]: { ...base[key], [rid]: { ...(base[key][rid] ?? { status: 'Pending', comment: '' }), ...pt } } } as never)
    },
  })

  const submitAppraisal = async (decision: 'Approved' | 'Declined') => {
    const toReviews = (rec: Rec): ItemReviewBody[] =>
      Object.entries(rec)
        .filter(([, v]) => v.status !== 'Pending')
        .map(([rid, v]) => ({ id: rid, status: v.status, comment: v.comment || null }))

    if (decision === 'Declined' && !f.general.trim() && toReviews(f.act).every((r) => r.status !== 'Declined') && toReviews(f.foc).every((r) => r.status !== 'Declined')) {
      toast.err('Mark the rows that need work, or add a general comment, before declining.')
      return
    }
    setBusy(true)
    const num = (v: number | undefined) => (v == null ? null : v)
    const body: AppraiseBody = {
      qualityOfWorkRating: num(f.ratings.qualityOfWork), qualityOfWorkComment: f.comments.qualityOfWork || null,
      productivityRating: num(f.ratings.productivity), productivityComment: f.comments.productivity || null,
      initiativeRating: num(f.ratings.initiative), initiativeComment: f.comments.initiative || null,
      teamworkRating: num(f.ratings.teamwork), teamworkComment: f.comments.teamwork || null,
      complianceRating: num(f.ratings.compliance), complianceComment: f.comments.compliance || null,
      supervisorGeneralComments: f.general || null,
      supervisorSignatureName: f.signature || me?.fullName || null,
      decision,
      decisionComment: null,
      activityReviews: toReviews(f.act),
      focusReviews: toReviews(f.foc),
    }
    try {
      const updated = await api.appraiseReport(report.id, body)
      setData(updated)
      setForm(null)
      toast.ok(`Report ${decision.toLowerCase()}.`)
    } catch (e) {
      toast.err(e instanceof Error ? e.message : 'Could not save appraisal')
    } finally { setBusy(false) }
  }

  return (
    <>
      <button className="btn ghost sm" onClick={() => nav(-1)} style={{ marginBottom: 14 }}>
        <ArrowLeft size={15} /> Back
      </button>

      <div className="page-head" style={{ marginBottom: 18 }}>
        <div>
          <div className="h1">{report.staffName}</div>
          <div className="wrap" style={{ marginTop: 6 }}>
            <span className="muted">{monthLabel(report.year, report.month)}</span>
            <StatusBadge status={report.status} />
            <span className="muted">
              {report.staffEmail}{report.staffId ? ` · ${report.staffId}` : ''}
              {report.department ? ` · ${report.department}` : ''}
              {report.jobTitle ? ` · ${report.jobTitle}` : ''}
            </span>
          </div>
        </div>
      </div>

      <StaffSectionsReadout
        report={report}
        review={canAppraise ? { act: rowReview('act'), foc: rowReview('foc') } : undefined}
      />

      <Card>
        <CardHead tag="G" title="Performance appraisal" />
        <p className="muted" style={{ marginBottom: 14 }}>
          Rating scale: 1 Poor · 2 Fair · 3 Good · 4 Very Good · 5 Excellent
        </p>

        {canAppraise ? (
          <>
            <div className="appraise-grid">
              {PARAMS.map(([p, label, hint]) => (
                <div key={p} className="appraise-row">
                  <div><div className="cell-strong">{label}</div><div className="cell-sub">{hint}</div></div>
                  <Stars value={f.ratings[p] ?? 0} onChange={(n) => patch({ ratings: { ...f.ratings, [p]: n } })} />
                  <textarea className="textarea" placeholder="Comments" value={f.comments[p] ?? ''}
                    onChange={(e) => patch({ comments: { ...f.comments, [p]: e.target.value } })} />
                </div>
              ))}
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label>General comments</label>
              <textarea className="textarea" value={f.general}
                onChange={(e) => patch({ general: e.target.value })} />
            </div>
            <div className="field" style={{ marginTop: 12, maxWidth: 320 }}>
              <label>Your name (sign-off)</label>
              <input className="input" value={f.signature} placeholder={me?.fullName}
                onChange={(e) => patch({ signature: e.target.value })} />
            </div>
            <div className="actionbar">
              <span className="grow muted">Declining sends back only the rows you mark as “decline”.</span>
              <button className="btn danger" disabled={busy} onClick={() => submitAppraisal('Declined')}>
                <X size={15} /> Decline &amp; send back
              </button>
              <button className="btn ok" disabled={busy} onClick={() => submitAppraisal('Approved')}>
                <Check size={15} /> Approve
              </button>
            </div>
          </>
        ) : report.status === 'Submitted' ? (
          <p className="muted">Waiting for the assigned supervisor to complete this section.</p>
        ) : report.status === 'Draft' ? (
          <p className="muted">The staff member hasn’t submitted this report yet.</p>
        ) : (
          <AppraisalReadout report={report} />
        )}
      </Card>
    </>
  )
}
