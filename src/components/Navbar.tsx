import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface NavbarProps {
  clientName?: string
  isAdmin?: boolean
  showNav?: boolean
}

const NAV_LINKS = [
  { label: 'Inicio', to: '/portal' },
  { label: 'Informes', to: '/portal/informes' },
  { label: 'Mi Recorrido', to: '/portal/recorrido' },
  { label: 'Ventas', to: '/portal/ventas' },
  { label: 'Creativos', to: '/portal/creativos' },
]

export function Navbar({ clientName, isAdmin = false, showNav = false }: NavbarProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <nav
        style={{
          height: 64,
          backgroundColor: 'rgba(8,9,15,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontWeight: 800,
              fontSize: 21,
              color: '#e5182b',
              letterSpacing: '0.06em',
              textShadow: '0 0 24px rgba(229,24,43,0.4)',
            }}
          >
            TORII
          </span>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 16, fontWeight: 300 }}>|</span>
          <span style={{ color: '#555669', fontSize: 13, letterSpacing: '0.02em' }}>Delivery OS</span>
          {isAdmin && (
            <span
              style={{
                backgroundColor: 'rgba(229,24,43,0.10)',
                color: '#e5182b',
                border: '1px solid rgba(229,24,43,0.25)',
                borderRadius: 6,
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 700,
                marginLeft: 4,
                letterSpacing: '0.06em',
              }}
            >
              ADMIN
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {clientName && (
            <span style={{ color: '#8a8c9e', fontSize: 14 }}>{clientName}</span>
          )}
          <button
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#555669',
              fontSize: 13,
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: 8,
              transition: 'color 0.2s, border-color 0.2s',
              fontFamily: 'DM Sans, sans-serif',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f0f1f7'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#555669'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            }}
          >
            Salir
          </button>
        </div>
      </nav>

      {showNav && (
        <div
          style={{
            height: 48,
            background: 'rgba(8,9,15,0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 32px',
            gap: 8,
          }}
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/portal'}
              style={({ isActive }) => ({
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                color: isActive ? '#f0f1f7' : '#555669',
                background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                fontFamily: 'DM Sans, sans-serif',
              })}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                if (!el.getAttribute('aria-current')) {
                  el.style.color = '#8a8c9e'
                  el.style.background = 'rgba(255,255,255,0.04)'
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                if (!el.getAttribute('aria-current')) {
                  el.style.color = '#555669'
                  el.style.background = 'transparent'
                }
              }}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
