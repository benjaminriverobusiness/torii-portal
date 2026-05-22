import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import type { Client, ClientPortalStatus } from '../types'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function daysActive(startDate: string | null): number {
  if (!startDate) return 0
  const d = new Date(startDate)
  const today = new Date()
  return Math.max(0, Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)))
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    active: { bg: 'rgba(74,222,128,0.1)', color: '#4ade80' },
    paused: { bg: 'rgba(255,205,77,0.1)', color: '#fcd34d' },
    cancelled: { bg: 'rgba(248,113,113,0.1)', color: '#f87171' },
  }
  const s = styles[status] ?? { bg: 'rgba(255,255,255,0.05)', color: '#8a8c9e' }
  return (
    <span
      style={{
        backgroundColor: s.bg,
        color: s.color,
        borderRadius: 6,
        padding: '3px 10px',
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  )
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span style={{ color: '#555669' }}>—</span>
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    'Meta Ads': { bg: '#1a0c04', color: '#fb923c', border: '#fb923c30' },
    'LinkedIn Outbound': { bg: '#071228', color: '#60a5fa', border: '#60a5fa30' },
    'Híbrido': { bg: '#0f0720', color: '#c084fc', border: '#c084fc30' },
  }
  const s = styles[platform] ?? { bg: 'rgba(255,255,255,0.05)', color: '#8a8c9e', border: 'rgba(255,255,255,0.07)' }
  return (
    <span
      style={{
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        borderRadius: 99,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {platform}
    </span>
  )
}

export function Admin() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [statuses, setStatuses] = useState<Record<string, ClientPortalStatus>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [{ data: clientsData }, { data: statusData }] = await Promise.all([
          supabase.from('clients').select('*').order('created_at', { ascending: false }),
          supabase.from('client_portal_status').select('*').order('updated_at', { ascending: false }),
        ])

        setClients((clientsData ?? []) as Client[])

        const map: Record<string, ClientPortalStatus> = {}
        for (const s of (statusData ?? []) as ClientPortalStatus[]) {
          if (!map[s.client_id]) map[s.client_id] = s
        }
        setStatuses(map)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#08090f', display: 'flex', flexDirection: 'column' }}>
      <Navbar isAdmin showNav={false} />
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 240,
            backgroundColor: '#0d0e17',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            minHeight: 'calc(100vh - 64px)',
            position: 'sticky',
            top: 64,
            display: isMobile ? 'none' : 'flex',
            flexDirection: 'column',
            padding: '20px 12px',
          }}
        >
          <div style={{ flex: 1 }}>
            {[
              { label: 'Clientes', path: '/admin' },
              { label: 'Nuevo Cliente', path: '/admin/new' },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 20px',
                  borderRadius: 8,
                  background: 'none',
                  border: 'none',
                  color: '#f0f1f7',
                  fontSize: 14,
                  cursor: 'pointer',
                  marginBottom: 4,
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/login')}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '12px 20px',
              borderRadius: 8,
              background: 'none',
              border: 'none',
              color: '#555669',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Cerrar sesión
          </button>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, padding: isMobile ? 16 : 40, overflowX: 'auto', width: isMobile ? '100%' : undefined }}>
          {isMobile && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Clientes', path: '/admin' },
                { label: 'Nuevo Cliente', path: '/admin/new' },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f1f7', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ color: '#f0f1f7', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 24, margin: 0 }}>
              Clientes
            </h2>
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: 300,
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8,
                padding: '9px 14px',
                color: '#f0f1f7',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'DM Sans, sans-serif',
              }}
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <Spinner size={36} />
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              <div className="hide-scrollbar" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0d0e17' }}>
                    {['CLIENTE', 'PLATAFORMA', 'FASE', 'DÍA', 'ESTADO', 'ACTUALIZADO', 'ACCIÓN'].map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: '12px 20px',
                          textAlign: 'left',
                          color: '#555669',
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client, i) => {
                    const st = statuses[client.id]
                    return (
                      <tr
                        key={client.id}
                        style={{
                          backgroundColor: i % 2 === 0 ? '#08090f' : '#0d0e17',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#08090f' : '#0d0e17')}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 600 }}>{client.name}</div>
                          <div style={{ color: '#555669', fontSize: 12, marginTop: 2 }}>{client.email}</div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <PlatformBadge platform={client.platform} />
                        </td>
                        <td style={{ padding: '14px 20px', color: '#8a8c9e', fontSize: 13 }}>
                          {client.fase ?? '—'}
                        </td>
                        <td style={{ padding: '14px 20px', color: '#f0f1f7', fontSize: 13 }}>
                          {daysActive(client.start_date)}
                          <span style={{ color: '#555669' }}>/90</span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <StatusBadge status={client.status} />
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13 }}>
                          {st ? (
                            <span style={{ color: '#8a8c9e' }}>{formatDate(st.updated_at)}</span>
                          ) : (
                            <span style={{ color: '#f87171', fontSize: 12 }}>Sin actualizar</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <Link
                            to={`/admin/client/${client.id}`}
                            style={{
                              backgroundColor: '#e5182b',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 14px',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                              textDecoration: 'none',
                              display: 'inline-block',
                              transition: 'background-color 0.2s',
                            }}
                          >
                            Editar →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#555669' }}>
                        No se encontraron clientes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
