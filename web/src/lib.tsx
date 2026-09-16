import { useCallback, useEffect, useState } from 'react'

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))

export const monthLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`
export const monthShort = (year: number, month: number) => `${MONTHS_SHORT[month - 1]} ${year}`

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  return fmtDate(iso)
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase()
}

const AVATARS = [
  'linear-gradient(140deg,#3d8bff,#1b5fd0)',
  'linear-gradient(140deg,#12b886,#0c8a63)',
  'linear-gradient(140deg,#f5a524,#e8850a)',
  'linear-gradient(140deg,#845ef7,#5f3dc4)',
  'linear-gradient(140deg,#ff8787,#e03131)',
  'linear-gradient(140deg,#22b8cf,#0c8599)',
]
export function avatarBg(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATARS[h % AVATARS.length]
}

/** Minimal data-loading hook: runs `fn` on mount and whenever `deps` change. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const run = useCallback(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.message ?? 'Something went wrong'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(run, [run])
  return { data, error, loading, reload: run, setData }
}
