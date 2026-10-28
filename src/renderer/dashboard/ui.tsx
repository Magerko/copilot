import type { ReactNode } from 'react'
import type { ComponentStatus } from '@shared/types'

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <button type="button" role="switch" aria-checked={on} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} style={{ marginTop: 2 }} />
      <div className="grow">
        <div>{label}</div>
        {hint && <div className="small muted">{hint}</div>}
      </div>
    </div>
  )
}

export function Status({ name, st }: { name: string; st: ComponentStatus }) {
  return (
    <div className="status-row">
      <span className={`dot ${st.state}`} />
      <span className="status-name">{name}</span>
      <span className="status-label muted" title={st.label}>
        {st.label}
      </span>
    </div>
  )
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card col" style={{ gap: 14 }}>
      <div className="row between">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Meter({ value }: { value: number }) {
  const pct = Math.min(100, Math.round(Math.sqrt(Math.max(0, value)) * 220))
  return (
    <div className="meter" aria-label="уровень">
      <i style={{ width: `${pct}%`, background: pct > 85 ? 'var(--warn)' : 'var(--ok)' }} />
    </div>
  )
}

export function ErrorText({ text }: { text: string | null }) {
  return text ? <div className="banner error small">{text}</div> : null
}

export function fmtDate(ms: number): string {
  return new Date(ms).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
