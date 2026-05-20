import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'

const DEFAULT_PHASES = [
  {
    phase_order: 1,
    phase_name: 'Activación de mercado',
    phase_description: 'Estamos configurando tu sistema y lanzando las primeras acciones hacia tu mercado objetivo.',
  },
  {
    phase_order: 2,
    phase_name: 'Activación del sistema',
    phase_description: 'Tu sistema está en marcha. Las primeras agendas calificadas están comenzando a llegar.',
  },
  {
    phase_order: 3,
    phase_name: 'Activación de ventas',
    phase_description: 'El mercado responde. Ahora el foco es convertir esas agendas en clientes reales para tu negocio.',
  },
  {
    phase_order: 4,
    phase_name: 'Activación de economía',
    phase_description: 'Tu inversión está generando retorno real. Optimizamos para maximizar cada peso invertido.',
  },
  {
    phase_order: 5,
    phase_name: 'Escalado',
    phase_description: 'El sistema es predecible y rentable. Preparamos la siguiente etapa de crecimiento contigo.',
  },
]

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function NewClient() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [createdUserId, setCreatedUserId] = useState('')

  // Step 2
  const [country, setCountry] = useState('')
  const [platform, setPlatform] = useState('Meta Ads')
  const [startDate, setStartDate] = useState('')
  const [amount, setAmount] = useState('')

  // Success
  const [createdClientId, setCreatedClientId] = useState('')
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
          data: { name, role: 'client' },
        },
      })
      if (signUpError) throw signUpError
      const uid = data.user?.id
      if (!uid) throw new Error('No se pudo crear el usuario')

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: uid,
        email,
        name,
        role: 'client',
      })
      if (profileError) throw profileError

      setCreatedUserId(uid)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando usuario')
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          name,
          email,
          profile_id: createdUserId,
          country: country || null,
          platform,
          start_date: startDate || null,
          status: 'active',
          installment_amount: amount ? parseFloat(amount) : null,
        })
        .select()
        .single()
      if (clientError) throw clientError

      const phases = DEFAULT_PHASES.map((p) => ({ ...p, client_id: clientData.id }))
      const { error: phasesError } = await supabase.from('client_phases').insert(phases)
      if (phasesError) throw phasesError

      setCreatedClientId(clientData.id)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando cliente')
    } finally {
      setLoading(false)
    }
  }

  function copyCredentials() {
    navigator.clipboard.writeText(`Email: ${email}\nContraseña: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 8,
    padding: '11px 14px',
    color: '#f0f1f7',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: '#8a8c9e',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: 500,
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#08090f' }}>
        <Navbar isAdmin />
        <div style={{ maxWidth: 520, margin: '60px auto', padding: '0 24px' }}>
          <div
            style={{
              backgroundColor: 'rgba(74,222,128,0.05)',
              border: '1px solid rgba(74,222,128,0.2)',
              borderRadius: 16,
              padding: 32,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <h2 style={{ color: '#4ade80', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 22, margin: '0 0 8px' }}>
              Cliente creado
            </h2>
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
                padding: 20,
                marginTop: 20,
                textAlign: 'left',
              }}
            >
              <p style={{ color: '#8a8c9e', fontSize: 12, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Credenciales
              </p>
              <p style={{ color: '#f0f1f7', fontSize: 14, margin: '0 0 4px' }}>Email: {email}</p>
              <p style={{ color: '#f0f1f7', fontSize: 14, margin: 0 }}>Contraseña: {password}</p>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={copyCredentials}
                style={{
                  flex: 1,
                  backgroundColor: copied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '10px',
                  color: copied ? '#4ade80' : '#f0f1f7',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {copied ? '¡Copiado!' : 'Copiar credenciales'}
              </button>
              <Link
                to={`/admin/client/${createdClientId}`}
                style={{
                  flex: 1,
                  backgroundColor: '#e5182b',
                  borderRadius: 8,
                  padding: '10px',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Ver perfil del cliente →
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#08090f' }}>
      <Navbar isAdmin />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px' }}>
        <Link to="/admin" style={{ color: '#8a8c9e', fontSize: 14, textDecoration: 'none', display: 'block', marginBottom: 24 }}>
          ← Volver
        </Link>

        <h2
          style={{
            fontFamily: 'Bricolage Grotesque, sans-serif',
            fontSize: 24,
            color: '#f0f1f7',
            margin: '0 0 32px',
          }}
        >
          Nuevo Cliente
        </h2>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          {[1, 2].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: step >= s ? '#e5182b' : 'rgba(255,255,255,0.07)',
                  border: `2px solid ${step >= s ? '#e5182b' : 'rgba(255,255,255,0.12)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: step >= s ? 'white' : '#555669',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {s}
              </div>
              <span style={{ color: step >= s ? '#f0f1f7' : '#555669', fontSize: 13 }}>
                {s === 1 ? 'Cuenta' : 'Datos'}
              </span>
              {i < 1 && (
                <div style={{ width: 40, height: 1, backgroundColor: step > 1 ? '#e5182b' : 'rgba(255,255,255,0.07)' }} />
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            padding: 32,
          }}
        >
          {step === 1 ? (
            <form onSubmit={handleStep1}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Nombre completo</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Contraseña</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ ...inputStyle, paddingRight: 40 }}
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
                  <button
                    type="button"
                    onClick={() => setPassword(generatePassword())}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      padding: '0 16px',
                      color: '#f0f1f7',
                      fontSize: 13,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    Generar
                  </button>
                </div>
              </div>
              {error && <p style={{ color: '#e5182b', fontSize: 13, marginBottom: 16 }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  backgroundColor: '#e5182b',
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
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {loading && <Spinner size={16} color="white" />}
                Continuar →
              </button>
            </form>
          ) : (
            <form onSubmit={handleStep2}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>País</label>
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Plataforma</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  style={{ ...inputStyle, backgroundColor: '#0d0e17' }}
                >
                  <option>Meta Ads</option>
                  <option>LinkedIn Outbound</option>
                  <option>Híbrido</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Fecha de inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Monto mensual (USD)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={inputStyle}
                  min="0"
                />
              </div>
              {error && <p style={{ color: '#e5182b', fontSize: 13, marginBottom: 16 }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  backgroundColor: '#e5182b',
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
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {loading && <Spinner size={16} color="white" />}
                Crear cliente →
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
