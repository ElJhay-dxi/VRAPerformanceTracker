import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError, InteractionStatus } from '@azure/msal-browser'
import { ApiError, api, setTokenGetter, setUnauthorizedHandler } from './api'
import { AuthContext } from './auth'
import { loginRequest, tokenScopes } from './auth/entra'
import type { Me } from './types'

/** Microsoft Entra ID sign-in. Rendered only when VITE_ENTRA_CLIENT_ID is set. */
export function EntraAuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  const [me, setMe] = useState<Me | null>(null)
  const [accessDenied, setAccessDenied] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchedFor = useRef<string | null>(null)

  // Attach a fresh bearer token to every /api call; force interactive re-auth if the
  // silent refresh needs consent/MFA. Any hard 401 elsewhere -> sign out.
  useEffect(() => {
    setTokenGetter(async () => {
      const account = instance.getActiveAccount() ?? accounts[0]
      if (!account) return null
      // We send the ID token (audience = our client id) so the API needs no custom
      // "Expose an API" scope. Switch to r.accessToken if a real API scope is set up.
      try {
        const r = await instance.acquireTokenSilent({ scopes: tokenScopes, account })
        return r.idToken
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          const r = await instance.acquireTokenPopup({ scopes: tokenScopes, account })
          return r.idToken
        }
        throw e
      }
    })
    setUnauthorizedHandler(() => {
      void instance.logoutRedirect()
    })
    return () => {
      setTokenGetter(null)
      setUnauthorizedHandler(null)
    }
  }, [instance, accounts])

  const loadProfile = useCallback(async () => {
    setAccessDenied(null)
    try {
      setMe(await api.me())
    } catch (e) {
      setMe(null)
      if (e instanceof ApiError && e.status === 403) {
        setAccessDenied(e.message)
      } else if (!(e instanceof ApiError && e.status === 401)) {
        setAccessDenied(e instanceof Error ? e.message : 'Could not load your profile.')
      }
    }
  }, [])

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return

    if (!isAuthenticated) {
      fetchedFor.current = null
      setMe(null)
      setAccessDenied(null)
      setLoading(false)
      return
    }

    const key = (instance.getActiveAccount() ?? accounts[0])?.homeAccountId ?? 'authed'
    if (fetchedFor.current === key) return
    fetchedFor.current = key
    setLoading(true)
    loadProfile().finally(() => setLoading(false))
  }, [isAuthenticated, inProgress, accounts, instance, loadProfile])

  const login = useCallback(async () => {
    await instance.loginRedirect(loginRequest)
  }, [instance])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* cookie may not exist in Entra mode — ignore */
    }
    await instance.logoutRedirect()
  }, [instance])

  const refresh = useCallback(async () => {
    setLoading(true)
    await loadProfile()
    setLoading(false)
  }, [loadProfile])

  return (
    <AuthContext.Provider value={{ me, loading, mode: 'entra', accessDenied, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}
