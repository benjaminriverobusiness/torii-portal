import type { ClientPhase } from '../types'

interface JourneyMapProps {
  phases: ClientPhase[]
  active_phase_id: string | null | undefined
  days_in_phase: number | null | undefined
}

export function JourneyMap({ phases, active_phase_id, days_in_phase }: JourneyMapProps) {
  if (!phases || phases.length === 0) {
    return (
      <p style={{ color: '#555669', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
        Las etapas de tu recorrido serán configuradas pronto.
      </p>
    )
  }

  const activeIndex = phases.findIndex((p) => p.id === active_phase_id)

  const getStatus = (index: number): 'completed' | 'active' | 'future' => {
    if (activeIndex === -1) return index === 0 ? 'active' : 'future'
    if (index < activeIndex) return 'completed'
    if (index === activeIndex) return 'active'
    return 'future'
  }

  const n = phases.length
  // STATION_Y = 30 = half of SVG height (60) → line aligns with circle centers
  const STATION_Y = 30
  const SVG_HEIGHT = 60
  const isSingle = n === 1

  // paddingTop = vertical space reserved above the stations for the floating card
  const paddingTop = isSingle ? 100 : 120

  // Circle diameter = 52, radius = 26
  // Circle top = paddingTop - 26, circle center = paddingTop
  // SVG positioned absolutely so STATION_Y=30 aligns with circle centers at y=paddingTop
  // → SVG top = paddingTop - STATION_Y = paddingTop - 30
  const svgTop = paddingTop - STATION_Y

  // Card bottom anchor: 16px above the circle top = paddingTop - 26 - 16 = paddingTop - 42
  // The outer station wrapper is at top:0, height≈0 (all children are absolute).
  // CB.bottom = 0. bottom: -X → card bottom at 0 - (-X) = X from JourneyMap top.
  const cardBottomPx = paddingTop - 42

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'visible',
        paddingTop,
        paddingBottom: 60,
      }}
    >
      {/* SVG connecting paths — absolutely positioned to align with circles */}
      {!isSingle && (
        <svg
          width="100%"
          height={SVG_HEIGHT}
          style={{
            overflow: 'visible',
            display: 'block',
            position: 'absolute',
            top: svgTop,
            left: 0,
          }}
          preserveAspectRatio="none"
          viewBox={`0 0 1000 ${SVG_HEIGHT}`}
        >
          <defs>
            <filter id="glow-red" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {phases.map((phase, i) => {
            if (i === n - 1) return null
            const x1 = (i / (n - 1)) * 1000
            const x2 = ((i + 1) / (n - 1)) * 1000
            const cx1 = x1 + (x2 - x1) * 0.5
            const cx2 = cx1

            const statusA = getStatus(i)
            const statusB = getStatus(i + 1)

            let stroke = 'rgba(255,255,255,0.08)'
            let isDashed = false
            let useGlow = false

            if (statusA === 'completed' && statusB === 'completed') {
              stroke = '#e5182b'
              useGlow = true
            } else if (statusA === 'completed' && statusB === 'active') {
              stroke = '#e5182b'
              isDashed = true
              useGlow = true
            }

            return (
              <path
                key={phase.id}
                d={`M ${x1},${STATION_Y} C ${cx1},${STATION_Y} ${cx2},${STATION_Y} ${x2},${STATION_Y}`}
                stroke={stroke}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={isDashed ? '8 6' : undefined}
                filter={useGlow ? 'url(#glow-red)' : undefined}
                style={isDashed ? { animation: 'dash 1s linear infinite' } : undefined}
              />
            )
          })}
        </svg>
      )}

      {/* Stations */}
      {phases.map((phase, i) => {
        const leftPct = n === 1 ? 50 : (i / (n - 1)) * 100
        const leftFraction = n === 1 ? 0.5 : i / (n - 1)
        const status = getStatus(i)

        // Prevent card from overflowing the left/right edges of the container
        let cardLeft: string | number = 0
        let cardRight: string | number | undefined = undefined
        let cardTransform = 'translateX(-50%)'

        if (leftFraction <= 0.25) {
          // First station area — align card left edge to station center
          cardLeft = 0
          cardRight = undefined
          cardTransform = 'none'
        } else if (leftFraction >= 0.75) {
          // Last station area — align card right edge to station center
          cardLeft = 'auto'
          cardRight = 0
          cardTransform = 'none'
        }

        return (
          // Outer wrapper: zero-width anchor at horizontal position, top:0
          // All children use absolute positioning relative to this anchor
          <div
            key={phase.id}
            style={{
              position: 'absolute',
              left: `${leftPct}%`,
              top: 0,
              width: 0,
              overflow: 'visible',
            }}
          >
            {/* Floating card for active phase
                bottom: -cardBottomPx → card.bottom = CB.bottom - (-cardBottomPx)
                                       = 0 + cardBottomPx = cardBottomPx from JourneyMap top ✓ */}
            {status === 'active' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: -cardBottomPx,
                  left: cardLeft,
                  right: cardRight,
                  transform: cardTransform,
                  backgroundColor: '#0f0f1a',
                  border: '1px solid rgba(229,24,43,0.5)',
                  boxShadow: '0 0 24px rgba(229,24,43,0.15), 0 8px 32px rgba(0,0,0,0.4)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  minWidth: 180,
                  maxWidth: 220,
                  whiteSpace: 'normal',
                  zIndex: 10,
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    color: '#e5182b',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                    letterSpacing: '0.08em',
                  }}
                >
                  {phase.phase_name}
                </div>
                <div style={{ color: '#8a8c9e', fontSize: 12, marginBottom: phase.phase_description ? 8 : 0 }}>
                  Día {days_in_phase ?? 1} en esta etapa
                </div>
                {phase.phase_description && (
                  <div style={{ color: '#f0f1f7', fontSize: 13, lineHeight: 1.5 }}>
                    {phase.phase_description}
                  </div>
                )}
                {/* Triangle pointer */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -8,
                    left: cardTransform === 'none' && cardRight === undefined ? 20 : '50%',
                    right: cardTransform === 'none' && cardRight !== undefined ? 20 : undefined,
                    transform: cardTransform === 'none' ? 'none' : 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderTop: '8px solid rgba(229,24,43,0.5)',
                  }}
                />
              </div>
            )}

            {/* Station circle — positioned at y = paddingTop - 26 (centered at y = paddingTop) */}
            <div
              style={{
                position: 'absolute',
                top: paddingTop - 26,
                left: -26,
                width: 52,
                height: 52,
              }}
            >
              {/* Pulse ring for active */}
              {status === 'active' && (
                <div
                  className="pulse-ring"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    border: '2px solid rgba(229,24,43,0.35)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: status === 'future' ? 'rgba(255,255,255,0.04)' : '#e5182b',
                  border: status === 'future' ? '2px solid rgba(255,255,255,0.09)' : 'none',
                  boxShadow:
                    status === 'active'
                      ? '0 0 20px rgba(229,24,43,0.5), 0 0 40px rgba(229,24,43,0.2)'
                      : status === 'completed'
                      ? '0 0 10px rgba(229,24,43,0.3)'
                      : 'none',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                {status === 'completed' ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8l3.5 3.5L13 5"
                      stroke="white"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span
                    style={{
                      color: status === 'future' ? '#555669' : 'white',
                      fontWeight: 800,
                      fontSize: 16,
                      fontFamily: 'Bricolage Grotesque, sans-serif',
                    }}
                  >
                    {phase.phase_order}
                  </span>
                )}
              </div>
            </div>

            {/* Label below station circle */}
            <div
              style={{
                position: 'absolute',
                top: paddingTop + 30,
                left: -40,
                width: 80,
                textAlign: 'center',
                fontSize: status === 'active' ? 13 : 11,
                fontWeight: status !== 'future' ? 700 : 400,
                color:
                  status === 'active'
                    ? '#ffffff'
                    : status === 'completed'
                    ? '#e5182b'
                    : '#555669',
                lineHeight: 1.3,
                whiteSpace: 'normal',
              }}
            >
              {phase.phase_name}
            </div>
          </div>
        )
      })}
    </div>
  )
}
