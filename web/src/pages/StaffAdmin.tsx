import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Search, Trash2, TriangleAlert, UserPlus, UserRoundCog, X } from 'lucide-react'
import { ApiError, api, type CreateUserBody } from '../api'
import { useAuth } from '../auth'
import { avatarBg, initials, useAsync } from '../lib'
import { Card, Empty, Loading, PageHead, Segmented } from '../components/ui'
import { useToast } from '../components/Toast'
import type { Role, UserItem } from '../types'

const ROLES: Role[] = ['Staff', 'Supervisor', 'Admin', 'Hr']

type Panel = { type: 'edit'; user: UserItem } | { type: 'create' } | null

export function StaffAdmin() {
  const { me } = useAuth()
  const toast = useToast()
  const readOnly = me?.role !== 'Admin'
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const { data: users, loading, error, reload } = useAsync(
    () => api.users({ q: q || undefined, role: roleFilter === 'all' ? undefined : roleFilter }),
    [q, roleFilter],
  )
  const [panel, setPanel] = useState<Panel>(null)
  const [confirmDelete, setConfirmDelete] = useState<UserItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const runDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await api.deleteUser(confirmDelete.id)
      toast.ok(`${confirmDelete.fullName} removed — record kept in the Archive.`)
      setConfirmDelete(null)
      reload()
    } catch (e) {
      toast.err(e instanceof ApiError ? e.message : 'Could not delete')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHead
        title="Staff List"
        sub={readOnly ? 'Read-only. Only an administrator can make changes.' : 'Manage staff information, roles and supervisors.'}
        actions={
          !readOnly && (
            <button className="btn" onClick={() => setPanel({ type: 'create' })}>
              <UserPlus size={15} /> Add user
            </button>
          )
        }
      />

      <div className="wrap" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
        <Segmented<Role | 'all'>
          value={roleFilter}
          onChange={setRoleFilter}
          options={[{ value: 'all', label: 'All' }, ...ROLES.map((r) => ({ value: r, label: r }))]}
        />
        <div className="input-wrap" style={{ width: 280 }}>
          <Search />
          <input className="input" placeholder="Name, email, staff ID, department" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading && <Loading />}
      {error && <div className="card" style={{ color: 'var(--bad)' }}>{error}</div>}
      {users && users.length === 0 && (
        <Card><Empty icon={<UserRoundCog />} title="No people match" /></Card>
      )}
      {users && users.length > 0 && (
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Staff ID</th><th>Department</th><th>Role</th>
                <th>Supervisor</th><th>Status</th><th style={{ width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="wrap" style={{ flexWrap: 'nowrap' }}>
                      <span className="avatar" style={{ background: avatarBg(u.email), width: 28, height: 28 }}>{initials(u.fullName)}</span>
                      <span className="cell-strong">{u.fullName}</span>
                    </div>
                  </td>
                  <td className="cell-sub">{u.email}</td>
                  <td className="cell-sub">{u.staffId ?? '—'}</td>
                  <td>{u.department ?? '—'}</td>
                  <td><span className="role-pill">{u.role}</span></td>
                  <td>{u.supervisorUserName ?? u.supervisorEmail ?? '—'}</td>
                  <td>{u.isActive ? <span className="badge Approved"><span className="dot" />Active</span> : <span className="badge Declined"><span className="dot" />Inactive</span>}</td>
                  <td className="right">
                    {!readOnly && (
                      <div className="wrap" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm" onClick={() => setPanel({ type: 'edit', user: u })}>Edit</button>
                        <button
                          className="iconbtn"
                          style={{ width: 30, height: 30, color: 'var(--bad)' }}
                          title={u.id === me?.id ? "You can't delete your own account" : 'Delete'}
                          disabled={u.id === me?.id}
                          onClick={() => setConfirmDelete(u)}
                          aria-label={`Delete ${u.fullName}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* edit / create drawer */}
      <AnimatePresence>
        {panel && (
          <>
            <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPanel(null)} />
            <motion.div className="drawer"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}>
              {panel.type === 'edit' ? (
                <EditUser
                  user={panel.user}
                  allUsers={users ?? []}
                  isSelf={panel.user.id === me?.id}
                  onSaved={reload}
                  onClose={() => setPanel(null)}
                  toastOk={toast.ok}
                  toastErr={toast.err}
                />
              ) : (
                <CreateUser
                  allUsers={users ?? []}
                  onCreated={() => { reload(); setPanel(null) }}
                  onClose={() => setPanel(null)}
                  toastOk={toast.ok}
                  toastErr={toast.err}
                />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <>
            <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !deleting && setConfirmDelete(null)} />
            <motion.div className="modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.15 }}>
              <div className="modal-ico"><TriangleAlert size={20} /></div>
              <h3>Delete {confirmDelete.fullName}?</h3>
              <p className="muted">
                Removes them from the staff list and frees their slot. Their full record
                and every report they filed are first copied to the <b>Archive</b>, where
                Admin and HR can still read them.
              </p>
              <div className="right" style={{ marginTop: 18 }}>
                <button className="btn secondary" disabled={deleting} onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button className="btn danger" disabled={deleting} onClick={runDelete}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

/* ---------------- create ---------------- */
function CreateUser({
  allUsers, onCreated, onClose, toastOk, toastErr,
}: {
  allUsers: UserItem[]
  onCreated: () => void
  onClose: () => void
  toastOk: (t: string) => void
  toastErr: (t: string) => void
}) {
  const [f, setF] = useState<CreateUserBody>({ email: '', fullName: '', role: 'Staff' })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof CreateUserBody>(k: K, v: CreateUserBody[K]) => setF((x) => ({ ...x, [k]: v }))
  const candidates = allUsers.filter((u) => u.isActive)

  const submit = async () => {
    if (!f.email.trim() || !f.email.includes('@')) return toastErr('A valid email is required.')
    if (!f.fullName.trim()) return toastErr('Full name is required.')
    setBusy(true)
    try {
      const staffRole = f.role === 'Staff'
      const created = await api.createUser({
        ...f,
        email: f.email.trim(),
        fullName: f.fullName.trim(),
        staffId: f.staffId || null,
        department: f.department || null,
        jobTitle: f.jobTitle || null,
        supervisorUserId: staffRole ? f.supervisorUserId || null : null,
        supervisorName: staffRole && !f.supervisorUserId ? f.supervisorName || null : null,
        supervisorEmail: staffRole && !f.supervisorUserId ? f.supervisorEmail || null : null,
      })
      toastOk(`${created.fullName} added.`)
      onCreated()
    } catch (e) {
      toastErr(e instanceof Error ? e.message : 'Could not create user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="drawer-h">
        <span className="avatar" style={{ background: 'var(--surface-3)', color: 'var(--ink-3)' }}><UserPlus size={16} /></span>
        <div style={{ flex: 1 }}><h3>Add a new person</h3><div className="cell-sub">They can sign in once Entra is wired; for now they show in the list.</div></div>
        <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      <div className="drawer-b">
        <div className="row"><Field l="Full name *" v={f.fullName} on={(v) => set('fullName', v)} />
          <Field l="Email *" v={f.email} on={(v) => set('email', v)} placeholder="name@vra.com" /></div>
        <div className="row"><Field l="Staff ID" v={f.staffId ?? ''} on={(v) => set('staffId', v)} />
          <Field l="Department / unit" v={f.department ?? ''} on={(v) => set('department', v)} /></div>
        <div className="row"><Field l="Job title / role" v={f.jobTitle ?? ''} on={(v) => set('jobTitle', v)} />
          <div className="field">
            <label>Role</label>
            <select className="select" value={f.role} onChange={(e) => set('role', e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        {f.role === 'Staff' ? (
          <>
            <div className="divide" />
            <div className="eyebrow" style={{ marginBottom: 8 }}>Supervisor</div>
            <div className="field">
              <label>Supervising user (system account)</label>
              <select className="select" value={f.supervisorUserId ?? ''} onChange={(e) => set('supervisorUserId', e.target.value)}>
                <option value="">— not a system account —</option>
                {candidates.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>)}
              </select>
              <span className="cell-sub">Picking someone here drives whose review queue this person’s reports land in.</span>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <Field l="Supervisor name" v={f.supervisorName ?? ''} on={(v) => set('supervisorName', v)}
                placeholder="If not in the list above" disabled={!!f.supervisorUserId} />
              <Field l="Supervisor email" v={f.supervisorEmail ?? ''} on={(v) => set('supervisorEmail', v)}
                placeholder="If not in the list above" disabled={!!f.supervisorUserId} />
            </div>
            <span className="cell-sub">
              {f.supervisorUserId
                ? 'Name and email are taken from the selected account.'
                : 'Use these when the supervisor isn’t a system account yet.'}
            </span>
          </>
        ) : (
          <>
            <div className="divide" />
            <span className="cell-sub">
              Supervisor/Admin/HR run the app — only Staff (new recruits) are assigned a supervisor.
            </span>
          </>
        )}
      </div>

      <div className="drawer-f">
        <button className="btn secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Adding…' : 'Add user'}</button>
      </div>
    </>
  )
}

/* ---------------- edit ---------------- */
function EditUser({
  user, allUsers, isSelf, onSaved, onClose, toastOk, toastErr,
}: {
  user: UserItem
  allUsers: UserItem[]
  isSelf: boolean
  onSaved: () => void
  onClose: () => void
  toastOk: (t: string, title?: string) => void
  toastErr: (t: string, title?: string) => void
}) {
  const [fullName, setFullName] = useState(user.fullName)
  const [email, setEmail] = useState(user.email)
  const [staffId, setStaffId] = useState(user.staffId ?? '')
  const [department, setDepartment] = useState(user.department ?? '')
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? '')
  const [supervisorName, setSupervisorName] = useState(user.supervisorName ?? '')
  const [supervisorEmail, setSupervisorEmail] = useState(user.supervisorEmail ?? '')
  const [role, setRole] = useState<Role>(user.role)
  const [supervisorUserId, setSupervisorUserId] = useState(user.supervisorUserId ?? '')
  const [busy, setBusy] = useState(false)

  const candidates = allUsers.filter((u) => u.id !== user.id && u.isActive)

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toastOk(ok); onSaved() }
    catch (e) { toastErr(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="drawer-h">
        <span className="avatar" style={{ background: avatarBg(user.email) }}>{initials(user.fullName)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.fullName}</h3>
          <div className="cell-sub">{user.email}</div>
        </div>
        <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      <div className="drawer-b">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Staff information</div>
        <div className="row"><Field l="Full name" v={fullName} on={setFullName} /><Field l="Email" v={email} on={setEmail} placeholder="name@vra.com" /></div>
        <div className="row"><Field l="Staff ID" v={staffId} on={setStaffId} /><Field l="Department / unit" v={department} on={setDepartment} /></div>
        <div className="row"><Field l="Job title / role" v={jobTitle} on={setJobTitle} /><span style={{ flex: 1 }} /></div>
        {user.role === 'Staff' && (
          <div className="row"><Field l="Supervisor name (as on form)" v={supervisorName} on={setSupervisorName} /><Field l="Supervisor email" v={supervisorEmail} on={setSupervisorEmail} /></div>
        )}
        <button className="btn secondary sm" style={{ marginTop: 12 }} disabled={busy}
          onClick={() => run(() => api.setProfile(user.id, {
            fullName, email, staffId: staffId || null, department: department || null, jobTitle: jobTitle || null,
            supervisorName: user.role === 'Staff' ? supervisorName || null : null,
            supervisorEmail: user.role === 'Staff' ? supervisorEmail || null : null,
          }), 'Staff information saved.')}>
          Save staff info
        </button>

        <div className="divide" />

        <div className="eyebrow" style={{ marginBottom: 10 }}>Role</div>
        {isSelf && <p className="muted" style={{ marginBottom: 8 }}>You can’t change your own role or status.</p>}
        <div className="row tight" style={{ alignItems: 'flex-end' }}>
          <div className="field">
            <label>Role</label>
            <select className="select" value={role} disabled={isSelf} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button className="btn sm" disabled={busy || isSelf || role === user.role}
            onClick={() => run(() => api.setRole(user.id, role), `Role set to ${role}.`)}>Update</button>
        </div>

        <div className="divide" />

        <div className="eyebrow" style={{ marginBottom: 6 }}>Supervising user</div>
        {user.role === 'Staff' ? (
          <>
            <p className="muted" style={{ marginBottom: 10 }}>Whose queue this person’s reports land in.</p>
            <div className="row tight" style={{ alignItems: 'flex-end' }}>
              <div className="field">
                <label>Supervisor</label>
                <select className="select" value={supervisorUserId} onChange={(e) => setSupervisorUserId(e.target.value)}>
                  <option value="">— none —</option>
                  {candidates.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>)}
                </select>
              </div>
              <button className="btn sm" disabled={busy}
                onClick={() => run(() => api.setSupervisor(user.id, supervisorUserId || null), 'Supervisor updated.')}>Assign</button>
            </div>
          </>
        ) : (
          <p className="muted" style={{ marginBottom: 10 }}>
            {user.role} accounts run the app and aren’t assigned a supervisor. Change the role to Staff to assign one.
          </p>
        )}

        <div className="divide" />

        <div className="eyebrow" style={{ marginBottom: 10 }}>Account status</div>
        <button className={`btn sm ${user.isActive ? 'danger' : 'secondary'}`} disabled={busy || isSelf}
          onClick={() => run(() => api.setActive(user.id, !user.isActive), user.isActive ? 'User deactivated.' : 'User reactivated.')}>
          {user.isActive ? 'Deactivate account' : 'Reactivate account'}
        </button>
      </div>

      <div className="drawer-f">
        <button className="btn secondary" onClick={onClose}>Done</button>
      </div>
    </>
  )
}

function Field({
  l, v, on, placeholder, disabled,
}: { l: string; v: string; on: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div className="field">
      <label>{l}</label>
      <input className="input" value={v} placeholder={placeholder} disabled={disabled}
        onChange={(e) => on(e.target.value)} />
    </div>
  )
}
