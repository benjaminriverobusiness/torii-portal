import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'

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
  const [reports, setReports] = useState<Report[]>([])

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

        const { data } = await supabase
          .from('reports')
          .select('id, periodo_tipo, mes, fecha_inicio, fecha_fin, pdf_url, enviado_at')
          .eq('client_id', clientData.id)
          .eq('enviado', true)
          .order('fecha_fin', { ascending: false })

        setReports((data ?? []) as Report[])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#08090f', color: '#f0f1f7', fontFamily: 'DM Sans, sans-serif' }}>
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
              textTransform: 'uppercase', color: '#e5182b',
              background: 'rgba(229,24,43,0.10)',
              border: '1px solid rgba(229,24,43,0.22)',
              borderRadius: 99, padding: '5px 14px', marginBottom: 16,
            }}>
              REPORTES
            </div>
            <h1 style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800, color: '#f0f1f7',
              margin: '0 0 8px',
            }}>
              Tus reportes mensuales
            </h1>
            <p style={{ color: '#8a8c9e', fontSize: 16, margin: 0 }}>
              El informe de performance de cada período, publicado por el equipo de Torii.
            </p>
          </div>

          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <p style={{ color: '#8a8c9e', fontSize: 16, margin: 0 }}>
                Todavía no hay reportes publicados.
              </p>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              {reports.map((r, i) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '18px 24px',
                    borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{formatPeriod(r)}</div>
                    {r.enviado_at && (
                      <div style={{ color: '#8a8c9e', fontSize: 13, marginTop: 2 }}>
                        Publicado el {formatDate(r.enviado_at.slice(0, 10))}
                      </div>
                    )}
                  </div>
                  {r.pdf_url ? (
                    <a
                      href={r.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'rgba(229,24,43,0.10)',
                        border: '1px solid rgba(229,24,43,0.3)',
                        borderRadius: 8, color: '#e5182b', fontSize: 13, fontWeight: 700,
                        padding: '8px 16px', textDecoration: 'none', flexShrink: 0,
                      }}
                    >
                      Ver PDF
                    </a>
                  ) : (
                    <span style={{ color: '#555669', fontSize: 13 }}>Sin PDF</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
