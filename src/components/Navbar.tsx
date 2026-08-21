import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

interface NavbarProps {
  clientName?: string
  isAdmin?: boolean
  showNav?: boolean
}

const NAV_LINKS = [
  { label: 'Inicio', to: '/portal' },
  { label: 'Chat', to: '/portal/chat' },
  { label: 'Mi Recorrido', to: '/portal/recorrido' },
  { label: 'Ventas', to: '/portal/ventas' },
  { label: 'Referidos', to: '/portal/referidos' },
  { label: 'Reportes', to: '/portal/reportes' },
  { label: 'Academia', to: '/portal/academia' },
  // { label: 'Creativos', to: '/portal/creativos' },
]

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'
  return (
    <button
      onClick={toggleTheme}
      title={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'color 0.2s, border-color 0.2s, background-color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--text-primary)'
        e.currentTarget.style.borderColor = 'var(--border-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-secondary)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {isLight ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

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
          backgroundColor: 'rgba(var(--bg-rgb),0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
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
              color: 'var(--accent)',
              letterSpacing: '0.06em',
              textShadow: '0 0 24px var(--accent-glow)',
            }}
          >
            TORII
          </span>
          <span style={{ color: 'rgba(var(--overlay-rgb),0.18)', fontSize: 16, fontWeight: 300 }}>|</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, letterSpacing: '0.02em' }}>Delivery OS</span>
          {isAdmin && (
            <span
              style={{
                backgroundColor: 'var(--accent-dim)',
                color: 'var(--accent)',
                border: '1px solid rgba(var(--accent-rgb),0.25)',
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
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{clientName}</span>
          )}
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: 8,
              transition: 'color 0.2s, border-color 0.2s',
              fontFamily: 'DM Sans, sans-serif',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)'
              e.currentTarget.style.borderColor = 'var(--border-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            Salir
          </button>
        </div>
      </nav>

      {showNav && (
        <div
          className="hide-scrollbar"
          style={{
            height: 48,
            background: 'rgba(var(--bg-rgb),0.95)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 32px',
            gap: 8,
            overflowX: 'auto',
            flexWrap: 'nowrap',
            WebkitOverflowScrolling: 'touch',
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
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                background: isActive ? 'var(--bg-card-hover)' : 'transparent',
                fontFamily: 'DM Sans, sans-serif',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              })}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                if (!el.getAttribute('aria-current')) {
                  el.style.color = 'var(--text-secondary)'
                  el.style.background = 'var(--bg-card)'
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                if (!el.getAttribute('aria-current')) {
                  el.style.color = 'var(--text-muted)'
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
