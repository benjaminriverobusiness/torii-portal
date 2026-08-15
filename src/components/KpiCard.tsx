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
}

function getColor(value: number, logic: string, objective?: number | null): string {
  if (logic === 'showRate') {
    if (value >= 60) return '#4ade80'
    if (value >= 40) return '#fcd34d'
    return '#f87171'
  }
  if (logic === 'closingRate') {
    if (value >= 25) return '#4ade80'
    if (value >= 15) return '#fcd34d'
    return '#f87171'
  }
  if (logic === 'cpbc' && objective) {
    if (value <= objective) return '#4ade80'
    if (value <= objective * 1.5) return '#fcd34d'
    return '#f87171'
  }
  return '#f0f1f7'
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
}: KpiCardProps) {
  const [width, setWidth] = useState(0)
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
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          textTransform: 'uppercase',
          fontSize: 11,
          letterSpacing: '0.1em',
          color: '#555669',
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontSize: 36,
          fontWeight: 800,
          color: color,
          lineHeight: 1,
          textShadow: colorLogic !== 'neutral' ? `0 0 24px ${color}66` : 'none',
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
        <div style={{ color: '#555669', fontSize: 13, marginTop: 6 }}>
          objetivo: {prefix}{objective}{suffix}
        </div>
      )}
      {showProgress && (
        <div
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.07)',
            marginTop: 16,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 3,
              background: `linear-gradient(90deg, ${progressColor}88 0%, ${progressColor} 100%)`,
              width: `${width}%`,
              transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 0 6px ${progressColor}55`,
            }}
          />
        </div>
      )}
    </div>
  )
}
