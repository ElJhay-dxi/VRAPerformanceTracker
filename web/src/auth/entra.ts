import {
  PublicClientApplication,
  type Configuration,
  type RedirectRequest,
} from '@azure/msal-browser'

// --- config from Vite env ------------------------------------------------------
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined
const tenantId = (import.meta.env.VITE_ENTRA_TENANT_ID as string | undefined) ?? 'common'
const redirectUri =
  (import.meta.env.VITE_ENTRA_REDIRECT_URI as string | undefined) ?? window.location.origin
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE as string | undefined

/** True when Microsoft sign-in is configured. When false the app uses the dev picker. */
export const entraEnabled = !!clientId

const msalConfig: Configuration = {
  auth: {
    clientId: clientId ?? '',
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage', // wiped when the tab closes
  },
}

/** Scopes asked for at sign-in and for silent token acquisition on API calls. */
export const loginRequest: RedirectRequest = {
  scopes: apiScope ? [apiScope] : ['User.Read'],
}
export const tokenScopes = apiScope ? [apiScope] : ['User.Read']

/** One shared instance, or null in dev mode. Call `initEntra()` once before use. */
export const msalInstance = entraEnabled ? new PublicClientApplication(msalConfig) : null

export async function initEntra() {
  if (!msalInstance) return
  await msalInstance.initialize()
  // Completes a redirect sign-in if we just came back from Microsoft.
  await msalInstance.handleRedirectPromise()
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length && !msalInstance.getActiveAccount()) {
    msalInstance.setActiveAccount(accounts[0])
  }
}
