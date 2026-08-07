import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'

// Sistema de Referidos con IA — vista de solo lectura para el asesor/
// cliente. Sin crear/editar/borrar: eso vive del lado del admin. Select
// explícito de columnas (sin '*') para que ghl_contact_id ni viaje acá —
// ese campo es exclusivo del sync con GHL del Paso 5.
interface Referido {
  id: string
  referido_nombre: string
  presentado_por: string | null
  perfil_referido: string | null
  warm_intro: boolean
  estado: string
  fecha_pedido: string
}

const ESTADO_LABELS: Record<string, string> = {
  pendiente_datos: 'Esperando datos de contacto',
  pendiente_contacto: 'Por contactar',
  contactado: 'Contactado',
  en_proceso: 'En conversación',
  cerrado: 'Cerrado',
  no_califico: 'No calificó',
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente_datos: '#8a8c9e',
  pendiente_contacto: '#fb923c',
  contactado: '#60a5fa',
  en_proceso: '#c084fc',
  cerrado: '#4ade80',
  no_califico: '#555669',
}

function EstadoBadge({ estado }: { estado: string }) {
  const color = ESTADO_COLORS[estado] ?? '#8a8c9e'
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: `${color}1a`,
        color,
        border: `1px solid ${color}40`,
        borderRadius: 99,
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  )
}

function WarmIntroMark({ value }: { value: boolean }) {
  if (!value) return <span style={{ color: '#555669' }}>—</span>
  return <span style={{ color: '#4ade80', fontWeight: 700 }}>✓</span>
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const GRID_COLUMNS = '2fr 1.4fr 2fr 90px 1.4fr 110px'

export function ReferidosPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [referidos, setReferidos] = useState<Referido[]>([])

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
          .from('referidos')
          .select('id, referido_nombre, presentado_por, perfil_referido, warm_intro, estado, fecha_pedido')
          .eq('client_id', clientData.id)
          .order('fecha_pedido', { ascending: false })

        setReferidos((data ?? []) as Referido[])
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
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

          {/* Hero */}
          <div className="fade-in visible" style={{ marginBottom: 40 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#e5182b',
              background: 'rgba(229,24,43,0.10)',
              border: '1px solid rgba(229,24,43,0.22)',
              borderRadius: 99, padding: '5px 14px', marginBottom: 16,
            }}>
              MIS REFERIDOS
            </div>
            <h1 style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800, color: '#f0f1f7',
              margin: '0 0 8px',
            }}>
              El funnel de tus referidos
            </h1>
            <p style={{ color: '#8a8c9e', fontSize: 16, margin: 0 }}>
              Cada persona que presentaste, desde que se pidió el referido hasta el cierre.
            </p>
          </div>

          {referidos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <p style={{ color: '#8a8c9e', fontSize: 16, margin: 0 }}>
                Todavía no generaste referidos.
              </p>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: GRID_COLUMNS,
                gap: 12,
                padding: '12px 20px',
                background: '#0d0e17',
                color: '#555669',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                <div>Referido</div>
                <div>Presentado por</div>
                <div>Perfil</div>
                <div>Warm intro</div>
                <div>Estado</div>
                <div>Fecha de pedido</div>
              </div>

              {/* Rows */}
              {referidos.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: GRID_COLUMNS,
                    gap: 12,
                    padding: '16px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.referido_nombre}</div>
                  <div style={{ color: '#8a8c9e', fontSize: 13 }}>{r.presentado_por || '—'}</div>
                  <div style={{ color: '#8a8c9e', fontSize: 13, lineHeight: 1.5 }}>{r.perfil_referido || '—'}</div>
                  <div><WarmIntroMark value={r.warm_intro} /></div>
                  <div><EstadoBadge estado={r.estado} /></div>
                  <div style={{ color: '#8a8c9e', fontSize: 13 }}>{formatDate(r.fecha_pedido)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
