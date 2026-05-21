import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Area,
  ReferenceLine,
  LineChart,
} from 'recharts'
import type { ClientMetrics, ClientMetricsConfig } from '../types'

interface MetricsSectionProps {
  metrics: ClientMetrics[]
  config: ClientMetricsConfig | null
  cpbc_objective?: number
}

const tooltipContentStyle = {
  background: '#0d0e17',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#f0f1f7',
}

const axisStyle = {
  stroke: '#555669' as const,
  fontSize: 11,
  tick: { fill: '#555669' },
}

const gridStyle = {
  strokeDasharray: '3 3' as const,
  stroke: 'rgba(255,255,255,0.05)' as const,
}

function SectionPill({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        textTransform: 'uppercase',
        fontSize: 11,
        letterSpacing: '0.1em',
        color: '#e5182b',
        backgroundColor: 'rgba(229,24,43,0.10)',
        border: '1px solid rgba(229,24,43,0.22)',
        borderRadius: 99,
        padding: '5px 14px',
        fontWeight: 700,
        ...style,
      }}
    >
      {text}
    </div>
  )
}

function MetricCard({
  label,
  value,
  color,
  prefix = '',
  suffix = '',
}: {
  label: string
  value: number | undefined | null
  color: string
  prefix?: string
  suffix?: string
}) {
  const display = value ?? 0
  const formatted =
    typeof display === 'number'
      ? display.toLocaleString('es-ES', { maximumFractionDigits: 2 })
      : display
  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          textTransform: 'uppercase',
          fontSize: 10,
          color: '#555669',
          letterSpacing: '0.1em',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontSize: 28,
          fontWeight: 700,
          color,
        }}
      >
        {prefix}
        {formatted}
        {suffix}
      </div>
    </div>
  )
}

function ChartBox({
  title,
  children,
  note,
}: {
  title: string
  children: React.ReactNode
  note?: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px',
      }}
    >
      <div
        style={{
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontSize: 16,
          fontWeight: 700,
          color: '#f0f1f7',
          marginBottom: '16px',
        }}
      >
        {title}
      </div>
      {children}
      {note && (
        <div
          style={{
            color: '#555669',
            fontSize: '12px',
            fontStyle: 'italic',
            marginTop: '12px',
          }}
        >
          {note}
        </div>
      )}
    </div>
  )
}

export function MetricsSection({ metrics, config, cpbc_objective }: MetricsSectionProps) {
  if (!config || (!config.show_ads_section && !config.show_li_section)) return null

  if (metrics.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          style={{ marginBottom: '16px' }}
        >
          <rect x="4" y="28" width="8" height="16" rx="2" fill="#333" />
          <rect x="16" y="18" width="8" height="26" rx="2" fill="#333" />
          <rect x="28" y="22" width="8" height="22" rx="2" fill="#333" />
          <rect x="40" y="10" width="8" height="34" rx="2" fill="#333" />
        </svg>
        <p style={{ color: '#8a8c9e', fontSize: '16px', fontWeight: 600, margin: 0 }}>
          Las métricas semanales aparecerán aquí a medida que avance el programa.
        </p>
        <p style={{ color: '#555669', fontSize: '13px', marginTop: '8px' }}>
          El equipo de Torii actualiza esta sección cada semana.
        </p>
      </div>
    )
  }

  const last = metrics[metrics.length - 1]

  const adsChartData = metrics.map((m) => ({
    semana: `S${m.week_number}`,
    agendas: m.ads_bookings || 0,
    cpbc: m.ads_cpbc || 0,
    inversion: m.ads_investment || 0,
    leads: m.ads_leads || 0,
    show_rate: m.ads_show_rate || 0,
    close_rate: m.ads_close_rate || 0,
  }))

  const liChartData = metrics.map((m) => ({
    semana: `S${m.week_number}`,
    agendas: m.li_bookings || 0,
    accept_rate: m.li_accept_rate || 0,
    reply_rate: m.li_reply_rate || 0,
    offer_rate: m.li_offer_rate || 0,
    calendly_rate: m.li_calendly_rate || 0,
    booking_rate: m.li_booking_rate || 0,
  }))

  const showRate = last.ads_show_rate || 0
  const closeRate = last.ads_close_rate || 0
  const acceptRate = last.li_accept_rate || 0
  const replyRate = last.li_reply_rate || 0

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Mensaje de contexto */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          padding: '16px 20px',
          background: 'rgba(201,168,76,0.06)',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: '12px',
          marginBottom: '32px',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          style={{ flexShrink: 0, marginTop: 2 }}
        >
          <circle cx="10" cy="10" r="9" stroke="#c9a84c" strokeWidth="1.5" />
          <text
            x="10"
            y="14"
            textAnchor="middle"
            fill="#c9a84c"
            fontSize="12"
            fontWeight="700"
            fontFamily="sans-serif"
          >
            i
          </text>
        </svg>
        <p style={{ color: '#c9a84c', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
          El sistema de captación mejora con el tiempo. Las primeras semanas son de calibración —
          cada semana el algoritmo aprende más sobre tu cliente ideal y los resultados se vuelven
          más consistentes y predecibles.
        </p>
      </div>

      {/* SECCIÓN META ADS */}
      {config.show_ads_section && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <SectionPill text="PUBLICIDAD — META ADS" />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
              marginBottom: '32px',
            }}
          >
            {config.show_ads_investment && (
              <MetricCard
                label="INVERSIÓN SEMANAL"
                value={last.ads_investment}
                color="#c9a84c"
                prefix="$"
              />
            )}
            {config.show_ads_leads && (
              <MetricCard label="LEADS GENERADOS" value={last.ads_leads} color="#f0f1f7" />
            )}
            {config.show_ads_cpl && (
              <MetricCard label="COSTO POR LEAD" value={last.ads_cpl} color="#f0f1f7" prefix="$" />
            )}
            {config.show_ads_qualified && (
              <MetricCard
                label="LEADS CALIFICADOS"
                value={last.ads_qualified_leads}
                color="#60a5fa"
              />
            )}
            {config.show_ads_cpbc && (
              <MetricCard
                label="COSTO / BOOKING"
                value={last.ads_cpbc}
                color={
                  cpbc_objective
                    ? (last.ads_cpbc ?? 0) <= cpbc_objective
                      ? '#4ade80'
                      : '#e5182b'
                    : '#f0f1f7'
                }
                prefix="$"
              />
            )}
            {config.show_ads_show_rate && (
              <MetricCard
                label="SHOW RATE"
                value={showRate}
                color={showRate >= 60 ? '#4ade80' : '#e5182b'}
                suffix="%"
              />
            )}
            {config.show_ads_close_rate && (
              <MetricCard
                label="CLOSE RATE"
                value={closeRate}
                color={closeRate >= 25 ? '#4ade80' : '#e5182b'}
                suffix="%"
              />
            )}
          </div>

          {/* Gráfico 1 — Agendas por semana */}
          <ChartBox
            title="Agendas por semana"
            note="📈 La tendencia muestra la dirección del sistema. Las variaciones semana a semana son normales — lo importante es la dirección."
          >
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={adsChartData}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="semana" {...axisStyle} />
                <YAxis {...axisStyle} />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Bar
                  dataKey="agendas"
                  fill="#e5182b"
                  fillOpacity={0.8}
                  radius={[4, 4, 0, 0]}
                  name="Agendas"
                />
                <Line
                  type="monotone"
                  dataKey="agendas"
                  stroke="#c9a84c"
                  strokeWidth={2}
                  dot={false}
                  name="Tendencia"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>

          {/* Gráfico 2 — CPBC semana a semana */}
          {config.show_ads_cpbc && (
            <ChartBox title="Costo por booking calificado (CPBC)">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={adsChartData}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="semana" {...axisStyle} />
                  <YAxis {...axisStyle} />
                  <Tooltip contentStyle={tooltipContentStyle} />
                  <Line
                    type="monotone"
                    dataKey="cpbc"
                    stroke="#c9a84c"
                    strokeWidth={2.5}
                    dot={{ fill: '#c9a84c', r: 4 }}
                    name="CPBC ($)"
                  />
                  {cpbc_objective && (
                    <ReferenceLine
                      y={cpbc_objective}
                      stroke="rgba(229,24,43,0.5)"
                      strokeDasharray="4 4"
                      label={{ value: 'Objetivo', fill: '#e5182b', fontSize: 11 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          )}

          {/* Gráfico 3 — Inversión vs Leads */}
          {config.show_ads_investment && config.show_ads_leads && (
            <ChartBox title="Inversión vs Leads generados">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={adsChartData}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis dataKey="semana" {...axisStyle} />
                  <YAxis yAxisId="left" {...axisStyle} />
                  <YAxis yAxisId="right" orientation="right" {...axisStyle} />
                  <Tooltip contentStyle={tooltipContentStyle} />
                  <Legend wrapperStyle={{ color: '#8a8c9e', fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="inversion"
                    yAxisId="left"
                    fill="rgba(201,168,76,0.1)"
                    stroke="#c9a84c"
                    strokeWidth={2}
                    name="Inversión ($)"
                  />
                  <Bar
                    dataKey="leads"
                    yAxisId="right"
                    fill="rgba(96,165,250,0.7)"
                    radius={[3, 3, 0, 0]}
                    name="Leads"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
        </div>
      )}

      {/* SECCIÓN LINKEDIN */}
      {config.show_li_section && (
        <div>
          <div style={{ marginTop: '48px', marginBottom: '24px' }}>
            <SectionPill text="PROSPECCIÓN — LINKEDIN" />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
              marginBottom: '32px',
            }}
          >
            {config.show_li_accept_rate && (
              <MetricCard
                label="ACCEPT RATE"
                value={acceptRate}
                color={acceptRate >= 25 ? '#4ade80' : '#e5182b'}
                suffix="%"
              />
            )}
            {config.show_li_reply_rate && (
              <MetricCard
                label="REPLY RATE"
                value={replyRate}
                color={replyRate >= 8 ? '#4ade80' : '#e5182b'}
                suffix="%"
              />
            )}
            {config.show_li_offer_rate && (
              <MetricCard label="OFFER RATE" value={last.li_offer_rate} color="#c084fc" suffix="%" />
            )}
            {config.show_li_calendly_rate && (
              <MetricCard
                label="CALENDLY RATE"
                value={last.li_calendly_rate}
                color="#60a5fa"
                suffix="%"
              />
            )}
            {config.show_li_booking_rate && (
              <MetricCard
                label="BOOKING RATE"
                value={last.li_booking_rate}
                color="#4ade80"
                suffix="%"
              />
            )}
            {config.show_li_bookings && (
              <MetricCard label="AGENDAS GENERADAS" value={last.li_bookings} color="#f0f1f7" />
            )}
          </div>

          {/* Gráfico 4 — Agendas LI */}
          <ChartBox title="Agendas por semana">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={liChartData}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="semana" {...axisStyle} />
                <YAxis {...axisStyle} />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Bar
                  dataKey="agendas"
                  fill="#c084fc"
                  fillOpacity={0.8}
                  radius={[4, 4, 0, 0]}
                  name="Agendas"
                />
                <Line
                  type="monotone"
                  dataKey="agendas"
                  stroke="#c9a84c"
                  strokeWidth={2}
                  dot={false}
                  name="Tendencia"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartBox>

          {/* Gráfico 5 — Tasas de conversión LI */}
          <ChartBox title="Tasas de conversión del funnel">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={liChartData}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="semana" {...axisStyle} />
                <YAxis {...axisStyle} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Legend wrapperStyle={{ color: '#8a8c9e', fontSize: '12px' }} />
                <Line
                  dataKey="accept_rate"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Accept rate %"
                />
                <Line
                  dataKey="reply_rate"
                  stroke="#c084fc"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Reply rate %"
                />
                <Line
                  dataKey="booking_rate"
                  stroke="#4ade80"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Booking rate %"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
      )}
    </div>
  )
}
