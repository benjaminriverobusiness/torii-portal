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
import { useState } from 'react'
import type { ClientMetrics, ClientMetricsConfig, LiAccountMetric } from '../types'

interface MetricsSectionProps {
  metrics: ClientMetrics[]
  config: ClientMetricsConfig | null
  cpbc_objective?: number
  liAccountMetrics?: LiAccountMetric[]
  selectedMetricIndex: number
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

export function MetricsSection({ metrics, config, cpbc_objective, liAccountMetrics = [], selectedMetricIndex }: MetricsSectionProps) {
  const [liDetailOpen, setLiDetailOpen] = useState(false)
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

  const selectedMetric = metrics[metrics.length - 1 - selectedMetricIndex] ?? null
  console.log('selectedMetricIndex:', selectedMetricIndex, '| selectedMetric week:', selectedMetric?.week_number, selectedMetric?.year)

  const adsChartData = metrics.map((m) => ({
    semana: `S${m.week_number}`,
    agendas: m.ads_bookings || 0,
    cpbc: m.ads_cpbc || 0,
    inversion: m.ads_investment || 0,
    leads: m.ads_leads || 0,
    show_rate: m.ads_show_rate || 0,
    close_rate: m.ads_close_rate || 0,
  }))

  // Build liChartData from liAccountMetrics grouped by week
  const liByWeek = liAccountMetrics.reduce((acc, a) => {
    const key = `${a.year}-${a.week_number}`
    if (!acc[key]) acc[key] = { semana: `S${a.week_number}`, year: a.year, week_number: a.week_number, accounts: [] }
    acc[key].accounts.push(a)
    return acc
  }, {} as Record<string, { semana: string; year: number; week_number: number; accounts: LiAccountMetric[] }>)

  const liChartData = Object.values(liByWeek)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.week_number - b.week_number)
    .map(week => {
      const avgField = (field: keyof LiAccountMetric) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vals = week.accounts.map(a => parseFloat(String(a[field] as any))).filter(v => !isNaN(v) && v > 0)
        return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0
      }
      const totalBookings = week.accounts.reduce((sum, a) => sum + (parseFloat(String(a.bookings || 0)) || 0), 0)
      return {
        semana: week.semana,
        agendas: totalBookings,
        accept_rate: avgField('accept_rate'),
        reply_rate: avgField('reply_rate'),
        offer_rate: avgField('offer_rate'),
        calendly_rate: avgField('calendly_rate'),
        booking_rate: avgField('booking_rate'),
      }
    })

  const showRate = selectedMetric?.ads_show_rate || 0
  const closeRate = selectedMetric?.ads_close_rate || 0
  const acceptRate = selectedMetric?.li_accept_rate || 0
  const replyRate = selectedMetric?.li_reply_rate || 0

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
                value={selectedMetric?.ads_investment}
                color="#c9a84c"
                prefix="$"
              />
            )}
            {config.show_ads_leads && (
              <MetricCard label="LEADS GENERADOS" value={selectedMetric?.ads_leads} color="#f0f1f7" />
            )}
            {config.show_ads_cpl && (
              <MetricCard label="COSTO POR LEAD" value={selectedMetric?.ads_cpl} color="#f0f1f7" prefix="$" />
            )}
            {config.show_ads_qualified && (
              <MetricCard
                label="LEADS CALIFICADOS"
                value={selectedMetric?.ads_qualified_leads}
                color="#60a5fa"
              />
            )}
            {config.show_ads_cpbc && (
              <MetricCard
                label="COSTO / BOOKING"
                value={selectedMetric?.ads_cpbc}
                color={
                  cpbc_objective
                    ? (selectedMetric?.ads_cpbc ?? 0) <= cpbc_objective
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

          {liAccountMetrics.length > 0 ? (() => {
            const weekAccounts = selectedMetric
              ? liAccountMetrics.filter(a => a.week_number === selectedMetric.week_number && a.year === selectedMetric.year)
              : []
            console.log('weekAccounts count:', weekAccounts.length, '| liAccountMetrics total:', liAccountMetrics.length)
            const avgField = (field: keyof LiAccountMetric) => {
              const vals = weekAccounts
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map(a => parseFloat(String(a[field] as any)))
                .filter(v => !isNaN(v) && v > 0)
              return vals.length > 0
                ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
                : null
            }
            const totalBookings = weekAccounts.reduce((sum, a) => sum + (parseFloat(String(a.bookings || 0)) || 0), 0)
            const liMetricFields: { key: keyof LiAccountMetric; label: string }[] = [
              { key: 'accept_rate', label: 'ACCEPT RATE' },
              { key: 'reply_rate', label: 'REPLY RATE' },
              { key: 'offer_rate', label: 'OFFER RATE' },
              { key: 'calendly_rate', label: 'CALENDLY RATE' },
              { key: 'booking_rate', label: 'BOOKING RATE' },
            ]
            return (
              <div style={{ marginBottom: '32px' }}>
                {/* Promedios calculados */}
                <div style={{
                  backgroundColor: 'rgba(192,132,252,0.06)',
                  border: '1px solid rgba(192,132,252,0.2)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  marginBottom: 16,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                    PROMEDIOS CALCULADOS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {liMetricFields.map(({ key, label }) => {
                      const val = avgField(key)
                      return (
                        <div key={key} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ fontSize: 10, color: '#555669', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: val != null ? '#c084fc' : '#333', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                            {val != null ? `${val}%` : '—'}
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: '#555669', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>AGENDAS TOTALES</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#c084fc', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                        {totalBookings}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ver detalle por cuenta */}
                <button
                  onClick={() => setLiDetailOpen(v => !v)}
                  style={{ background: 'transparent', border: 'none', color: '#c084fc', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 16, padding: 0, fontFamily: 'DM Sans, sans-serif' }}
                >
                  {liDetailOpen ? 'Ocultar detalle por cuenta ↑' : 'Ver detalle por cuenta ↓'}
                </button>

                {liDetailOpen && (
                  <div style={{ marginTop: 12, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          {['CUENTA', 'ACCEPT %', 'REPLY %', 'OFFER %', 'BOOKING %', 'AGENDAS'].map(h => (
                            <th key={h} style={{ textAlign: 'left', color: '#555669', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {liAccountMetrics.map((a, i) => (
                          <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            <td style={{ padding: '8px 12px', color: '#f0f1f7', fontWeight: 600 }}>{a.account_name}</td>
                            <td style={{ padding: '8px 12px', color: '#8a8c9e' }}>{a.accept_rate != null ? `${a.accept_rate}%` : '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#8a8c9e' }}>{a.reply_rate != null ? `${a.reply_rate}%` : '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#8a8c9e' }}>{a.offer_rate != null ? `${a.offer_rate}%` : '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#8a8c9e' }}>{a.booking_rate != null ? `${a.booking_rate}%` : '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#8a8c9e' }}>{a.bookings ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })() : (
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
              <MetricCard label="OFFER RATE" value={selectedMetric?.li_offer_rate} color="#c084fc" suffix="%" />
            )}
            {config.show_li_calendly_rate && (
              <MetricCard
                label="CALENDLY RATE"
                value={selectedMetric?.li_calendly_rate}
                color="#60a5fa"
                suffix="%"
              />
            )}
            {config.show_li_booking_rate && (
              <MetricCard
                label="BOOKING RATE"
                value={selectedMetric?.li_booking_rate}
                color="#4ade80"
                suffix="%"
              />
            )}
            {config.show_li_bookings && (
              <MetricCard label="AGENDAS GENERADAS" value={selectedMetric?.li_bookings} color="#f0f1f7" />
            )}
          </div>
          )}

          {/* Gráfico 4 — Agendas LI */}
          <ChartBox title="Agendas por semana">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={liChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="semana" stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} />
                <YAxis stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} />
                <Tooltip contentStyle={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f0f1f7', fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="agendas"
                  stroke="#c084fc"
                  strokeWidth={2.5}
                  dot={{ fill: '#c084fc', r: 4, strokeWidth: 2, stroke: '#08090f' }}
                  activeDot={{ r: 6, fill: '#c084fc' }}
                  name="Agendas"
                />
              </LineChart>
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
                  dataKey="offer_rate"
                  stroke="#c9a84c"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Offer rate %"
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
