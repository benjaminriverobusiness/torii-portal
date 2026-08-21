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
  background: 'var(--surface-solid)',
  border: '1px solid rgba(var(--overlay-rgb),0.1)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
}

const axisStyle = {
  stroke: 'var(--text-muted)' as const,
  fontSize: 11,
  tick: { fill: 'var(--text-muted)' },
}

const gridStyle = {
  strokeDasharray: '3 3' as const,
  stroke: 'rgba(var(--overlay-rgb),0.05)' as const,
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
        color: 'var(--accent)',
        backgroundColor: 'rgba(var(--accent-rgb),0.10)',
        border: '1px solid rgba(var(--accent-rgb),0.22)',
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
        backgroundColor: 'rgba(var(--overlay-rgb),0.02)',
        border: '1px solid rgba(var(--overlay-rgb),0.07)',
        borderRadius: '12px',
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          textTransform: 'uppercase',
          fontSize: 10,
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontSize: 20,
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
        backgroundColor: 'rgba(var(--overlay-rgb),0.02)',
        border: '1px solid rgba(var(--overlay-rgb),0.07)',
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
          color: 'var(--text-primary)',
          marginBottom: '16px',
        }}
      >
        {title}
      </div>
      {children}
      {note && (
        <div
          style={{
            color: 'var(--text-muted)',
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
          <rect x="4" y="28" width="8" height="16" rx="2" fill="var(--text-ghost)" />
          <rect x="16" y="18" width="8" height="26" rx="2" fill="var(--text-ghost)" />
          <rect x="28" y="22" width="8" height="22" rx="2" fill="var(--text-ghost)" />
          <rect x="40" y="10" width="8" height="34" rx="2" fill="var(--text-ghost)" />
        </svg>
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', fontWeight: 600, margin: 0 }}>
          Las métricas semanales aparecerán aquí a medida que avance el programa.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>
          El equipo de Torii actualiza esta sección cada semana.
        </p>
      </div>
    )
  }

  const selectedMetric = metrics[selectedMetricIndex] ?? null
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
          background: 'rgba(var(--gold-rgb),0.06)',
          border: '1px solid rgba(var(--gold-rgb),0.2)',
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
          <circle cx="10" cy="10" r="9" stroke="var(--gold)" strokeWidth="1.5" />
          <text
            x="10"
            y="14"
            textAnchor="middle"
            fill="var(--gold)"
            fontSize="12"
            fontWeight="700"
            fontFamily="sans-serif"
          >
            i
          </text>
        </svg>
        <p style={{ color: 'var(--gold)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
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
                color="var(--gold)"
                prefix="$"
              />
            )}
            {config.show_ads_leads && (
              <MetricCard label="AGENDAS (ADS)" value={selectedMetric?.ads_leads} color="var(--text-primary)" />
            )}
            {config.show_ads_cpl && (
              <MetricCard label="CPL" value={selectedMetric?.ads_cpl} color="var(--text-primary)" prefix="$" />
            )}
            {config.show_ads_qualified && (
              <MetricCard
                label="AGENDAS CALIFICADAS"
                value={selectedMetric?.ads_qualified_leads}
                color="var(--info)"
              />
            )}
            {config.show_ads_cpbc && (
              <MetricCard
                label="CPBC"
                value={selectedMetric?.ads_cpbc}
                color={
                  cpbc_objective
                    ? (selectedMetric?.ads_cpbc ?? 0) <= cpbc_objective
                      ? 'var(--success)'
                      : 'var(--accent)'
                    : 'var(--text-primary)'
                }
                prefix="$"
              />
            )}
            {config.show_ads_show_rate && (
              <MetricCard
                label="SHOW RATE"
                value={showRate}
                color={showRate >= 60 ? 'var(--success)' : 'var(--accent)'}
                suffix="%"
              />
            )}
            {config.show_ads_close_rate && (
              <MetricCard
                label="CLOSE RATE"
                value={closeRate}
                color={closeRate >= 25 ? 'var(--success)' : 'var(--accent)'}
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
                  fill="var(--accent)"
                  fillOpacity={0.8}
                  radius={[4, 4, 0, 0]}
                  name="Agendas"
                />
                <Line
                  type="monotone"
                  dataKey="agendas"
                  stroke="var(--gold)"
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
                    stroke="var(--gold)"
                    strokeWidth={2.5}
                    dot={{ fill: 'var(--gold)', r: 4 }}
                    name="CPBC ($)"
                  />
                  {cpbc_objective && (
                    <ReferenceLine
                      y={cpbc_objective}
                      stroke="rgba(var(--accent-rgb),0.5)"
                      strokeDasharray="4 4"
                      label={{ value: 'Objetivo', fill: 'var(--accent)', fontSize: 11 }}
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
                  <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '12px' }} />
                  <Area
                    type="monotone"
                    dataKey="inversion"
                    yAxisId="left"
                    fill="rgba(var(--gold-rgb),0.1)"
                    stroke="var(--gold)"
                    strokeWidth={2}
                    name="Inversión ($)"
                  />
                  <Bar
                    dataKey="leads"
                    yAxisId="right"
                    fill="rgba(var(--info-rgb),0.7)"
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
                  backgroundColor: 'rgba(var(--purple-rgb),0.06)',
                  border: '1px solid rgba(var(--purple-rgb),0.2)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  marginBottom: 16,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                    PROMEDIOS CALCULADOS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {liMetricFields.map(({ key, label }) => {
                      const val = avgField(key)
                      return (
                        <div key={key} style={{ backgroundColor: 'rgba(var(--overlay-rgb),0.02)', border: '1px solid rgba(var(--overlay-rgb),0.07)', borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: val != null ? 'var(--purple)' : 'var(--text-ghost)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                            {val != null ? `${val}%` : '—'}
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ backgroundColor: 'rgba(var(--overlay-rgb),0.02)', border: '1px solid rgba(var(--overlay-rgb),0.07)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>AGENDAS TOTALES</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--purple)', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                        {totalBookings}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ver detalle por cuenta */}
                <button
                  onClick={() => setLiDetailOpen(v => !v)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--purple)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 16, padding: 0, fontFamily: 'DM Sans, sans-serif' }}
                >
                  {liDetailOpen ? 'Ocultar detalle por cuenta ↑' : 'Ver detalle por cuenta ↓'}
                </button>

                {liDetailOpen && (
                  <div style={{ marginTop: 12, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr>
                          {['CUENTA', 'ACCEPT %', 'REPLY %', 'OFFER %', 'BOOKING %', 'AGENDAS'].map(h => (
                            <th key={h} style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 12px', borderBottom: '1px solid rgba(var(--overlay-rgb),0.06)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {liAccountMetrics.map((a, i) => (
                          <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? 'rgba(var(--overlay-rgb),0.02)' : 'transparent' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{a.account_name}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{a.accept_rate != null ? `${a.accept_rate}%` : '—'}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{a.reply_rate != null ? `${a.reply_rate}%` : '—'}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{a.offer_rate != null ? `${a.offer_rate}%` : '—'}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{a.booking_rate != null ? `${a.booking_rate}%` : '—'}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{a.bookings ?? '—'}</td>
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
                color={acceptRate >= 25 ? 'var(--success)' : 'var(--accent)'}
                suffix="%"
              />
            )}
            {config.show_li_reply_rate && (
              <MetricCard
                label="REPLY RATE"
                value={replyRate}
                color={replyRate >= 8 ? 'var(--success)' : 'var(--accent)'}
                suffix="%"
              />
            )}
            {config.show_li_offer_rate && (
              <MetricCard label="OFFER RATE" value={selectedMetric?.li_offer_rate} color="var(--purple)" suffix="%" />
            )}
            {config.show_li_calendly_rate && (
              <MetricCard
                label="CALENDLY RATE"
                value={selectedMetric?.li_calendly_rate}
                color="var(--info)"
                suffix="%"
              />
            )}
            {config.show_li_booking_rate && (
              <MetricCard
                label="BOOKING RATE"
                value={selectedMetric?.li_booking_rate}
                color="var(--success)"
                suffix="%"
              />
            )}
            {config.show_li_bookings && (
              <MetricCard label="AGENDAS GENERADAS" value={selectedMetric?.li_bookings} color="var(--text-primary)" />
            )}
          </div>
          )}

          {/* Gráfico 4 — Agendas LI */}
          <ChartBox title="Agendas por semana">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={liChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--overlay-rgb),0.05)" />
                <XAxis dataKey="semana" stroke="var(--text-muted)" fontSize={11} tick={{ fill: 'var(--text-muted)' }} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tick={{ fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid rgba(var(--overlay-rgb),0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="agendas"
                  stroke="var(--purple)"
                  strokeWidth={2.5}
                  dot={{ fill: 'var(--purple)', r: 4, strokeWidth: 2, stroke: 'var(--bg)' }}
                  activeDot={{ r: 6, fill: 'var(--purple)' }}
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
                <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '12px' }} />
                <Line
                  dataKey="accept_rate"
                  stroke="var(--info)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Accept rate %"
                />
                <Line
                  dataKey="reply_rate"
                  stroke="var(--purple)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Reply rate %"
                />
                <Line
                  dataKey="offer_rate"
                  stroke="var(--gold)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Offer rate %"
                />
                <Line
                  dataKey="booking_rate"
                  stroke="var(--success)"
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
