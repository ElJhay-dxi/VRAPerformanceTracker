import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import type { ReportStatus } from '../types'

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="page-head">
      <div>
        <div className="h1">{title}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="wrap">{actions}</div>}
    </div>
  )
}

export function Card({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHead({ tag, title, right }: { tag?: string; title: string; right?: ReactNode }) {
  return (
    <div className="card-h">
      {tag && <span className="section-tag">{tag}</span>}
      <h3>{title}</h3>
      {right && <span className="card-h-right">{right}</span>}
    </div>
  )
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`badge ${status}`}>
      <span className="dot" />
      {status}
    </span>
  )
}

export function Stat({
  k,
  v,
  foot,
  icon,
  tint,
}: {
  k: string
  v: ReactNode
  foot?: ReactNode
  icon?: ReactNode
  tint?: 'ok' | 'info' | 'warn' | 'bad'
}) {
  return (
    <div className={`stat ${tint ? `tint-${tint}` : ''}`}>
      {icon && <span className="stat-ico">{icon}</span>}
      <div className="stat-k">{k}</div>
      <div className="stat-v">{v}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  )
}

export function Spinner() {
  return <span className="spinner" />
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--ink-3)', padding: '28px 4px' }}>
      <Spinner />
      <span>{label}…</span>
    </div>
  )
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="tablewrap" style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 0' }}>
          <div className="skel" style={{ height: 14, width: '30%' }} />
          <div className="skel" style={{ height: 14, flex: 1 }} />
          <div className="skel" style={{ height: 14, width: 80 }} />
        </div>
      ))}
    </div>
  )
}

export function Empty({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="e-ico">{icon}</span>
      <h4>{title}</h4>
      {hint && <div style={{ marginTop: 4 }}>{hint}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stars({
  value,
  onChange,
  size = 18,
}: {
  value: number | null
  onChange?: (v: number) => void
  size?: number
}) {
  const v = value ?? 0
  if (!onChange) {
    return (
      <span className="stars" aria-label={value ? `${value} out of 5` : 'not rated'}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`s ${n <= v ? 'on' : ''}`}>
            <Star size={size} fill={n <= v ? 'currentColor' : 'none'} />
          </span>
        ))}
      </span>
    )
  }
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= v ? 'on' : ''}
          aria-label={`Rate ${n}`}
          onClick={() => onChange(n)}
        >
          <Star size={size} fill={n <= v ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  )
}

export function Pager({
  page,
  totalPages,
  total,
  unit = 'items',
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  unit?: string
  onPage: (p: number) => void
}) {
  return (
    <div className="pager">
      <span className="muted">
        {total} {unit}
      </span>
      <div className="right">
        <button className="btn ghost sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span className="muted" style={{ minWidth: 84, textAlign: 'center' }}>
          Page {page} / {totalPages}
        </span>
        <button className="btn ghost sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
