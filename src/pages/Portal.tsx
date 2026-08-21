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
        <div style={{ padding: 40, color: 'var(--danger)', textAlign: 'center' }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Error al renderizar el portal</p>
          <pre style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
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
  const s = new Date(start + 'T12:00:00')
  const sStr = `${s.getDate().toString().padStart(2, '0')}/${(s.getMonth() + 1).toString().padStart(2, '0')}`
  if (!end) return sStr
  const e = new Date(end + 'T12:00:00')
  const eStr = `${e.getDate().toString().padStart(2, '0')}/${(e.getMonth() + 1).toString().padStart(2, '0')}/${e.getFullYear()}`
  return `${sStr} — ${eStr}`
}

function SectionLabel({
  text,
  color = 'var(--accent)',
  bg = 'rgba(var(--accent-rgb),0.10)',
  border = 'rgba(var(--accent-rgb),0.22)',
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

function GlowDot({ color = 'var(--accent)' }: { color?: string }) {
  return (
    <div
      className="glow-dot"
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
        boxShadow: `0 0 8px ${color}, 0 0 20px color-mix(in srgb, ${color} 40%, transparent)`,
      }}
    />
  )
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    'Meta Ads': { bg: 'rgba(var(--orange-rgb),0.08)', color: 'var(--orange)', border: 'rgba(var(--orange-rgb),0.25)' },
    'LinkedIn Outbound': { bg: 'rgba(var(--info-rgb),0.08)', color: 'var(--info)', border: 'rgba(var(--info-rgb),0.25)' },
    'Híbrido': { bg: 'rgba(var(--purple-rgb),0.08)', color: 'var(--purple)', border: 'rgba(var(--purple-rgb),0.25)' },
  }
  const s = styles[platform] ?? { bg: 'rgba(var(--overlay-rgb),0.05)', color: 'var(--text-secondary)', border: 'rgba(var(--overlay-rgb),0.07)' }
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
        <GlowDot color="var(--success)" />
        <span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.1em', color: 'var(--success)', fontWeight: 700 }}>
          HITOS ALCANZADOS
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {items.map((item) => (
          <div
            key={item.label}
            className="card-hover"
            style={{
              backgroundColor: item.done ? 'rgba(var(--success-rgb),0.04)' : 'rgba(var(--overlay-rgb),0.02)',
              border: `1px solid ${item.done ? 'rgba(var(--success-rgb),0.25)' : 'rgba(var(--overlay-rgb),0.07)'}`,
              borderRadius: 14,
              padding: '16px 20px',
              minWidth: 180,
              flexShrink: 0,
              cursor: 'default',
            }}
          >
            {item.done ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginBottom: 10 }}>
                <circle cx="10" cy="10" r="9" stroke="var(--success)" strokeWidth="1.5" />
                <path d="M6 10l3 3 5-5" stroke="var(--success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginBottom: 10 }}>
                <circle cx="10" cy="10" r="9" stroke="var(--text-muted)" strokeWidth="1.5" />
              </svg>
            )}
            <div style={{ color: item.done ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>
              {item.label}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
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

// ─── Semana calendario en vivo ──────────────────────────────────
// "Métricas por Semana" ya no lee registro_semanal_fullfillment — se
// calcula agrupando ads_metricas_diarias/client_closer_calls por semana
// ISO (lunes a domingo), desde effectiveStartDate hasta hoy. Cada semana
// del rango existe siempre para navegar, con datos en cero si no hubo
// actividad, sin depender de que exista una fila cargada a mano.

type WeeklyComputedMetric = ClientMetrics & {
  week_end: string
  agendas_generadas: number
  llamadas_realizadas: number
  no_shows: number
  // Criterio nuevo, distinto de ads_qualified_leads (que es de Ads):
  // basado en client_closer_calls.califico/cerro, confirmado por el
  // usuario para esta sección.
  calificados_real: number
  cerrados_real: number
  tasa_calificacion_real: number | null
  tasa_cierre_real: number | null
  notas: string | null
}

function mondayOf(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  m.setHours(0, 0, 0, 0)
  return m
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isoWeekNumber(d: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { week, year: date.getUTCFullYear() }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function Portal() {
  const { client, status, phases, videos, documents, registros, hitos, loading, error } = useClient()
  const [metricsConfig, setMetricsConfig] = useState<ClientMetricsConfig | null>(null)
  const [selectedMetricIndex, setSelectedMetricIndex] = useState(0)
  const [liAccountMetrics, setLiAccountMetrics] = useState<LiAccountMetric[]>([])
  const [leads, setLeads] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [adsTotalsData, setAdsTotalsData] = useState<{ fecha: string; inversion: number | null; leads: number | null; calificados: number | null; impresiones: number | null; clics: number | null }[]>([])
  const [campaignStartDate, setCampaignStartDate] = useState<string | null>(null)
  const [reportsForNotes, setReportsForNotes] = useState<{ fecha_inicio: string | null; fecha_fin: string | null; narrativa: { resumen_ejecutivo?: string } | null }[]>([])

  useEffect(() => {
    if (!client?.id) return
    async function fetchMetrics() {
      const [configRes, leadsRes, adsTotalsRes, campaignStartRes, reportsRes] = await Promise.all([
        supabase
          .from('client_metrics_config')
          .select('*')
          .eq('client_id', client!.id)
          .maybeSingle(),
        supabase
          .from('client_closer_calls')
          .select('*, asistio:se_presento, calificado:califico, cerrado:cerro')
          .eq('client_id', client!.id)
          .eq('owner_type', 'client'),
        // Con fecha + calificados: sirve tanto para los totales (sumando
        // todas las filas, como antes) como para agrupar por semana acá
        // abajo — una sola query para ambos usos.
        supabase
          .from('ads_metricas_diarias')
          .select('fecha, inversion, leads, calificados, impresiones, clics, ads_campanas!inner(client_id)')
          .eq('ads_campanas.client_id', client!.id),
        // Fecha real de arranque de campaña = la fecha más vieja con datos de
        // Ads para este cliente. Si no hay ninguna fila (cliente sin Ads
        // todavía), campaignStartDate queda null y el fallback es
        // client.start_date (ver effectiveStartDate más abajo).
        supabase
          .from('ads_metricas_diarias')
          .select('fecha, ads_campanas!inner(client_id)')
          .eq('ads_campanas.client_id', client!.id)
          .order('fecha', { ascending: true })
          .limit(1),
        // Para la nota automática de cada semana — nunca enviado=false,
        // mismo criterio que ReportesMensualesPage.
        supabase
          .from('reports')
          .select('fecha_inicio, fecha_fin, narrativa')
          .eq('client_id', client!.id)
          .eq('enviado', true),
      ])
      setMetricsConfig(configRes.data as ClientMetricsConfig | null)
      setLeads(leadsRes.data ?? [])
      setAdsTotalsData((adsTotalsRes.data ?? []) as typeof adsTotalsData)
      setCampaignStartDate(campaignStartRes.data?.[0]?.fecha ?? null)
      setReportsForNotes((reportsRes.data ?? []) as typeof reportsForNotes)
    }
    fetchMetrics()
  }, [client?.id])

  useEffect(() => {
    if (!client?.id) return
    async function fetchLiAccounts() {
      const { data } = await supabase
        .from('li_account_metrics')
        .select('*')
        .eq('client_id', client!.id)
        .order('week_start', { ascending: true })
      setLiAccountMetrics((data ?? []) as LiAccountMetric[])
    }
    fetchLiAccounts()
  }, [client?.id])

  console.log('Portal data:', { client, status, phases, loading, error })

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
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
        <div style={{ color: 'var(--accent)', fontSize: '14px' }}>
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
          border: '3px solid rgba(var(--overlay-rgb),0.12)',
          borderTop: '3px solid var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 700 }}>
          Tu dashboard se actualizará pronto.
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          El equipo de Torii está preparando tu sistema.
        </p>
      </div>
    )
  }

  if (!status) return null

  // Fecha real de arranque = la más vieja con datos de Ads. client.start_date
  // (fecha de contrato/onboarding con Torii) queda como único fallback, para
  // clientes que todavía no tienen ninguna fila en ads_metricas_diarias.
  const effectiveStartDate = campaignStartDate ?? client?.start_date

  const daysActive = (() => {
    try {
      if (!effectiveStartDate) return 0
      const start = new Date(effectiveStartDate)
      const today = new Date()
      const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      return Math.max(0, diff)
    } catch { return 0 }
  })()

  const contractDuration = client?.contract_days || 90
  const progress = Math.min(daysActive / contractDuration, 1)
  const circumference = 2 * Math.PI * 52

  const activePhase = phases.find((p) => p.id === status.active_phase_id) ?? phases[0]

  // Semanas calendario (lunes a domingo) desde effectiveStartDate hasta la
  // semana actual, siempre completas — nunca dependen de que exista una
  // fila cargada a mano. Orden descendente (semana actual = índice 0),
  // igual que la navegación de siempre.
  const weeklyData: WeeklyComputedMetric[] = (() => {
    if (!effectiveStartDate) return []
    const start = mondayOf(new Date(effectiveStartDate + 'T12:00:00'))
    const todayMonday = mondayOf(new Date())
    const todayStr = toISODate(new Date())
    const weeks: WeeklyComputedMetric[] = []

    for (let d = todayMonday; d.getTime() >= start.getTime(); d = addDays(d, -7)) {
      const weekStartStr = toISODate(d)
      const weekEndStr = toISODate(addDays(d, 6))
      const { week: weekNumber, year } = isoWeekNumber(d)

      const adsInWeek = adsTotalsData.filter((r) => r.fecha >= weekStartStr && r.fecha <= weekEndStr)
      const inversionSemana = adsInWeek.reduce((s, r) => s + (r.inversion ?? 0), 0)
      const leadsSemana = adsInWeek.reduce((s, r) => s + (r.leads ?? 0), 0)
      const calificadosAdsSemana = adsInWeek.reduce((s, r) => s + (r.calificados ?? 0), 0)
      const cpl = leadsSemana > 0 ? round2(inversionSemana / leadsSemana) : undefined
      const cpbc = calificadosAdsSemana > 0 ? round2(inversionSemana / calificadosAdsSemana) : undefined

      const callsInWeek = leads.filter((l) => l.fecha_llamada && l.fecha_llamada >= weekStartStr && l.fecha_llamada <= weekEndStr)
      const agendasGeneradas = callsInWeek.length
      const llamadasRealizadas = callsInWeek.filter((l) => l.asistio === true).length
      const noShows = callsInWeek.filter((l) => l.asistio === false && l.fecha_llamada <= todayStr).length
      const showRate = agendasGeneradas > 0 ? round1((llamadasRealizadas / agendasGeneradas) * 100) : undefined

      // califico (booleano viejo) quedó congelado en false para leads nuevos desde
      // que el CRM migró a calificacion (3 valores) — mismo criterio que cpbcTotal
      // más abajo: 'Calificado' estricto para calificación, 'Calificado' + 'Calificado
      // tipo B' (ampio) para el denominador de cierre, igual que closeRateTotal.
      const calificadosReal = callsInWeek.filter((l) => l.asistio === true && l.calificacion === 'Calificado').length
      const calificadosAmplioSemana = callsInWeek.filter((l) => l.asistio === true && (l.calificacion === 'Calificado' || l.calificacion === 'Calificado tipo B')).length
      const cerradosReal = callsInWeek.filter((l) => l.cerrado === true).length
      const tasaCalificacionReal = agendasGeneradas > 0 ? round1((calificadosReal / agendasGeneradas) * 100) : null
      const tasaCierreReal = calificadosAmplioSemana > 0 ? round1((cerradosReal / calificadosAmplioSemana) * 100) : null

      const reporteSemana = reportsForNotes.find(
        (r) => r.fecha_inicio && r.fecha_fin && r.fecha_inicio <= weekEndStr && r.fecha_fin >= weekStartStr
      )

      weeks.push({
        id: `week-${weekStartStr}`,
        client_id: client!.id,
        created_at: weekStartStr,
        updated_at: weekStartStr,
        week_number: weekNumber,
        year,
        week_start: weekStartStr,
        week_end: weekEndStr,
        ads_investment: inversionSemana,
        ads_leads: leadsSemana,
        ads_cpl: cpl,
        ads_qualified_leads: calificadosAdsSemana,
        ads_bookings: agendasGeneradas,
        ads_cpbc: cpbc,
        ads_show_rate: showRate,
        ads_close_rate: tasaCierreReal ?? undefined,
        agendas_generadas: agendasGeneradas,
        llamadas_realizadas: llamadasRealizadas,
        no_shows: noShows,
        calificados_real: calificadosReal,
        cerrados_real: cerradosReal,
        tasa_calificacion_real: tasaCalificacionReal,
        tasa_cierre_real: tasaCierreReal,
        notas: reporteSemana?.narrativa?.resumen_ejecutivo ?? null,
      })
    }
    return weeks
  })()

  const selectedMetrics = weeklyData[selectedMetricIndex] ?? null

  function normalizeRate(value: number | null | undefined): number {
    if (!value) return 0
    return value <= 1 ? value * 100 : value
  }

  const agendasEfectivas = leads.filter(l => l.asistio === true).length
  const withAsistio = leads.filter(l => l.asistio)
  const showRateTotal = leads.length > 0 ? Math.round((withAsistio.length / leads.length) * 100) : null
  const calificadosEstricto = leads.filter(l => l.asistio === true && l.calificacion === 'Calificado')
  const calificacionRateTotal = leads.length > 0 ? Math.round((calificadosEstricto.length / leads.length) * 100) : null
  const calificadosAmplio = leads.filter(l => l.asistio === true && (l.calificacion === 'Calificado' || l.calificacion === 'Calificado tipo B'))
  const cerrados = leads.filter(l => l.cerrado)
  const closeRateTotal = calificadosAmplio.length > 0 ? Math.round((cerrados.length / calificadosAmplio.length) * 100) : null

  const inversionTotal = adsTotalsData.reduce((sum, r) => sum + (r.inversion ?? 0), 0)
  const leadsAdsTotal = adsTotalsData.reduce((sum, r) => sum + (r.leads ?? 0), 0)
  const impresionesTotal = adsTotalsData.reduce((sum, r) => sum + (r.impresiones ?? 0), 0)
  const clicsTotal = adsTotalsData.reduce((sum, r) => sum + (r.clics ?? 0), 0)

  // Solo 'Calificado' cuenta como calificó para este número — 'Calificado
  // tipo B' y 'Semicalificado' quedan afuera a propósito (confirmado).
  const agendasCalificadasEfectivas = leads.filter(
    (l) => l.asistio === true && l.calificacion === 'Calificado'
  ).length
  const cpbcTotal = agendasCalificadasEfectivas > 0
    ? inversionTotal / agendasCalificadasEfectivas
    : null

  console.log('Rendering portal with:', {
    daysActive,
    activePhase: phases?.find((p) => p.id === status?.active_phase_id),
    statusData: status,
  })

  return (
    <PortalErrorBoundary>
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar clientName={client?.name} showNav />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px', display: 'block', visibility: 'visible', opacity: 1 }}>

        {/* HERO */}
        {(() => { try { return (
        <div
          className="fade-in visible"
          style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(var(--overlay-rgb),0.02)',
            border: '1px solid rgba(var(--overlay-rgb),0.07)',
            borderRadius: 20,
            padding: 40,
            marginBottom: 32,
          }}
        >
          {/* Dot grid background */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(var(--accent-rgb),0.12) 1px, transparent 1px)',
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
            background: 'radial-gradient(ellipse at 65% 0%, rgba(var(--accent-rgb),0.18) 0%, transparent 55%)',
            zIndex: 0,
          }} />
          {/* Bottom fade */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
            background: 'linear-gradient(to top, rgba(var(--bg-rgb),0.6), transparent)',
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
                    color: 'var(--text-primary)',
                    lineHeight: 1.1,
                    margin: '0 0 14px',
                  }}
                >
                  {activePhase?.phase_name ?? 'Sin etapa activa'}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.75, margin: '0 0 28px', maxWidth: 480 }}>
                  {activePhase?.phase_description ?? ''}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <PlatformBadge platform={client?.canal ?? null} />
                  {client?.country && (
                    <span style={{ backgroundColor: 'rgba(var(--overlay-rgb),0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(var(--overlay-rgb),0.08)', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
                      {client.country}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>DÍA</div>
                <div style={{
                  fontFamily: 'Bricolage Grotesque, sans-serif',
                  fontSize: 72,
                  fontWeight: 800,
                  color: 'var(--accent)',
                  lineHeight: 1,
                  textShadow: '0 0 40px rgba(var(--accent-rgb),0.55), 0 0 80px rgba(var(--accent-rgb),0.25)',
                }}>
                  {daysActive}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, letterSpacing: '0.06em' }}>DE {contractDuration}</div>

                <div style={{ marginTop: 20 }}>
                  <svg width="110" height="110" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" stroke="rgba(var(--overlay-rgb),0.07)" strokeWidth="7" fill="none" />
                    <circle
                      cx="60" cy="60" r="52"
                      stroke="var(--accent)"
                      strokeWidth="7"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - progress)}
                      transform="rotate(-90 60 60)"
                      style={{
                        transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        filter: 'drop-shadow(0 0 6px rgba(var(--accent-rgb),0.7))',
                      }}
                    />
                    <text x="60" y="60" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="17" fontWeight="700" fontFamily="Bricolage Grotesque, sans-serif">
                      {Math.round(daysActive / contractDuration * 100)}%
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
          <div style={{ backgroundColor: 'rgba(var(--overlay-rgb),0.02)', border: '1px solid rgba(var(--overlay-rgb),0.07)', borderRadius: 20, padding: '48px 40px', overflow: 'visible' }}>
            <JourneyMap phases={phases} active_phase_id={status.active_phase_id} days_in_phase={status.days_in_phase} />
          </div>
        </div>
        )} catch(e) { console.error('JourneyMap error:', e); return <div style={{color:'red',padding:16}}>Error en JourneyMap</div> } })()}

        {/* MÉTRICAS TOTALES */}
        {(() => { try { return (
        <div className="fade-in visible" style={{ display: 'block', marginBottom: 32 }}>
          <SectionLabel text="MÉTRICAS TOTALES" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="kpi-grid">
            <KpiCard label="AGENDAS EFECTIVAS" value={agendasEfectivas} colorLogic="neutral" delay={0} tooltip="Cantidad de llamadas donde el lead se presentó (se_presento = true)." />
            <KpiCard label="SHOW RATE TOTAL" value={showRateTotal} suffix="%" objective={60} colorLogic="showRate" delay={100} tooltip="Se presentó / Total de llamadas × 100." />
            <KpiCard label="TASA CALIFICACIÓN" value={calificacionRateTotal} suffix="%" colorLogic="neutral" delay={200} tooltip="Se presentó Y quedó como 'Calificado' / Total de llamadas × 100. No incluye 'Calificado tipo B' ni 'Semicalificado'." />
            <KpiCard label="CLOSE RATE TOTAL" value={closeRateTotal} suffix="%" objective={25} colorLogic="closingRate" delay={300} tooltip="Cerró / Se presentó y calificó (Calificado o Calificado tipo B) × 100." />
            <KpiCard label="INVERSIÓN TOTAL" value={inversionTotal} prefix="$" colorLogic="neutral" delay={400} tooltip="Suma de la inversión en Meta Ads desde el arranque real de la campaña." />
            <KpiCard label="AGENDAS (ADS)" value={leadsAdsTotal} colorLogic="neutral" delay={500} tooltip="Cantidad de agendas generadas por los anuncios de Meta Ads, calificadas o no." />
            <KpiCard label="IMPRESIONES" value={impresionesTotal} colorLogic="neutral" delay={600} tooltip="Suma total desde el arranque real de la campaña." />
            <KpiCard label="CLICS" value={clicsTotal} colorLogic="neutral" delay={700} tooltip="Suma total desde el arranque real de la campaña." />
            <KpiCard label="CPBC TOTAL" value={cpbcTotal} prefix="$" colorLogic="neutral" delay={800} tooltip="Inversión total / cantidad de llamadas donde se presentó Y quedó específicamente como 'Calificado' (no cuenta 'Calificado tipo B' ni 'Semicalificado')." />
          </div>
        </div>
        )} catch(e) { console.error('KPIs error:', e); return <div style={{color:'red',padding:16}}>Error en KPIs</div> } })()}

        {/* HITOS */}
        {(() => { try { return hitos ? <HitosSection hitos={hitos} /> : null } catch(e) { console.error('Hitos error:', e); return null } })()}

        {/* WIN + NEXT STEP */}
        {(() => { try { return (
        <div className="fade-in visible" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }} id="win-grid">
          {/* Último resultado */}
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(var(--accent-rgb),0.04)',
            border: '1px solid rgba(var(--accent-rgb),0.18)',
            borderRadius: 16,
            padding: 28,
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: 'linear-gradient(to bottom, var(--accent), rgba(var(--accent-rgb),0.2))', borderRadius: '0 0 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <GlowDot color="var(--accent)" />
              <span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.1em', color: 'var(--accent)', fontWeight: 700 }}>ÚLTIMO RESULTADO</span>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.75, margin: 0 }}>
              {status.current_win ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
            </p>
          </div>

          {/* Próximos 7 días */}
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(var(--info-rgb),0.04)',
            border: '1px solid rgba(var(--info-rgb),0.18)',
            borderRadius: 16,
            padding: 28,
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: 'linear-gradient(to bottom, var(--info), rgba(var(--info-rgb),0.2))', borderRadius: '0 0 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--info)', flexShrink: 0, boxShadow: '0 0 8px var(--info), 0 0 20px rgba(var(--info-rgb),0.4)' }} />
              <span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.1em', color: 'var(--info)', fontWeight: 700 }}>PRÓXIMOS 7 DÍAS</span>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.75, margin: '0 0 16px' }}>
              {status.next_step ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
            </p>
            <div style={{ height: 1, backgroundColor: 'rgba(var(--overlay-rgb),0.06)', margin: '0 0 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>Actualizado el {formatDate(status.updated_at)}</p>
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

        {/* MÉTRICAS POR SEMANA — secundaria, agrupada con el historial semanal de más abajo */}
        {(() => { try { return (
        <div className="fade-in visible" style={{ display: 'block', marginBottom: 32 }}>
          <SectionLabel text="MÉTRICAS POR SEMANA" />

          {/* Navegación entre semanas */}
          {weeklyData.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <button
                disabled={selectedMetricIndex === weeklyData.length - 1}
                onClick={() => setSelectedMetricIndex(prev => prev + 1)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  backgroundColor: selectedMetricIndex === weeklyData.length - 1 ? 'rgba(var(--overlay-rgb),0.02)' : 'rgba(var(--overlay-rgb),0.05)',
                  border: '1px solid rgba(var(--overlay-rgb),0.08)',
                  borderRadius: 8,
                  color: selectedMetricIndex === weeklyData.length - 1 ? 'var(--text-ghost)' : 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: selectedMetricIndex === weeklyData.length - 1 ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                ← Semana anterior
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {selectedMetrics && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
                      Semana {selectedMetrics.week_number} · {selectedMetrics.year}
                    </span>
                    {selectedMetricIndex === 0 && (
                      <span style={{
                        backgroundColor: 'rgba(var(--success-rgb),0.15)',
                        color: 'var(--success)',
                        border: '1px solid rgba(var(--success-rgb),0.3)',
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
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    {formatWeekRange(selectedMetrics.week_start, selectedMetrics.week_end)}
                  </span>
                )}
              </div>

              <button
                disabled={selectedMetricIndex === 0}
                onClick={() => setSelectedMetricIndex(prev => prev - 1)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  backgroundColor: selectedMetricIndex === 0 ? 'rgba(var(--overlay-rgb),0.02)' : 'rgba(var(--overlay-rgb),0.05)',
                  border: '1px solid rgba(var(--overlay-rgb),0.08)',
                  borderRadius: 8,
                  color: selectedMetricIndex === 0 ? 'var(--text-ghost)' : 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: selectedMetricIndex === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Semana siguiente →
              </button>
            </div>
          )}

          {/* Calidad de las llamadas — criterio de closer (client_closer_calls),
              distinto del calificados de Ads que ya muestra MetricsSection. */}
          {selectedMetrics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }} className="week-quality-grid">
              {[
                { label: 'CALIFICADOS', value: selectedMetrics.calificados_real },
                { label: 'CERRADOS', value: selectedMetrics.cerrados_real },
                { label: 'TASA CALIFICACIÓN', value: selectedMetrics.tasa_calificacion_real, suffix: '%' },
                { label: 'TASA CIERRE', value: selectedMetrics.tasa_cierre_real, suffix: '%' },
              ].map((s) => (
                <div key={s.label} style={{ backgroundColor: 'rgba(var(--overlay-rgb),0.02)', border: '1px solid rgba(var(--overlay-rgb),0.07)', borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ textTransform: 'uppercase', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {s.value !== null && s.value !== undefined ? `${s.value}${s.suffix ?? ''}` : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedMetrics?.notas && (
            <div style={{ backgroundColor: 'rgba(var(--overlay-rgb),0.02)', border: '1px solid rgba(var(--overlay-rgb),0.07)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ textTransform: 'uppercase', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>NOTA DEL REPORTE DE ESTA SEMANA</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{selectedMetrics.notas}</p>
            </div>
          )}

          <MetricsSection
            metrics={weeklyData}
            config={metricsConfig}
            cpbc_objective={status?.cpbc_objective ?? undefined}
            liAccountMetrics={liAccountMetrics}
            selectedMetricIndex={selectedMetricIndex}
          />
        </div>
        ) } catch(e) { console.error('Metrics error:', e); return null } })()}

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
                    backgroundColor: 'rgba(var(--overlay-rgb),0.06)',
                  }} />
                )}
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute', left: 0, top: 6,
                  width: 16, height: 16, borderRadius: '50%',
                  backgroundColor: i === 0 ? 'var(--accent)' : 'rgba(var(--overlay-rgb),0.06)',
                  border: i === 0 ? 'none' : '1px solid rgba(var(--overlay-rgb),0.12)',
                  boxShadow: i === 0 ? '0 0 10px rgba(var(--accent-rgb),0.5)' : 'none',
                }} />
                <div style={{
                  backgroundColor: 'rgba(var(--overlay-rgb),0.02)',
                  border: '1px solid rgba(var(--overlay-rgb),0.07)',
                  borderRadius: 12,
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13, minWidth: 56, fontWeight: 600 }}>
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
                          backgroundColor: 'rgba(var(--overlay-rgb),0.04)',
                          border: '1px solid rgba(var(--overlay-rgb),0.08)',
                          borderRadius: 20,
                          padding: '4px 12px',
                          color: 'var(--text-secondary)',
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
          <p style={{ color: 'var(--text-ghost)', fontSize: 12 }}>Torii Delivery OS</p>
        </footer>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .week-quality-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .video-grid { grid-template-columns: 1fr !important; }
          #win-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
    </PortalErrorBoundary>
  )
}
