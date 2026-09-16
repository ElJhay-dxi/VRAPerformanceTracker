import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, Lock, Plus, RotateCw, Send, Trash2 } from 'lucide-react'
import { ApiError, api, type SaveReportBody } from '../api'
import { monthLabel, fmtDateTime, useAsync } from '../lib'
import { Card, CardHead, Loading, StatusBadge } from '../components/ui'
import { useToast } from '../components/Toast'
import type { ActivityRow, FocusRow, Report } from '../types'
import { AppraisalReadout, StaffSectionsReadout } from './ReportView'

type Draft = {
  keyAchievements: string; innovations: string
  newSkills: string; knowledgeGained: string; toolsLearned: string
  keyChallenges: string; supportRequired: string
  staffSignatureName: string; staffSignOffDate: string
  activities: ActivityRow[]
  focusAreas: FocusRow[]
}

const s = (v: string | null | undefined) => v ?? ''
const tmpId = () => 'tmp-' + Math.random().toString(36).slice(2)

const blankActivity = (lineNo: number): ActivityRow => ({
  id: tmpId(), lineNo, keyActivity: '', descriptionOfWork: '', outputResult: '', status: null,
  rolledOver: false, reviewStatus: 'Pending', reviewComment: null,
})
const blankFocus = (lineNo: number): FocusRow => ({
  id: tmpId(), lineNo, plannedActivity: '', expectedOutcome: '', supportRequired: '',
  status: 'Pending', rolledOver: false, reviewStatus: 'Pending', reviewComment: null,
})

function toDraft(r: Report): Draft {
  return {
    keyAchievements: s(r.keyAchievements), innovations: s(r.innovations),
    newSkills: s(r.newSkills), knowledgeGained: s(r.knowledgeGained), toolsLearned: s(r.toolsLearned),
    keyChallenges: s(r.keyChallenges), supportRequired: s(r.supportRequired),
    staffSignatureName: s(r.staffSignatureName), staffSignOffDate: s(r.staffSignOffDate),
    activities: r.activities.length ? r.activities.map((a) => ({ ...a })) : [blankActivity(1)],
    focusAreas: r.focusAreas.length ? r.focusAreas.map((f) => ({ ...f })) : [blankFocus(1)],
  }
}

function toBody(d: Draft): SaveReportBody {
  const clean = (v: string) => (v.trim() === '' ? null : v)
  const realId = (id: string) => (id.startsWith('tmp-') ? null : id)
  return {
    keyAchievements: clean(d.keyAchievements), innovations: clean(d.innovations),
    newSkills: clean(d.newSkills), knowledgeGained: clean(d.knowledgeGained), toolsLearned: clean(d.toolsLearned),
    keyChallenges: clean(d.keyChallenges), supportRequired: clean(d.supportRequired),
    staffSignatureName: clean(d.staffSignatureName),
    staffSignOffDate: d.staffSignOffDate || null,
    activities: d.activities.map((a, i) => ({
      id: realId(a.id), lineNo: i + 1,
      keyActivity: clean(s(a.keyActivity)), descriptionOfWork: clean(s(a.descriptionOfWork)),
      outputResult: clean(s(a.outputResult)), status: a.status,
    })),
    focusAreas: d.focusAreas.map((f, i) => ({
      id: realId(f.id), lineNo: i + 1,
      plannedActivity: clean(s(f.plannedActivity)), expectedOutcome: clean(s(f.expectedOutcome)),
      supportRequired: clean(s(f.supportRequired)), status: f.status,
    })),
  }
}

const SECTIONS = [
  ['b', 'B · Activities'],
  ['c', 'C · Achievements'],
  ['d', 'D · Skills gained'],
  ['e', 'E · Challenges'],
  ['f', 'F · Next month'],
  ['signoff', 'Sign-off'],
  ['g', 'G · Appraisal'],
]

export function ReportEditor() {
  const { year, month } = useParams()
  const y = Number(year)
  const m = Number(month)
  const nav = useNavigate()
  const toast = useToast()

  const { data: loaded, error, loading, setData } = useAsync<Report | null>(
    async () => {
      const existing = await api.myReport(y, m)
      if (existing) return existing
      try {
        return await api.createMyReport(y, m)
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) return api.myReport(y, m)
        throw e
      }
    },
    [y, m],
  )

  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState('b')

  useEffect(() => { if (loaded) setDraft(toDraft(loaded)) }, [loaded])

  const editable = loaded?.status === 'Draft' || loaded?.status === 'Declined'
  const declined = loaded?.status === 'Declined'
  /** On a declined report only the rows the supervisor marked 'Declined' can be edited. */
  const rowLocked = (rs: ActivityRow['reviewStatus']) => declined && rs !== 'Declined'
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  const progress = useMemo(() => {
    if (!draft) return 0
    const checks = [
      draft.activities.some((a) => s(a.keyActivity).trim()),
      draft.keyAchievements.trim() || draft.innovations.trim(),
      draft.newSkills.trim() || draft.knowledgeGained.trim() || draft.toolsLearned.trim(),
      draft.keyChallenges.trim() || draft.supportRequired.trim(),
      draft.focusAreas.some((f) => s(f.plannedActivity).trim()),
      draft.staffSignatureName.trim(),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [draft])

  const save = async (silent = false) => {
    if (!loaded || !draft) return null
    const updated = await api.saveReport(loaded.id, toBody(draft))
    setData(updated)
    setDraft(toDraft(updated))
    if (!silent) toast.ok('Draft saved.')
    return updated
  }

  const onSave = async () => {
    setBusy(true)
    try { await save() } catch (e) { toast.err(e instanceof Error ? e.message : 'Save failed') } finally { setBusy(false) }
  }
  const onSubmit = async () => {
    setBusy(true)
    try {
      await save(true)
      const done = await api.submitReport(loaded!.id)
      setData(done)
      setDraft(toDraft(done))
      toast.ok(declined ? 'Resubmitted for review.' : 'Submitted to your supervisor.', 'Sent')
    } catch (e) {
      toast.err(e instanceof Error ? e.message : 'Submit failed')
    } finally { setBusy(false) }
  }

  if (loading) return <Loading />
  if (error) return <div className="card" style={{ color: 'var(--bad)' }}>{error}</div>
  if (!loaded || !draft) return null

  const showAppraisal = loaded.status === 'Approved' || loaded.status === 'Declined'

  const removeActivity = (i: number) => set('activities', draft.activities.filter((_, x) => x !== i))
  const removeFocus = (i: number) => set('focusAreas', draft.focusAreas.filter((_, x) => x !== i))

  return (
    <>
      <button className="btn ghost sm" onClick={() => nav('/my-reports')} style={{ marginBottom: 14 }}>
        <ArrowLeft size={15} /> My reports
      </button>

      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div className="h1">{monthLabel(loaded.year, loaded.month)}</div>
          <div className="wrap" style={{ marginTop: 6 }}>
            <StatusBadge status={loaded.status} />
            {editable && <span className="muted">{progress}% complete</span>}
          </div>
        </div>
      </div>

      {editable && <div className="pbar" style={{ marginBottom: 18 }}><i style={{ width: `${progress}%` }} /></div>}

      <Banner report={loaded} />

      <div className={editable ? 'editor-grid' : ''}>
        {editable && (
          <nav className="rail">
            {SECTIONS.filter(([id]) => id !== 'g' || showAppraisal).map(([id, label]) => (
              <a key={id} href={`#sec-${id}`} className={active === id ? 'active' : ''} onClick={() => setActive(id)}>
                {label}
              </a>
            ))}
          </nav>
        )}

        <div style={{ minWidth: 0 }}>
          {!editable ? (
            <>
              <StaffSectionsReadout report={loaded} />
              {showAppraisal && (
                <Card id="sec-g">
                  <CardHead tag="G" title="Performance appraisal (by your supervisor)" />
                  <AppraisalReadout report={loaded} />
                </Card>
              )}
            </>
          ) : (
            <>
              {/* Section B */}
              <Card id="sec-b">
                <CardHead tag="B" title="Monthly activities performed" />
                {declined && (
                  <p className="muted" style={{ marginBottom: 8 }}>
                    Only the rows your supervisor flagged can be edited. The rest are locked.
                  </p>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table className="gtbl">
                    <thead>
                      <tr>
                        <th />
                        <th style={{ minWidth: 150 }}>Key activity / task</th>
                        <th style={{ minWidth: 190 }}>Description of work done</th>
                        <th style={{ minWidth: 160 }}>Output / result</th>
                        <th style={{ width: 130 }}>Status</th>
                        <th style={{ width: 34 }} />
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {draft.activities.map((a, i) => {
                          const lock = rowLocked(a.reviewStatus)
                          return (
                            <motion.tr key={a.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              <td>
                                {i + 1}
                                <RowFlags row={a} />
                              </td>
                              <td><textarea className="textarea" disabled={lock} value={s(a.keyActivity)}
                                onChange={(e) => set('activities', patch(draft.activities, i, { keyActivity: e.target.value }))} /></td>
                              <td><textarea className="textarea" disabled={lock} value={s(a.descriptionOfWork)}
                                onChange={(e) => set('activities', patch(draft.activities, i, { descriptionOfWork: e.target.value }))} /></td>
                              <td><textarea className="textarea" disabled={lock} value={s(a.outputResult)}
                                onChange={(e) => set('activities', patch(draft.activities, i, { outputResult: e.target.value }))} /></td>
                              <td>
                                <select className="select" disabled={lock} value={a.status ?? ''}
                                  onChange={(e) => set('activities', patch(draft.activities, i, { status: (e.target.value || null) as ActivityRow['status'] }))}>
                                  <option value="">—</option>
                                  <option value="Completed">Completed</option>
                                  <option value="Ongoing">Ongoing</option>
                                </select>
                              </td>
                              <td>
                                {!lock && (
                                  <button className="iconbtn" style={{ width: 30, height: 30 }} disabled={draft.activities.length === 1}
                                    onClick={() => removeActivity(i)} aria-label="Remove row">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </td>
                            </motion.tr>
                          )
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
                <button className="btn ghost sm" style={{ marginTop: 10 }}
                  onClick={() => set('activities', [...draft.activities, blankActivity(draft.activities.length + 1)])}>
                  <Plus size={14} /> Add row
                </button>
              </Card>

              {/* Section C */}
              <Card id="sec-c">
                <CardHead tag="C" title="Key achievements, innovation and creativity" />
                <Text label="Major accomplishments this month" v={draft.keyAchievements} on={(v) => set('keyAchievements', v)} />
                <Text label="Major innovations developed and implemented" v={draft.innovations} on={(v) => set('innovations', v)} />
              </Card>

              {/* Section D */}
              <Card id="sec-d">
                <CardHead tag="D" title="Skills & experience gained" />
                <Text label="New skills acquired" v={draft.newSkills} on={(v) => set('newSkills', v)} />
                <Text label="Knowledge / experience gained" v={draft.knowledgeGained} on={(v) => set('knowledgeGained', v)} />
                <Text label="Tools / systems learned" v={draft.toolsLearned} on={(v) => set('toolsLearned', v)} />
              </Card>

              {/* Section E */}
              <Card id="sec-e">
                <CardHead tag="E" title="Challenges encountered" />
                <Text label="Key challenges faced" v={draft.keyChallenges} on={(v) => set('keyChallenges', v)} />
                <Text label="Support required" v={draft.supportRequired} on={(v) => set('supportRequired', v)} />
              </Card>

              {/* Section F */}
              <Card id="sec-f">
                <CardHead tag="F" title="Key focus areas for next month" />
                <div style={{ overflowX: 'auto' }}>
                  <table className="gtbl">
                    <thead>
                      <tr>
                        <th />
                        <th style={{ minWidth: 170 }}>Planned activity</th>
                        <th style={{ minWidth: 180 }}>Expected outcome</th>
                        <th style={{ minWidth: 160 }}>Support required</th>
                        <th style={{ width: 128 }}>Status</th>
                        <th style={{ width: 34 }} />
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {draft.focusAreas.map((f, i) => {
                          const lock = rowLocked(f.reviewStatus)
                          return (
                            <motion.tr key={f.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              <td>{i + 1}<RowFlags row={f} /></td>
                              <td><textarea className="textarea" disabled={lock} value={s(f.plannedActivity)}
                                onChange={(e) => set('focusAreas', patch(draft.focusAreas, i, { plannedActivity: e.target.value }))} /></td>
                              <td><textarea className="textarea" disabled={lock} value={s(f.expectedOutcome)}
                                onChange={(e) => set('focusAreas', patch(draft.focusAreas, i, { expectedOutcome: e.target.value }))} /></td>
                              <td><textarea className="textarea" disabled={lock} value={s(f.supportRequired)}
                                onChange={(e) => set('focusAreas', patch(draft.focusAreas, i, { supportRequired: e.target.value }))} /></td>
                              <td>
                                <select className="select" disabled={lock} value={f.status}
                                  onChange={(e) => set('focusAreas', patch(draft.focusAreas, i, { status: e.target.value as FocusRow['status'] }))}>
                                  <option value="Pending">Pending</option>
                                  <option value="Completed">Completed</option>
                                  <option value="Update">Update</option>
                                </select>
                              </td>
                              <td>
                                {!lock && (
                                  <button className="iconbtn" style={{ width: 30, height: 30 }} disabled={draft.focusAreas.length === 1}
                                    onClick={() => removeFocus(i)} aria-label="Remove row">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </td>
                            </motion.tr>
                          )
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Anything left <b>Pending</b> or <b>Update</b> rolls into next month’s report. <b>Completed</b> drops off.
                </p>
                <button className="btn ghost sm" style={{ marginTop: 10 }}
                  onClick={() => set('focusAreas', [...draft.focusAreas, blankFocus(draft.focusAreas.length + 1)])}>
                  <Plus size={14} /> Add row
                </button>
              </Card>

              {/* Sign-off */}
              <Card id="sec-signoff">
                <CardHead title="Staff sign-off" />
                <div className="row">
                  <div className="field">
                    <label>Your name</label>
                    <input className="input" value={draft.staffSignatureName}
                      onChange={(e) => set('staffSignatureName', e.target.value)} placeholder="Type your full name" />
                  </div>
                  <div className="field" style={{ maxWidth: 200 }}>
                    <label>Date</label>
                    <input className="input" type="date" value={draft.staffSignOffDate}
                      onChange={(e) => set('staffSignOffDate', e.target.value)} />
                  </div>
                </div>
              </Card>

              {showAppraisal && (
                <Card id="sec-g">
                  <CardHead tag="G" title="Performance appraisal (by your supervisor)" />
                  {declined && (
                    <p className="muted" style={{ marginBottom: 10 }}>
                      You’ll see the final scores once the report is approved. For now, here are the notes.
                    </p>
                  )}
                  <AppraisalReadout report={loaded} hideScores={declined} />
                </Card>
              )}

              <div className="actionbar">
                <span className="muted grow">
                  {declined ? 'Fix the flagged items, then resubmit.' : 'Nothing is shared until you submit.'}
                </span>
                <button className="btn secondary" disabled={busy} onClick={onSave}>
                  <Check size={15} /> Save draft
                </button>
                <button className="btn" disabled={busy} onClick={onSubmit}>
                  <Send size={15} /> {declined ? 'Resubmit' : 'Submit to supervisor'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function RowFlags({ row }: { row: ActivityRow | FocusRow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
      {row.rolledOver && (
        <span className="tag-roll" title="Carried over from last month">
          <RotateCw size={10} /> carried
        </span>
      )}
      {row.reviewStatus === 'Approved' && (
        <span className="tag-lock ok" title="Approved by your supervisor — locked">
          <Lock size={10} /> approved
        </span>
      )}
      {row.reviewStatus === 'Declined' && row.reviewComment && (
        <span className="tag-lock bad" title={row.reviewComment}>needs work</span>
      )}
    </div>
  )
}

function Banner({ report }: { report: Report }) {
  if (report.status === 'Declined') {
    return (
      <div className="card" style={{ borderColor: 'var(--bad)', background: 'var(--bad-soft)' }}>
        <b>Sent back by {report.reviewedByName ?? 'your supervisor'}.</b>{' '}
        {report.decisionComment || report.supervisorGeneralComments || 'See the flagged rows below.'} Make the changes and resubmit.
      </div>
    )
  }
  if (report.status === 'Submitted') {
    return (
      <div className="card" style={{ borderColor: 'var(--info)', background: 'var(--info-soft)' }}>
        Submitted {fmtDateTime(report.submittedAt)}. Waiting for supervisor review — you can’t edit it now.
      </div>
    )
  }
  if (report.status === 'Approved') {
    return (
      <div className="card" style={{ borderColor: 'var(--ok)', background: 'var(--ok-soft)' }}>
        Approved {fmtDateTime(report.reviewedAt)} by {report.reviewedByName}.
      </div>
    )
  }
  return null
}

function Text({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="field" style={{ marginBottom: 12 }}>
      <label>{label}</label>
      <textarea className="textarea" value={v} onChange={(e) => on(e.target.value)} />
    </div>
  )
}

function patch<T>(rows: T[], i: number, changes: Partial<T>): T[] {
  return rows.map((r, x) => (x === i ? { ...r, ...changes } : r))
}
