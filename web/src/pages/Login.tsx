import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, ShieldAlert, Waves } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { avatarBg, initials, useAsync } from '../lib'
import { Loading } from '../components/ui'

export function Login() {
  const { mode } = useAuth()
  return (
    <div className="login-screen">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="login-brand">
          <span className="brand-mark" style={{ width: 40, height: 40 }}>
            <Waves size={22} />
          </span>
          <div>
            <div className="h1" style={{ fontSize: 20 }}>Performance Tracker</div>
            <div className="muted">VRA Academy · monthly performance reviews</div>
          </div>
        </div>
        {mode === 'entra' ? <EntraLogin /> : <DevLogin />}
      </motion.div>
    </div>
  )
}

function MsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

function EntraLogin() {
  const { login, logout, accessDenied } = useAuth()
  const [busy, setBusy] = useState(false)

  if (accessDenied) {
    return (
      <>
        <div className="card" style={{ borderColor: 'var(--warn)', background: 'var(--warn-soft)', marginTop: 18 }}>
          <div className="wrap" style={{ alignItems: 'flex-start' }}>
            <ShieldAlert size={18} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <b>Signed in, but no access</b>
              <div className="muted" style={{ marginTop: 4 }}>{accessDenied}</div>
            </div>
          </div>
        </div>
        <button className="btn secondary block" style={{ marginTop: 12 }} onClick={() => logout()}>
          Try a different account
        </button>
      </>
    )
  }

  return (
    <>
      <p className="muted" style={{ margin: '18px 0 14px' }}>
        Sign in with your VRA Microsoft account to continue.
      </p>
      <button
        className="btn block lg"
        disabled={busy}
        onClick={() => { setBusy(true); void login() }}
      >
        <MsIcon /> {busy ? 'Redirecting…' : 'Sign in with Microsoft'}
      </button>
    </>
  )
}

function DevLogin() {
  const { login } = useAuth()
  const nav = useNavigate()
  const { data: users, error } = useAsync(() => api.devUsers(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const pick = async (email: string) => {
    setBusy(email)
    setFailed(null)
    try {
      await login(email)
      nav('/', { replace: true })
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Login failed')
      setBusy(null)
    }
  }

  return (
    <>
      <p className="muted" style={{ margin: '18px 0 6px' }}>
        Development sign-in. In production this becomes <b>Sign in with Microsoft</b> (Entra ID).
      </p>

      {error && <div className="card" style={{ borderColor: 'var(--bad)', color: 'var(--bad)', padding: 12 }}>{error}</div>}
      {failed && <div className="card" style={{ borderColor: 'var(--bad)', color: 'var(--bad)', padding: 12 }}>{failed}</div>}
      {!users && !error && <Loading label="Loading users" />}

      <div className="login-list">
        {users?.map((u, i) => (
          <motion.button
            key={u.id}
            className="login-user"
            disabled={!!busy}
            onClick={() => pick(u.email)}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 * i }}
          >
            <span className="avatar" style={{ background: avatarBg(u.email), width: 34, height: 34 }}>
              {initials(u.fullName)}
            </span>
            <span className="lu-text">
              <b>{u.fullName}</b>
              <span className="muted">{u.email}</span>
            </span>
            <span className="role-pill">{u.role}</span>
            {busy === u.email ? <span className="spinner" /> : <ArrowRight size={16} style={{ color: 'var(--ink-3)' }} />}
          </motion.button>
        ))}
      </div>
    </>
  )
}
