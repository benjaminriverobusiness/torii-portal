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
    active: { bg: 'rgba(var(--success-rgb),0.1)', color: 'var(--success)' },
    paused: { bg: 'rgba(var(--warning-rgb),0.1)', color: 'var(--warning)' },
    cancelled: { bg: 'rgba(var(--danger-rgb),0.1)', color: 'var(--danger)' },
  }
  const s = styles[status] ?? { bg: 'rgba(var(--overlay-rgb),0.05)', color: 'var(--text-secondary)' }
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
  if (!platform) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    'Meta Ads': { bg: 'rgba(var(--orange-rgb),0.10)', color: 'var(--orange)', border: 'rgba(var(--orange-rgb),0.3)' },
    'LinkedIn Outbound': { bg: 'rgba(var(--info-rgb),0.10)', color: 'var(--info)', border: 'rgba(var(--info-rgb),0.3)' },
    'Híbrido': { bg: 'rgba(var(--purple-rgb),0.10)', color: 'var(--purple)', border: 'rgba(var(--purple-rgb),0.3)' },
  }
  const s = styles[platform] ?? { bg: 'rgba(var(--overlay-rgb),0.05)', color: 'var(--text-secondary)', border: 'rgba(var(--overlay-rgb),0.07)' }
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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <Navbar isAdmin showNav={false} />
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 240,
            backgroundColor: 'var(--surface-solid)',
            borderRight: '1px solid rgba(var(--overlay-rgb),0.07)',
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
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  cursor: 'pointer',
                  marginBottom: 4,
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(var(--overlay-rgb),0.05)')}
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
              color: 'var(--text-muted)',
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
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(var(--overlay-rgb),0.06)', border: '1px solid rgba(var(--overlay-rgb),0.1)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ color: 'var(--text-primary)', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 24, margin: 0 }}>
              Clientes
            </h2>
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: 300,
                backgroundColor: 'rgba(var(--overlay-rgb),0.04)',
                border: '1px solid rgba(var(--overlay-rgb),0.10)',
                borderRadius: 8,
                padding: '9px 14px',
                color: 'var(--text-primary)',
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
                backgroundColor: 'rgba(var(--overlay-rgb),0.03)',
                border: '1px solid rgba(var(--overlay-rgb),0.07)',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              <div className="hide-scrollbar" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-solid)' }}>
                    {['CLIENTE', 'PLATAFORMA', 'FASE', 'DÍA', 'ESTADO', 'ACTUALIZADO', 'ACCIÓN'].map((col) => {
                      const mobileHidden = ['PLATAFORMA', 'FASE', 'ESTADO', 'ACTUALIZADO'].includes(col)
                      return (
                        <th
                          key={col}
                          style={{
                            padding: '12px 20px',
                            textAlign: 'left',
                            color: 'var(--text-muted)',
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            whiteSpace: 'nowrap',
                            display: isMobile && mobileHidden ? 'none' : undefined,
                          }}
                        >
                          {col}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client, i) => {
                    const st = statuses[client.id]
                    return (
                      <tr
                        key={client.id}
                        style={{
                          backgroundColor: i % 2 === 0 ? 'var(--bg)' : 'var(--surface-solid)',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(var(--overlay-rgb),0.02)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? 'var(--bg)' : 'var(--surface-solid)')}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>{client.name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{client.email}</div>
                        </td>
                        <td style={{ padding: '14px 20px', display: isMobile ? 'none' : undefined }}>
                          <PlatformBadge platform={client.canal ?? null} />
                        </td>
                        <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontSize: 13, display: isMobile ? 'none' : undefined }}>
                          {client.fase ?? '—'}
                        </td>
                        <td style={{ padding: '14px 20px', color: 'var(--text-primary)', fontSize: 13 }}>
                          {daysActive(client.start_date)}
                          <span style={{ color: 'var(--text-muted)' }}>/90</span>
                        </td>
                        <td style={{ padding: '14px 20px', display: isMobile ? 'none' : undefined }}>
                          <StatusBadge status={client.status} />
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 13, display: isMobile ? 'none' : undefined }}>
                          {st ? (
                            <span style={{ color: 'var(--text-secondary)' }}>{formatDate(st.updated_at)}</span>
                          ) : (
                            <span style={{ color: 'var(--danger)', fontSize: 12 }}>Sin actualizar</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <Link
                            to={`/admin/client/${client.id}`}
                            style={{
                              backgroundColor: 'var(--accent)',
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
                      <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
