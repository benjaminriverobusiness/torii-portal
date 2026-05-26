import { Component, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Navbar } from '../components/Navbar'
import { JourneyMap } from '../components/JourneyMap'
import { KpiCard } from '../components/KpiCard'
import { VideoCard } from '../components/VideoCard'
import { DocumentCard } from '../components/DocumentCard'
import { Spinner } from '../components/Spinner'
import { MetricsSection } from '../components/MetricsSection'
import { useClient } from '../hooks/useClient'
import { supabase } from '../lib/supabase'
import type { HitosCliente, ClientMetrics, ClientMetricsConfig, LiAccountMetric } from '../types'

class PortalErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: unknown) { console.error('Portal render error:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#f87171', textAlign: 'center' }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Error al renderizar el portal</p>
          <pre style={{ fontSize: 12, color: '#555669', whiteSpace: 'pre-wrap' }}>
            {(this.state.error as Error).message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatWeekRange(start?: string, end?: string): string {
  if (!start) return ''
  const s = new Date(start)
  const sStr = `${s.getDate().toString().padStart(2, '0')}/${(s.getMonth() + 1).toString().padStart(2, '0')}`
  if (!end) return sStr
  const e = new Date(end)
  const eStr = `${e.getDate().toString().padStart(2, '0')}/${(e.getMonth() + 1).toString().padStart(2, '0')}/${e.getFullYear()}`
  return `${sStr} — ${eStr}`
}

function SectionLabel({
  text,
  color = '#e5182b',
  bg = 'rgba(229,24,43,0.10)',
  border = 'rgba(229,24,43,0.22)',
}: {
  text: string
  color?: string
  bg?: string
  border?: string
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        textTransform: 'uppercase',
        fontSize: 11,
        letterSpacing: '0.1em',
        color,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: 99,
        padding: '5px 14px',
        marginBottom: 16,
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  )
}

function GlowDot({ color = '#e5182b' }: { color?: string }) {
  return (
    <div
      className="glow-dot"
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
        boxShadow: `0 0 8px ${color}, 0 0 20px ${color}66`,
      }}
    />
  )
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    'Meta Ads': { bg: 'rgba(251,146,60,0.08)', color: '#fb923c', border: 'rgba(251,146,60,0.25)' },
    'LinkedIn Outbound': { bg: 'rgba(96,165,250,0.08)', color: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
    'Híbrido': { bg: 'rgba(192,132,252,0.08)', color: '#c084fc', border: 'rgba(192,132,252,0.25)' },
  }
  const s = styles[platform] ?? { bg: 'rgba(255,255,255,0.05)', color: '#8a8c9e', border: 'rgba(255,255,255,0.07)' }
  return (
    <span
      style={{
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        borderRadius: 99,
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {platform}
    </span>
  )
}

function HitosSection({ hitos }: { hitos: HitosCliente }) {
  const items = [
    { label: 'Primer contacto enviado', done: !!hitos.ps1_completado, fecha: null },
    { label: 'Primera reunión realizada', done: !!hitos.ps2_completado, fecha: null },
    { label: 'Sistema configurado', done: !!hitos.ps3_completado, fecha: null },
    { label: 'Primera agenda calificada', done: !!hitos.primera_agenda_fecha, fecha: hitos.primera_agenda_fecha },
    { label: 'Primer cliente cerrado', done: !!hitos.primer_cierre_fecha, fecha: hitos.primer_cierre_fecha },
  ]

  const hasAny = items.some((it) => it.done)
  if (!hasAny) return null

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <GlowDot color="#4ade80" />
        <span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.1em', color: '#4ade80', fontWeight: 700 }}>
          HITOS ALCANZADOS
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {items.map((item) => (
          <div
            key={item.label}
            className="card-hover"
            style={{
              backgroundColor: item.done ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${item.done ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 14,
              padding: '16px 20px',
              minWidth: 180,
              flexShrink: 0,
              cursor: 'default',
            }}
          >
            {item.done ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginBottom: 10 }}>
                <circle cx="10" cy="10" r="9" stroke="#4ade80" strokeWidth="1.5" />
                <path d="M6 10l3 3 5-5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginBottom: 10 }}>
                <circle cx="10" cy="10" r="9" stroke="#555669" strokeWidth="1.5" />
              </svg>
            )}
            <div style={{ color: item.done ? '#f0f1f7' : '#555669', fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>
              {item.label}
            </div>
            <div style={{ color: '#8a8c9e', fontSize: 12, marginTop: 4 }}>
              {item.fecha
                ? new Date(item.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : item.done ? '' : 'Pendiente'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Portal() {
  const { client, status, phases, videos, documents, registros, hitos, loading, error } = useClient()
  const [metrics, setMetrics] = useState<ClientMetrics[]>([])
  const [metricsConfig, setMetricsConfig] = useState<ClientMetricsConfig | null>(null)
  const [selectedMetricIndex, setSelectedMetricIndex] = useState(0)
  const [liAccountMetrics, setLiAccountMetrics] = useState<LiAccountMetric[]>([])

  useEffect(() => {
    if (!client?.id) return
    async function fetchMetrics() {
      const [metricsRes, configRes] = await Promise.all([
        supabase
          .from('client_metrics')
          .select('*')
          .eq('client_id', client!.id)
          .order('week_start', { ascending: false }),
        supabase
          .from('client_metrics_config')
          .select('*')
          .eq('client_id', client!.id)
          .maybeSingle(),
      ])
      setMetrics((metricsRes.data ?? []) as ClientMetrics[])
      setMetricsConfig(configRes.data as ClientMetricsConfig | null)
    }
    fetchMetrics()
  }, [client?.id])

  const selectedMetrics = metrics[selectedMetricIndex] || null

  useEffect(() => {
    setSelectedMetricIndex(0)
  }, [metrics])

  useEffect(() => {
    if (!client?.id || !selectedMetrics) return
    async function fetchLiAccounts() {
      const { data } = await supabase
        .from('li_account_metrics')
        .select('*')
        .eq('client_id', client!.id)
        .eq('week_number', selectedMetrics!.week_number)
        .eq('year', selectedMetrics!.year)
      setLiAccountMetrics((data ?? []) as LiAccountMetric[])
    }
    fetchLiAccounts()
  }, [client?.id, selectedMetricIndex, selectedMetrics?.week_number, selectedMetrics?.year])

  console.log('Portal data:', { client, status, phases, loading, error })

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#08090f' }}>
        <Navbar />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'calc(100vh - 64px)',
          }}
        >
          <Spinner size={40} />
        </div>
      </div>
    )
  }

  if (!loading && !client) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        gap: '16px',
      }}>
        <div style={{ color: '#e5182b', fontSize: '14px' }}>
          Error cargando datos del cliente.
        </div>
      </div>
    )
  }

  if (!loading && client && !status) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        gap: '16px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #1a1a1a',
          borderTop: '3px solid #e5182b',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: '#f0f1f7', fontSize: '18px', fontWeight: 700 }}>
          Tu dashboard se actualizará pronto.
        </p>
        <p style={{ color: '#8a8c9e', fontSize: '14px' }}>
          El equipo de Torii está preparando tu sistema.
        </p>
      </div>
    )
  }

  if (!status) return null

  const daysActive = (() => {
    try {
      if (!client?.start_date) return 0
      const start = new Date(client.start_date)
      const today = new Date()
      const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      return Math.max(0, diff)
    } catch { return 0 }
  })()

  const progress = Math.min(daysActive / 90, 1)
  const circumference = 2 * Math.PI * 52

  const latestRegistro = registros[0]
  const activePhase = phases.find((p) => p.id === status.active_phase_id) ?? phases[0]

  function normalizeRate(value: number | null | undefined): number {
    if (!value) return 0
    return value <= 1 ? value * 100 : value
  }

  const platform = client?.canal
  const kpiAgendas: number | null = selectedMetrics
    ? platform === 'Meta Ads'
      ? (selectedMetrics.ads_bookings ?? null)
      : platform === 'LinkedIn Outbound'
      ? (selectedMetrics.li_bookings ?? null)
      : ((selectedMetrics.ads_bookings ?? 0) + (selectedMetrics.li_bookings ?? 0))
    : (latestRegistro?.agendas_generadas ?? null)
  const kpiShowRate = selectedMetrics
    ? normalizeRate(selectedMetrics.ads_show_rate)
    : normalizeRate(latestRegistro?.show_rate)
  const kpiCloseRate = selectedMetrics
    ? (platform === 'LinkedIn Outbound' ? null : normalizeRate(selectedMetrics.ads_close_rate))
    : normalizeRate(latestRegistro?.tasa_cierre)
  const kpiCpbc: number | null = selectedMetrics
    ? (platform === 'LinkedIn Outbound' ? null : (selectedMetrics.ads_cpbc ?? null))
    : (status.cpbc_current ?? null)
  const totalLiBookings = platform === 'LinkedIn Outbound'
    ? metrics.reduce((sum, m) => sum + (m.li_bookings ?? 0), 0)
    : null

  console.log('Rendering portal with:', {
    daysActive,
    activePhase: phases?.find((p) => p.id === status?.active_phase_id),
    statusData: status,
  })

  return (
    <PortalErrorBoundary>
    <div style={{ minHeight: '100vh', backgroundColor: '#08090f', color: '#f0f1f7', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar clientName={client?.name} showNav />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px', display: 'block', visibility: 'visible', opacity: 1 }}>

        {/* HERO */}
        {(() => { try { return (
        <div
          className="fade-in visible"
          style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: 40,
            marginBottom: 32,
          }}
        >
          {/* Dot grid background */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(229,24,43,0.12) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            borderRadius: 20,
            pointerEvents: 'none',
            zIndex: 0,
            maskImage: 'radial-gradient(ellipse 90% 90% at 50% 0%, black 0%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 0%, black 0%, transparent 100%)',
          }} />
          {/* Red radial glow */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 65% 0%, rgba(229,24,43,0.18) 0%, transparent 55%)',
            zIndex: 0,
          }} />
          {/* Bottom fade */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
            background: 'linear-gradient(to top, rgba(8,9,15,0.6), transparent)',
            zIndex: 0,
          }} />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
                gap: 48,
              }}
              className="hero-grid"
            >
              <div>
                <SectionLabel text="ETAPA ACTUAL" />
                <h1
                  style={{
                    fontFamily: 'Bricolage Grotesque, sans-serif',
                    fontSize: 'clamp(28px, 4vw, 44px)',
                    fontWeight: 800,
                    color: '#f0f1f7',
                    lineHeight: 1.1,
                    margin: '0 0 14px',
                  }}
                >
                  {activePhase?.phase_name ?? 'Sin etapa activa'}
                </h1>
                <p style={{ color: '#8a8c9e', fontSize: 16, lineHeight: 1.75, margin: '0 0 28px', maxWidth: 480 }}>
                  {activePhase?.phase_description ?? ''}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <PlatformBadge platform={client?.canal ?? null} />
                  {client?.country && (
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#8a8c9e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
                      {client.country}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <div style={{ color: '#555669', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>DÍA</div>
                <div style={{
                  fontFamily: 'Bricolage Grotesque, sans-serif',
                  fontSize: 72,
                  fontWeight: 800,
                  color: '#e5182b',
                  lineHeight: 1,
                  textShadow: '0 0 40px rgba(229,24,43,0.55), 0 0 80px rgba(229,24,43,0.25)',
                }}>
                  {daysActive}
                </div>
                <div style={{ color: '#555669', fontSize: 13, letterSpacing: '0.06em' }}>DE 90</div>

                <div style={{ marginTop: 20 }}>
                  <svg width="110" height="110" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" stroke="rgba(255,255,255,0.07)" strokeWidth="7" fill="none" />
                    <circle
                      cx="60" cy="60" r="52"
                      stroke="#e5182b"
                      strokeWidth="7"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - progress)}
                      transform="rotate(-90 60 60)"
                      style={{
                        transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        filter: 'drop-shadow(0 0 6px rgba(229,24,43,0.7))',
                      }}
                    />
                    <text x="60" y="60" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="17" fontWeight="700" fontFamily="Bricolage Grotesque, sans-serif">
                      {Math.round(progress * 100)}%
                    </text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        )} catch(e) { console.error('Hero error:', e); return <div style={{color:'red',padding:16}}>Error en Hero</div> } })()}

        {/* JOURNEY MAP */}
        {(() => { try { return (
        <div className="fade-in visible" style={{ display: 'block', marginBottom: 32 }}>
          <SectionLabel text="TU RECORRIDO" />
          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '48px 40px', overflow: 'visible' }}>
            <JourneyMap phases={phases} active_phase_id={status.active_phase_id} days_in_phase={status.days_in_phase} />
          </div>
        </div>
        )} catch(e) { console.error('JourneyMap error:', e); return <div style={{color:'red',padding:16}}>Error en JourneyMap</div> } })()}

        {/* KPIs */}
        {(() => { try { return (
        <div className="fade-in visible" style={{ display: 'block', marginBottom: 32 }}>
          <SectionLabel text="MÉTRICAS DE LA SEMANA" />

          {/* Navegación entre semanas */}
          {metrics.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <button
                disabled={selectedMetricIndex === metrics.length - 1}
                onClick={() => setSelectedMetricIndex(prev => prev + 1)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  backgroundColor: selectedMetricIndex === metrics.length - 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  color: selectedMetricIndex === metrics.length - 1 ? '#333' : '#8a8c9e',
                  fontSize: 13,
                  cursor: selectedMetricIndex === metrics.length - 1 ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                ← Semana anterior
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {selectedMetrics && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 600 }}>
                      Semana {selectedMetrics.week_number} · {selectedMetrics.year}
                    </span>
                    {selectedMetricIndex === 0 && (
                      <span style={{
                        backgroundColor: 'rgba(74,222,128,0.15)',
                        color: '#4ade80',
                        border: '1px solid rgba(74,222,128,0.3)',
                        borderRadius: 99,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        ACTUAL
                      </span>
                    )}
                  </div>
                )}
                {selectedMetrics?.week_start && (
                  <span style={{ color: '#8a8c9e', fontSize: 12 }}>
                    {formatWeekRange(selectedMetrics.week_start, (selectedMetrics as ClientMetrics & { week_end?: string }).week_end)}
                  </span>
                )}
              </div>

              <button
                disabled={selectedMetricIndex === 0}
                onClick={() => setSelectedMetricIndex(prev => prev - 1)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  backgroundColor: selectedMetricIndex === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  color: selectedMetricIndex === 0 ? '#333' : '#8a8c9e',
                  fontSize: 13,
                  cursor: selectedMetricIndex === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Semana siguiente →
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="kpi-grid">
            <KpiCard label="AGENDAS ESTA SEMANA" value={kpiAgendas} colorLogic="neutral" delay={0} />
            <KpiCard label="SHOW RATE" value={kpiShowRate} suffix="%" objective={60} colorLogic="showRate" delay={100} />
            <KpiCard label="TASA DE CIERRE" value={kpiCloseRate} suffix="%" objective={25} colorLogic="closingRate" delay={200} />
            {platform === 'LinkedIn Outbound'
              ? <KpiCard label="AGENDAS TOTALES" value={totalLiBookings} colorLogic="neutral" delay={300} />
              : <KpiCard label="CPBC ACTUAL" value={kpiCpbc} prefix="$" objective={status.cpbc_objective ?? undefined} colorLogic="cpbc" delay={300} />
            }
          </div>
        </div>
        )} catch(e) { console.error('KPIs error:', e); return <div style={{color:'red',padding:16}}>Error en KPIs</div> } })()}

        {/* METRICS */}
        {(() => { try { return (
        <div className="fade-in visible">
          <MetricsSection
            metrics={metrics}
            config={metricsConfig}
            cpbc_objective={status?.cpbc_objective ?? undefined}
            liAccountMetrics={liAccountMetrics}
          />
        </div>
        ) } catch(e) { console.error('Metrics error:', e); return null } })()}

        {/* HITOS */}
        {(() => { try { return hitos ? <HitosSection hitos={hitos} /> : null } catch(e) { console.error('Hitos error:', e); return null } })()}

        {/* WIN + NEXT STEP */}
        {(() => { try { return (
        <div className="fade-in visible" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }} id="win-grid">
          {/* Último resultado */}
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(229,24,43,0.04)',
            border: '1px solid rgba(229,24,43,0.18)',
            borderRadius: 16,
            padding: 28,
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: 'linear-gradient(to bottom, #e5182b, rgba(229,24,43,0.2))', borderRadius: '0 0 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <GlowDot color="#e5182b" />
              <span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.1em', color: '#e5182b', fontWeight: 700 }}>ÚLTIMO RESULTADO</span>
            </div>
            <p style={{ color: '#f0f1f7', fontSize: 16, lineHeight: 1.75, margin: 0 }}>
              {status.current_win ?? <span style={{ color: '#555669' }}>—</span>}
            </p>
          </div>

          {/* Próximos 7 días */}
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(96,165,250,0.04)',
            border: '1px solid rgba(96,165,250,0.18)',
            borderRadius: 16,
            padding: 28,
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: 'linear-gradient(to bottom, #60a5fa, rgba(96,165,250,0.2))', borderRadius: '0 0 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#60a5fa', flexShrink: 0, boxShadow: '0 0 8px #60a5fa, 0 0 20px rgba(96,165,250,0.4)' }} />
              <span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.1em', color: '#60a5fa', fontWeight: 700 }}>PRÓXIMOS 7 DÍAS</span>
            </div>
            <p style={{ color: '#f0f1f7', fontSize: 16, lineHeight: 1.75, margin: '0 0 16px' }}>
              {status.next_step ?? <span style={{ color: '#555669' }}>—</span>}
            </p>
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '0 0 12px' }} />
            <p style={{ color: '#555669', fontSize: 12, margin: 0 }}>Actualizado el {formatDate(status.updated_at)}</p>
          </div>
        </div>
        )} catch(e) { console.error('WinNextStep error:', e); return <div style={{color:'red',padding:16}}>Error en Win/NextStep</div> } })()}

        {/* VIDEOS */}
        {(() => { try { return videos.length > 0 ? (
        <div className="fade-in visible" style={{ display: 'block', marginBottom: 32 }}>
          <SectionLabel text="INFORMES EN VIDEO" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }} className="video-grid">
            {videos.map((v) => <VideoCard key={v.id} video={v} />)}
          </div>
        </div>
        ) : null } catch(e) { console.error('Videos error:', e); return <div style={{color:'red',padding:16}}>Error en Videos</div> } })()}

        {/* DOCUMENTS */}
        {(() => { try { return documents.length > 0 ? (
        <div className="fade-in visible" style={{ display: 'block', marginBottom: 32 }}>
          <SectionLabel text="INFORMES Y DOCUMENTOS" />
          <div>{documents.map((d) => <DocumentCard key={d.id} document={d} />)}</div>
        </div>
        ) : null } catch(e) { console.error('Documents error:', e); return <div style={{color:'red',padding:16}}>Error en Documentos</div> } })()}

        {/* HISTORY */}
        {(() => { try {
          const _unique = registros.reduce((acc: Record<string, typeof registros[0]>, reg) => {
            const k = `${reg.semana}-${reg.año}`
            if (!acc[k]) acc[k] = reg
            return acc
          }, {})
          const registrosToShow = Object.values(_unique)
            .sort((a, b) => {
              if (a.año !== b.año) return (b.año ?? 0) - (a.año ?? 0)
              return (b.semana ?? 0) - (a.semana ?? 0)
            })
            .slice(0, 4)
          return registrosToShow.length > 0 ? (
        <div className="fade-in visible" style={{ display: 'block', marginBottom: 32 }}>
          <SectionLabel text="HISTORIAL DE SEMANAS" />
          <div style={{ position: 'relative' }}>
            {registrosToShow.map((r, i) => (
              <div key={r.id} style={{ position: 'relative', paddingLeft: 32, paddingBottom: i < registrosToShow.length - 1 ? 16 : 0 }}>
                {/* Timeline vertical line */}
                {i < registrosToShow.length - 1 && (
                  <div style={{
                    position: 'absolute', left: 7, top: 20,
                    width: 2, bottom: 0,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                  }} />
                )}
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute', left: 0, top: 6,
                  width: 16, height: 16, borderRadius: '50%',
                  backgroundColor: i === 0 ? '#e5182b' : 'rgba(255,255,255,0.06)',
                  border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  boxShadow: i === 0 ? '0 0 10px rgba(229,24,43,0.5)' : 'none',
                }} />
                <div style={{
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                }}>
                  <span style={{ color: '#8a8c9e', fontSize: 13, minWidth: 56, fontWeight: 600 }}>
                    {r.fecha_inicio
                      ? new Date(r.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
                      : `S${r.semana ?? i + 1}`}
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { label: `${r.agendas_generadas ?? 0} agendas`, accent: false },
                      { label: `${normalizeRate(r.show_rate).toFixed(0)}% show`, accent: false },
                      { label: `${normalizeRate(r.tasa_cierre).toFixed(0)}% cierre`, accent: false },
                    ].map((pill) => (
                      <span
                        key={pill.label}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 20,
                          padding: '4px 12px',
                          color: '#8a8c9e',
                          fontSize: 12,
                        }}
                      >
                        {pill.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        ) : null } catch(e) { console.error('Historial error:', e); return <div style={{color:'red',padding:16}}>Error en Historial</div> } })()}

        <footer style={{ paddingTop: 40, textAlign: 'center' }}>
          <p style={{ color: '#1e1e2e', fontSize: 12 }}>Torii Delivery OS</p>
        </footer>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .video-grid { grid-template-columns: 1fr !important; }
          #win-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
    </PortalErrorBoundary>
  )
}
