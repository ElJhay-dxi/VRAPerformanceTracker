import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ChevronDown, RotateCcw } from 'lucide-react'
import { ApiError, api } from '../api'
import { useAuth } from '../auth'
import { fmtDateTime, monthLabel, useAsync } from '../lib'
import { useToast } from '../components/Toast'
import { Card, CardHead, Empty, Loading, StatusBadge } from '../components/ui'
import { AppraisalReadout, StaffSectionsReadout } from './ReportView'
import type { Report } from '../types'

export function ArchiveDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { me } = useAuth()
  const toast = useToast()
  const isAdmin = me?.role === 'Admin'
  const { data, loading, error } = useAsync(() => api.archiveRecord(id!), [id])
  const [open, setOpen] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />
  if (error) return <div className="card" style={{ color: 'var(--bad)' }}>{error}</div>
  if (!data) return null

  const u = data.snapshot.user
  const reports = [...data.snapshot.reports].sort(
    (a, b) => b.year - a.year || b.month - a.month,
  )

  const runReinstate = async () => {
    setBusy(true)
    try {
      const user = await api.reinstateArchive(data.id)
      toast.ok(`${user.fullName} is back on the Staff List with every report restored.`)
      nav('/archive')
    } catch (e) {
      toast.err(e instanceof ApiError ? e.message : 'Could not reinstate')
      setBusy(false)
    }
  }

  return (
    <>
      <button className="btn ghost sm" onClick={() => nav('/archive')} style={{ marginBottom: 14 }}>
        <ArrowLeft size={15} /> Archive
      </button>

      <div className="page-head" style={{ marginBottom: 18 }}>
        <div>
          <div className="h1">{data.fullName}</div>
          <div className="wrap" style={{ marginTop: 6 }}>
            <span className="badge Draft"><span className="dot" />Archived record</span>
            <span className="muted">
              archived {fmtDateTime(data.archivedAt)} by {data.archivedByEmail}
            </span>
          </div>
        </div>
        {isAdmin && (
          <div className="wrap">
            <button className="btn" onClick={() => setConfirm(true)}>
              <RotateCcw size={15} /> Reinstate
            </button>
          </div>
        )}
      </div>

      <Card>
        <CardHead tag="A" title="Staff information (as archived)" />
        <div className="row">
          <Kv k="Email" v={u.email} />
          <Kv k="Staff ID" v={u.staffId} />
          <Kv k="Department / unit" v={u.department} />
          <Kv k="Job title / role" v={u.jobTitle} />
          <Kv k="Role" v={u.role} />
          <Kv k="Supervisor" v={u.supervisorUserName ?? u.supervisorName ?? u.supervisorEmail} />
        </div>
      </Card>

      <CardHead title={`Reports (${reports.length})`} />
      {reports.length === 0 ? (
        <Card><Empty icon={<ArrowLeft />} title="No reports were on file" /></Card>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {reports.map((r) => (
            <ReportBlock key={r.id} report={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {confirm && (
          <>
            <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !busy && setConfirm(false)} />
            <motion.div className="modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.15 }}>
              <div className="modal-ico"><RotateCcw size={20} /></div>
              <h3>Reinstate {data.fullName}?</h3>
              <p className="muted">
                Puts them back on the Staff List with their {u.role} role, staff information
                and all {reports.length} report{reports.length === 1 ? '' : 's'} exactly as
                archived. Their supervisor link is restored if that person is still here.
                They re-link to Microsoft sign-in the next time they log in. The archive
                entry is removed.
              </p>
              <div className="right" style={{ marginTop: 18 }}>
                <button className="btn secondary" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
                <button className="btn" disabled={busy} onClick={runReinstate}>
                  {busy ? 'Reinstating…' : 'Reinstate'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function ReportBlock({ report, open, onToggle }: { report: Report; open: boolean; onToggle: () => void }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          background: 'none', border: 'none', textAlign: 'left',
        }}
      >
        <span className="cell-strong" style={{ minWidth: 130 }}>{monthLabel(report.year, report.month)}</span>
        <StatusBadge status={report.status} />
        <span className="muted">{report.overallRating != null ? `Overall ${report.overallRating} / 5` : 'Not rated'}</span>
        <span style={{ flex: 1 }} />
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }} style={{ lineHeight: 0, color: 'var(--ink-3)' }}>
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--border)' }}>
              <StaffSectionsReadout report={report} />
              {(report.status === 'Approved' || report.status === 'Declined') && (
                <Card>
                  <CardHead tag="G" title="Performance appraisal" />
                  <AppraisalReadout report={report} />
                </Card>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Kv({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span style={{ fontWeight: 500 }}>{v || '—'}</span>
    </div>
  )
}
