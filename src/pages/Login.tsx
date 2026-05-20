import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/Spinner'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) throw authError

      const userId = data.user?.id
      if (!userId) throw new Error('No se pudo obtener el usuario')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError

      if (profile?.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/portal')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#08090f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: 40,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontWeight: 700,
              fontSize: 36,
              color: '#e5182b',
              letterSpacing: '0.15em',
            }}
          >
            TORII
          </div>
          <div style={{ color: '#555669', fontSize: 13, marginTop: 6 }}>
            Delivery OS
          </div>
        </div>

        <div
          style={{
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.07)',
            marginBottom: 28,
          }}
        />

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                color: '#8a8c9e',
                fontSize: 12,
                marginBottom: 8,
                fontWeight: 500,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8,
                padding: '11px 14px',
                color: '#f0f1f7',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(229,24,43,0.5)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                color: '#8a8c9e',
                fontSize: 12,
                marginBottom: 8,
                fontWeight: 500,
              }}
            >
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 8,
                  padding: '11px 44px 11px 14px',
                  color: '#f0f1f7',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(229,24,43,0.5)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: '#555669',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 24,
              backgroundColor: loading ? 'rgba(229,24,43,0.5)' : '#e5182b',
              border: 'none',
              borderRadius: 8,
              padding: '12px',
              color: 'white',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background-color 0.2s',
              fontFamily: 'DM Sans, sans-serif',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#c91525'
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#e5182b'
            }}
          >
            {loading ? <Spinner size={18} color="white" /> : null}
            {loading ? 'Ingresando...' : 'Ingresar →'}
          </button>

          {error && (
            <p
              style={{
                color: '#e5182b',
                fontSize: 13,
                marginTop: 12,
                textAlign: 'center',
              }}
            >
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
