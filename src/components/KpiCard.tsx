import { useEffect, useState, useRef } from 'react'

interface KpiCardProps {
  label: string
  value: number | null | undefined
  prefix?: string
  suffix?: string
  objective?: number | null
  objectiveLabel?: string
  colorLogic?: 'showRate' | 'closingRate' | 'cpbc' | 'neutral'
  delay?: number
  tooltip?: string
}

function getColor(value: number, logic: string, objective?: number | null): string {
  if (logic === 'showRate') {
    if (value >= 60) return 'var(--success)'
    if (value >= 40) return 'var(--warning)'
    return 'var(--danger)'
  }
  if (logic === 'closingRate') {
    if (value >= 25) return 'var(--success)'
    if (value >= 15) return 'var(--warning)'
    return 'var(--danger)'
  }
  if (logic === 'cpbc' && objective) {
    if (value <= objective) return 'var(--success)'
    if (value <= objective * 1.5) return 'var(--warning)'
    return 'var(--danger)'
  }
  return 'var(--text-primary)'
}

// color acá siempre es un var(--token) (nunca hex plano), así que el viejo
// truco de concatenar un sufijo de alpha en hex (`${color}66`) ya no
// funciona — color-mix() logra el mismo efecto de opacidad sin importar el
// tema activo.
function withAlpha(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}

function getProgressColor(value: number, logic: string, objective?: number | null): string {
  return getColor(value, logic, objective)
}

export function KpiCard({
  label,
  value,
  prefix = '',
  suffix = '',
  objective,
  colorLogic = 'neutral',
  delay = 0,
  tooltip,
}: KpiCardProps) {
  const [width, setWidth] = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)
  const mounted = useRef(false)

  const displayValue = value ?? 0
  const color = getColor(displayValue, colorLogic, objective)
  const progressColor = getProgressColor(displayValue, colorLogic, objective)

  const showProgress = colorLogic !== 'neutral' && objective !== undefined

  let progressPct = 0
  if (showProgress && objective) {
    if (colorLogic === 'cpbc') {
      progressPct = Math.min((objective / displayValue) * 100, 100)
    } else {
      progressPct = Math.min((displayValue / objective) * 100, 100)
    }
  }

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      const timer = setTimeout(() => {
        setWidth(progressPct)
      }, delay + 100)
      return () => clearTimeout(timer)
    }
  }, [progressPct, delay])

  return (
    <div
      style={{
        backgroundColor: 'rgba(var(--overlay-rgb),0.03)',
        border: '1px solid rgba(var(--overlay-rgb),0.07)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            textTransform: 'uppercase',
            fontSize: 11,
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
        {tooltip && (
          <span
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={(e) => { e.stopPropagation(); setShowTooltip((v) => !v) }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 13,
              height: 13,
              borderRadius: '50%',
              fontSize: 11,
              lineHeight: 1,
              color: showTooltip ? 'var(--text-secondary)' : 'var(--text-muted)',
              cursor: 'help',
              flexShrink: 0,
            }}
          >
            ⓘ
          </span>
        )}
        {tooltip && showTooltip && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 'calc(100% + 8px)',
              zIndex: 20,
              background: 'var(--surface-solid)',
              border: '1px solid rgba(var(--overlay-rgb),0.12)',
              borderRadius: 10,
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: 12.5,
              fontWeight: 400,
              lineHeight: 1.5,
              textTransform: 'none',
              letterSpacing: 'normal',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {tooltip}
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontSize: 36,
          fontWeight: 800,
          color: color,
          lineHeight: 1,
          textShadow: colorLogic !== 'neutral' ? `0 0 24px ${withAlpha(color, 40)}` : 'none',
        }}
      >
        {prefix}
        {value !== null && value !== undefined
          ? displayValue % 1 === 0
            ? displayValue
            : displayValue.toFixed(1)
          : '—'}
        {suffix}
      </div>
      {objective !== null && objective !== undefined && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
          objetivo: {prefix}{objective}{suffix}
        </div>
      )}
      {showProgress && (
        <div
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: 'rgba(var(--overlay-rgb),0.07)',
            marginTop: 16,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(90deg, ${withAlpha(progressColor, 53)} 0%, ${progressColor} 100%)`,
              width: `${width}%`,
              transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 0 6px ${withAlpha(progressColor, 33)}`,
            }}
          />
        </div>
      )}
    </div>
  )
}
