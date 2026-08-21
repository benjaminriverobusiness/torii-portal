import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import type { ClientVideo, Document } from '../types'

// Reportes mensuales/PDF generados desde el Hub — sección de solo lectura,
// mismo patrón que ReferidosPage.tsx (sin crear/editar/borrar). RLS en
// `reports` ya filtra a enviado=true + client_id propio, pero se repite el
// filtro acá también por claridad, mismo criterio que el resto del Portal.
interface Report {
  id: string
  periodo_tipo: string
  mes: string
  fecha_inicio: string | null
  fecha_fin: string | null
  pdf_url: string | null
  enviado_at: string | null
}

// Unifica visualmente 3 orígenes distintos (reports/client_videos/documents
// — antes vivían separados en esta pantalla y en la vieja "Informes", ver
// ReportesPage.tsx que quedó sin usar). dateTs ya resuelto a número para
// poder ordenar los 3 juntos en un solo pase; sin fecha va a -Infinity, así
// esas filas quedan al final en vez de romper el orden.
type FeedItem =
  | { kind: 'report'; id: string; dateTs: number; label: string; url: string | null }
  | { kind: 'video'; id: string; dateTs: number; label: string; url: string }
  | { kind: 'document'; id: string; dateTs: number; label: string; url: string }

const KIND_META: Record<FeedItem['kind'], { icon: string; linkLabel: string }> = {
  report: { icon: '📄', linkLabel: 'Ver PDF' },
  video: { icon: '🎥', linkLabel: 'Ver video' },
  document: { icon: '📎', linkLabel: 'Ver documento' },
}

function toTs(dateStr: string | null | undefined): number {
  if (!dateStr) return -Infinity
  const t = new Date(dateStr).getTime()
  return isNaN(t) ? -Infinity : t
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPeriod(r: Report): string {
  const inicio = r.fecha_inicio ?? r.mes
  const fin = r.fecha_fin ?? r.mes

  if (r.periodo_tipo === 'week') {
    return `Semana del ${formatDate(inicio)} al ${formatDate(fin)}`
  }
  if (r.periodo_tipo === 'custom') {
    return `${formatDate(inicio)} — ${formatDate(fin)}`
  }
  const d = new Date(inicio + 'T12:00:00')
  const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function ReportesMensualesPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('profile_id', user!.id)
          .single()
        if (!clientData) return

        const [{ data: reportsData }, { data: videosData }, { data: docsData }] = await Promise.all([
          // enviado=true NUNCA se saca de este filtro — un reporte en borrador
          // no debe aparecer en el Portal del cliente bajo ninguna circunstancia.
          supabase
            .from('reports')
            .select('id, periodo_tipo, mes, fecha_inicio, fecha_fin, pdf_url, enviado_at')
            .eq('client_id', clientData.id)
            .eq('enviado', true),
          supabase
            .from('client_videos')
            .select('*')
            .eq('client_id', clientData.id),
          supabase
            .from('documents')
            .select('*')
            .eq('client_id', clientData.id),
        ])

        const reportItems: FeedItem[] = ((reportsData ?? []) as Report[]).map((r) => ({
          kind: 'report',
          id: r.id,
          dateTs: toTs(r.fecha_fin),
          label: formatPeriod(r),
          url: r.pdf_url,
        }))
        const videoItems: FeedItem[] = ((videosData ?? []) as ClientVideo[]).map((v) => ({
          kind: 'video',
          id: v.id,
          dateTs: toTs(v.sent_at),
          label: v.title,
          url: v.video_url,
        }))
        const docItems: FeedItem[] = ((docsData ?? []) as Document[]).map((d) => ({
          kind: 'document',
          id: d.id,
          dateTs: toTs(d.upload_date),
          label: d.name,
          url: d.file_url,
        }))

        setFeedItems(
          [...reportItems, ...videoItems, ...docItems].sort((a, b) => b.dateTs - a.dateTs)
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar showNav />

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 112px)' }}>
          <Spinner size={40} />
        </div>
      ) : (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

          {/* Hero */}
          <div style={{ marginBottom: 40 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--accent)',
              background: 'rgba(var(--accent-rgb),0.10)',
              border: '1px solid rgba(var(--accent-rgb),0.22)',
              borderRadius: 99, padding: '5px 14px', marginBottom: 16,
            }}>
              REPORTES
            </div>
            <h1 style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800, color: 'var(--text-primary)',
              margin: '0 0 8px',
            }}>
              Tus reportes
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, margin: 0 }}>
              Informes de performance, videos y documentos publicados por el equipo de Torii.
            </p>
          </div>

          {feedItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 16, margin: 0 }}>
                Todavía no hay reportes publicados.
              </p>
            </div>
          ) : (
            <div style={{
              background: 'rgba(var(--overlay-rgb),0.02)',
              border: '1px solid rgba(var(--overlay-rgb),0.07)',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              {feedItems.map((item, i) => {
                const meta = KIND_META[item.kind]
                return (
                  <div
                    key={`${item.kind}:${item.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      padding: '18px 24px',
                      borderTop: i === 0 ? 'none' : '1px solid rgba(var(--overlay-rgb),0.05)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ fontSize: 18, lineHeight: '22px' }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{item.label}</div>
                        {isFinite(item.dateTs) && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
                            {formatDate(new Date(item.dateTs).toISOString().slice(0, 10))}
                          </div>
                        )}
                      </div>
                    </div>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          background: 'rgba(var(--accent-rgb),0.10)',
                          border: '1px solid rgba(var(--accent-rgb),0.3)',
                          borderRadius: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 700,
                          padding: '8px 16px', textDecoration: 'none', flexShrink: 0,
                        }}
                      >
                        {meta.linkLabel}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin PDF</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
