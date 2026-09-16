import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, api } from './api'
import type { Me } from './types'

export interface AuthState {
  me: Me | null
  loading: boolean
  mode: 'dev' | 'entra'
  /** Set in Entra mode when the person signed in with Microsoft but has no account here. */
  accessDenied: string | null
  /** Dev mode takes an email; Entra mode ignores it and redirects to Microsoft. */
  login: (email?: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside an auth provider')
  return ctx
}

/** Dev cookie sign-in: pick a seeded user, no Microsoft involved. */
export function DevAuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setMe(await api.me())
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setMe(null)
      else throw e
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const login = useCallback(async (email?: string) => {
    if (!email) throw new Error('Pick a user')
    setMe(await api.devLogin(email))
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setMe(null)
  }, [])

  return (
    <AuthContext.Provider value={{ me, loading, mode: 'dev', accessDenied: null, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
