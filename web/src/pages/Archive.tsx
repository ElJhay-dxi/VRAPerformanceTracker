import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Archive, ArrowRight, RotateCcw, Search } from 'lucide-react'
import { ApiError, api } from '../api'
import { useAuth } from '../auth'
import { avatarBg, fmtDate, initials, relativeTime, useAsync } from '../lib'
import { useToast } from '../components/Toast'
import { Card, Empty, Loading, Pager, PageHead } from '../components/ui'
import type { ArchivedStaffSummary } from '../types'

export function ArchivePage() {
  const nav = useNavigate()
  const { me } = useAuth()
  const toast = useToast()
  const isAdmin = me?.role === 'Admin'
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useAsync(() => api.archive({ q: q || undefined, page }), [q, page])
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  const [confirm, setConfirm] = useState<ArchivedStaffSummary | null>(null)
  const [busy, setBusy] = useState(false)

  const runReinstate = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      const u = await api.reinstateArchive(confirm.id)
      toast.ok(`${u.fullName} is back on the Staff List with every report restored.`)
      setConfirm(null)
      reload()
    } catch (e) {
      toast.err(e instanceof ApiError ? e.message : 'Could not reinstate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead
        title="Archive"
        sub="Staff who were removed from the list, kept with every report they filed."
      />

      <div className="input-wrap" style={{ maxWidth: 340, marginBottom: 16 }}>
        <Search />
        <input className="input" placeholder="Name, email, staff ID, department" value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value) }} />
      </div>

      {loading && <Loading />}
      {error && <div className="card" style={{ color: 'var(--bad)' }}>{error}</div>}
      {data && (
        <>
          {data.items.length === 0 ? (
            <Card><Empty icon={<Archive />} title="Nothing archived yet" hint="Deleting someone from the Staff List moves their record here." /></Card>
          ) : (
            <div className="tablewrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Staff ID</th><th>Department</th><th>Role</th>
                    <th>Reports</th><th>Archived</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => nav(`/archive/${a.id}`)}>
                      <td>
                        <div className="wrap" style={{ flexWrap: 'nowrap' }}>
                          <span className="avatar" style={{ background: avatarBg(a.email), width: 28, height: 28 }}>{initials(a.fullName)}</span>
                          <span className="cell-strong">{a.fullName}</span>
                        </div>
                      </td>
                      <td className="cell-sub">{a.email}</td>
                      <td className="cell-sub">{a.staffId ?? '—'}</td>
                      <td>{a.department ?? '—'}</td>
                      <td><span className="role-pill">{a.role}</span></td>
                      <td className="num">{a.reportCount}</td>
                      <td className="cell-sub">
                        {fmtDate(a.archivedAt)}
                        <div style={{ fontSize: 11 }}>by {a.archivedByEmail} · {relativeTime(a.archivedAt)}</div>
                      </td>
                      <td className="right">
                        {isAdmin ? (
                          <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setConfirm(a) }}>
                            <RotateCcw size={14} /> Reinstate
                          </button>
                        ) : (
                          <ArrowRight size={15} style={{ color: 'var(--ink-3)' }} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} totalPages={totalPages} total={data.total} unit="records" onPage={setPage} />
        </>
      )}

      <AnimatePresence>
        {confirm && (
          <>
            <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !busy && setConfirm(null)} />
            <motion.div className="modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.15 }}>
              <div className="modal-ico"><RotateCcw size={20} /></div>
              <h3>Reinstate {confirm.fullName}?</h3>
              <p className="muted">
                Puts them back on the Staff List with their {confirm.role} role, staff
                information and all {confirm.reportCount} report{confirm.reportCount === 1 ? '' : 's'} exactly
                as archived. Their supervisor link is restored if that person is still here.
                They re-link to Microsoft sign-in the next time they log in. The archive
                entry is removed.
              </p>
              <div className="right" style={{ marginTop: 18 }}>
                <button className="btn secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
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
