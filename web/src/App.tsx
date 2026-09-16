import { useEffect, useRef, useState } from 'react'
import {
  BrowserRouter, NavLink, Navigate, Route, Routes, useLocation,
} from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity, Archive, BarChart3, ClipboardCheck, FileText, Files, LayoutDashboard, LogOut,
  Menu, Moon, Sun, Users, Waves,
} from 'lucide-react'
import { MsalProvider } from '@azure/msal-react'
import { DevAuthProvider, useAuth } from './auth'
import { EntraAuthProvider } from './authEntra'
import { entraEnabled, msalInstance } from './auth/entra'
import { ThemeProvider, useTheme } from './theme'
import { ToastProvider } from './components/Toast'
import { avatarBg, initials } from './lib'
import type { Role } from './types'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { MyReports } from './pages/MyReports'
import { ReportEditor } from './pages/ReportEditor'
import { AssignedReports } from './pages/AssignedReports'
import { ReportView } from './pages/ReportView'
import { StaffAdmin } from './pages/StaffAdmin'
import { AllReports } from './pages/AllReports'
import { ActivityLog } from './pages/ActivityLog'
import { ArchivePage } from './pages/Archive'
import { ArchiveDetail } from './pages/ArchiveDetail'
import { Analytics } from './pages/Analytics'

const HOME_BY_ROLE: Record<Role, string> = {
  Staff: '/overview',
  Supervisor: '/overview',
  Admin: '/overview',
  Hr: '/overview',
}

const NAV: { to: string; label: string; icon: typeof FileText; roles: Role[] | 'all' }[] = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard, roles: 'all' },
  { to: '/my-reports', label: 'My reports', icon: FileText, roles: ['Staff'] },
  { to: '/assigned', label: 'Assigned to me', icon: ClipboardCheck, roles: ['Supervisor'] },
  { to: '/staff', label: 'Staff List', icon: Users, roles: ['Admin', 'Hr'] },
  { to: '/all-reports', label: 'All reports', icon: Files, roles: ['Admin', 'Hr'] },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['Admin', 'Hr'] },
  { to: '/archive', label: 'Archive', icon: Archive, roles: ['Admin', 'Hr'] },
  { to: '/activity-log', label: 'Activity log', icon: Activity, roles: ['Admin', 'Hr'] },
]

const CRUMB: Record<string, string> = {
  '/overview': 'Overview',
  '/my-reports': 'My reports',
  '/assigned': 'Assigned to me',
  '/staff': 'Staff List',
  '/all-reports': 'All reports',
  '/analytics': 'Analytics',
  '/archive': 'Archive',
  '/activity-log': 'Activity log',
  '/reports': 'Report',
}

function UserMenu() {
  const { me, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  if (!me) return null
  return (
    <div className="usermenu" ref={ref}>
      <button className="userchip" onClick={() => setOpen((o) => !o)}>
        <span className="avatar" style={{ background: avatarBg(me.email) }}>{initials(me.fullName)}</span>
        <span className="uname">{me.fullName}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            <div className="menu-head">
              <b>{me.fullName}</b>
              <span>{me.email}</span>
            </div>
            <button className="mi" onClick={logout}>
              <LogOut /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Shell() {
  const { me, loading } = useAuth()
  const { mode, toggle } = useTheme()
  const loc = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => setNavOpen(false), [loc.pathname])

  if (loading) {
    return (
      <div className="center-page">
        <div className="spinner" />
      </div>
    )
  }
  if (!me) return <Login />

  const can = (roles: Role[] | 'all') => roles === 'all' || roles.includes(me.role)
  const crumb = CRUMB[loc.pathname] ?? CRUMB['/' + loc.pathname.split('/')[1]] ?? ''

  return (
    <div className="app">
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Waves size={19} /></span>
          <span className="brand-text">
            <b>Performance Tracker</b>
            <span>VRA Academy</span>
          </span>
        </div>
        <div className="nav-label">Workspace</div>
        {NAV.filter((n) => can(n.roles)).map((n) => (
          <NavLink key={n.to} to={n.to} className="nav-item">
            <n.icon />
            {n.label}
          </NavLink>
        ))}
        <div className="sidebar-foot">Signed in as {me.role}</div>
      </aside>

      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

      <div className="content">
        <header className="topbar">
          <button className="iconbtn hamburger" onClick={() => setNavOpen(true)} aria-label="Menu">
            <Menu />
          </button>
          <span className="crumb">{crumb}</span>
          <span className="spacer" />
          <button className="iconbtn" onClick={toggle} aria-label="Toggle theme">
            {mode === 'dark' ? <Sun /> : <Moon />}
          </button>
          <UserMenu />
        </header>

        <motion.div
          key={loc.pathname}
          className="page"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Routes location={loc}>
              <Route path="/" element={<Navigate to={HOME_BY_ROLE[me.role]} replace />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/overview" element={<Dashboard />} />
              <Route path="/my-reports" element={can(['Staff']) ? <MyReports /> : <Denied />} />
              <Route path="/my-reports/:year/:month" element={can(['Staff']) ? <ReportEditor /> : <Denied />} />
              <Route path="/assigned" element={can(['Supervisor']) ? <AssignedReports /> : <Denied />} />
              <Route path="/reports/:id" element={<ReportView />} />
              <Route path="/staff" element={can(['Admin', 'Hr']) ? <StaffAdmin /> : <Denied />} />
              <Route path="/all-reports" element={can(['Admin', 'Hr']) ? <AllReports /> : <Denied />} />
              <Route path="/analytics" element={can(['Admin', 'Hr']) ? <Analytics /> : <Denied />} />
              <Route path="/archive" element={can(['Admin', 'Hr']) ? <ArchivePage /> : <Denied />} />
              <Route path="/archive/:id" element={can(['Admin', 'Hr']) ? <ArchiveDetail /> : <Denied />} />
              <Route path="/activity-log" element={can(['Admin', 'Hr']) ? <ActivityLog /> : <Denied />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </motion.div>
      </div>
    </div>
  )
}

function Denied() {
  return (
    <div className="card" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}>
      You don’t have access to this page.
    </div>
  )
}

function AuthLayer({ children }: { children: React.ReactNode }) {
  if (entraEnabled && msalInstance) {
    return (
      <MsalProvider instance={msalInstance}>
        <EntraAuthProvider>{children}</EntraAuthProvider>
      </MsalProvider>
    )
  }
  return <DevAuthProvider>{children}</DevAuthProvider>
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthLayer>
            <Shell />
          </AuthLayer>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
