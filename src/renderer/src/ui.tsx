import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useEditor } from './store'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: boolean }

export function Button({ variant = 'secondary', icon, className = '', ...rest }: BtnProps) {
  return <button type="button" className={`btn btn-${variant}${icon ? ' btn-icon' : ''} ${className}`} {...rest} />
}

export function NumberSlider(props: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  scale?: number // shown = value * scale (e.g. 100 for percent)
  unit?: string
  onChange: (v: number) => void
}) {
  const { label, value, min, max, step = 1, scale = 1, unit = '', onChange } = props
  const id = useId()
  const shown = +(value * scale).toFixed(2)
  const emit = (v: number) => Number.isFinite(v) && onChange(Math.min(max, Math.max(min, v)) / scale)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-row">
        <input id={id} type="range" min={min} max={max} step={step} value={shown} onChange={(e) => emit(+e.target.value)} />
        <input type="number" aria-label={label} min={min} max={max} step={step} value={shown} onChange={(e) => emit(parseFloat(e.target.value))} />
        <span className="unit">{unit}</span>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  )
}

export function Toasts() {
  const toasts = useEditor((s) => s.toasts)
  const dismiss = useEditor((s) => s.dismiss)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <span>{t.text}</span>
          <Button variant="ghost" icon aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            ×
          </Button>
        </div>
      ))}
    </div>
  )
}
