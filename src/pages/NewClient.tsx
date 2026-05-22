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

export function NewClient() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')
  const [platform, setPlatform] = useState('Meta Ads')
  const [startDate, setStartDate] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [cpbcObjective, setCpbcObjective] = useState('')

  const [createdClientId, setCreatedClientId] = useState('')
  const [done, setDone] = useState(false)
  const [sqlCopied, setSqlCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          name,
          email,
          country: country || null,
          platform,
          start_date: startDate || null,
          installment_amount: monthlyAmount ? parseFloat(monthlyAmount) : null,
          status: 'active',
          fase: 'Fundación',
        })
        .select()
        .single()
      if (clientError) throw clientError

      const phases = DEFAULT_PHASES.map((p) => ({ ...p, client_id: clientData.id }))
      const { error: phasesError } = await supabase.from('client_phases').insert(phases)
      if (phasesError) throw phasesError

      if (cpbcObjective) {
        await supabase.from('client_portal_status').insert({
          client_id: clientData.id,
          cpbc_objective: parseFloat(cpbcObjective),
        })
      }

      setCreatedClientId(clientData.id)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando cliente')
    } finally {
      setLoading(false)
    }
  }

  const sqlText = `UPDATE clients \nSET profile_id = '[PEGAR_ID_AQUI]'\nWHERE id = '${createdClientId}';`

  function copySQL() {
    navigator.clipboard.writeText(sqlText)
    setSqlCopied(true)
    setTimeout(() => setSqlCopied(false), 2000)
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
        <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 24px' }}>
          <div style={{ backgroundColor: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 16, padding: 32 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <h2 style={{ color: '#4ade80', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 20, margin: '0 0 4px' }}>
              Cliente creado exitosamente
            </h2>
            <p style={{ color: '#8a8c9e', fontSize: 13, margin: '0 0 24px' }}>
              Para dar acceso al portal al cliente, seguí estos pasos:
            </p>

            <ol style={{ color: '#8a8c9e', fontSize: 13, lineHeight: 1.8, paddingLeft: 18, margin: '0 0 20px' }}>
              <li>Andá a <strong style={{ color: '#f0f1f7' }}>Supabase → Authentication → Users</strong></li>
              <li>Click en <strong style={{ color: '#f0f1f7' }}>"Add user"</strong></li>
              <li>Email: <strong style={{ color: '#f0f1f7' }}>{email}</strong></li>
              <li>Tildá <strong style={{ color: '#f0f1f7' }}>"Auto Confirm User"</strong></li>
              <li>Copiá el <strong style={{ color: '#f0f1f7' }}>ID del usuario</strong> creado</li>
              <li>Ejecutá este SQL:</li>
            </ol>

            <div style={{ backgroundColor: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '16px', marginBottom: 16, fontFamily: 'monospace', fontSize: 13, color: '#c084fc', whiteSpace: 'pre', overflowX: 'auto' }}>
              {sqlText}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={copySQL}
                style={{ flex: 1, backgroundColor: sqlCopied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px', color: sqlCopied ? '#4ade80' : '#f0f1f7', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                {sqlCopied ? '¡Copiado!' : 'Copiar SQL →'}
              </button>
              <Link
                to={`/admin/client/${createdClientId}`}
                style={{ flex: 1, backgroundColor: '#e5182b', borderRadius: 8, padding: '10px', color: 'white', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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

        <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 24, color: '#f0f1f7', margin: '0 0 32px' }}>
          Nuevo Cliente
        </h2>

        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 32 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nombre completo del asesor</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email (referencia)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>País</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Canal</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ ...inputStyle, backgroundColor: '#0d0e17' }}>
                <option>Meta Ads</option>
                <option>LinkedIn Outbound</option>
                <option>Híbrido</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Fecha de inicio</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Monto mensual (USD)</label>
              <input type="number" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} style={inputStyle} min="0" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>CPBC objetivo (USD)</label>
              <input type="number" value={cpbcObjective} onChange={(e) => setCpbcObjective(e.target.value)} style={inputStyle} min="0" />
            </div>

            {error && <p style={{ color: '#e5182b', fontSize: 13, marginBottom: 16 }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', backgroundColor: '#e5182b', border: 'none', borderRadius: 8, padding: '12px', color: 'white', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif' }}
            >
              {loading && <Spinner size={16} color="white" />}
              Crear cliente →
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
