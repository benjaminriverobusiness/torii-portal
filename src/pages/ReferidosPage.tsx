import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'

// Sistema de Referidos con IA — el asesor puede ver los referidos que llegan
// del bot de GHL y también cargar/editar referidos a mano. `estado` es
// exclusivo del bot de GHL y del webhook de agendamiento: nunca se muestra
// ni se edita desde el Portal, ni al crear ni al editar — al cargar a mano
// se calcula una sola vez (según si hay teléfono) y de ahí en más queda
// fuera de alcance. Select explícito de columnas (sin '*') para que
// ghl_contact_id ni viaje acá — ese campo es exclusivo del sync con GHL.
interface Referido {
  id: string
  referido_nombre: string
  presentado_por: string | null
  referido_telefono: string | null
  perfil_referido: string | null
  warm_intro: boolean
  incentivo: string | null
  estado: string
  fecha_pedido: string
  notas: string | null
  fecha_contacto: string | null
  fecha_cierre: string | null
}

interface ReferidoFormState {
  referido_nombre: string
  presentado_por: string
  referido_telefono: string
  perfil_referido: string
  warm_intro: boolean
  incentivo: string
}

const EMPTY_FORM: ReferidoFormState = {
  referido_nombre: '',
  presentado_por: '',
  referido_telefono: '',
  perfil_referido: '',
  warm_intro: true,
  incentivo: '',
}

const INCENTIVO_OPTIONS: { value: string; label: string }[] = [
  { value: 'relacional', label: 'Relacional' },
  { value: 'servicio', label: 'Servicio' },
  { value: 'monetario', label: 'Monetario' },
  { value: 'ninguno', label: 'Ninguno' },
]

const ESTADO_LABELS: Record<string, string> = {
  pendiente_datos: 'Esperando datos de contacto',
  pendiente_contacto: 'Por contactar',
  contactado: 'Contactado',
  en_proceso: 'En conversación',
  cerrado: 'Cerrado',
  no_califico: 'No calificó',
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente_datos: 'var(--text-secondary)',
  pendiente_contacto: 'var(--orange)',
  contactado: 'var(--info)',
  en_proceso: 'var(--purple)',
  cerrado: 'var(--success)',
  no_califico: 'var(--text-muted)',
}

function EstadoBadge({ estado }: { estado: string }) {
  const color = ESTADO_COLORS[estado] ?? 'var(--text-secondary)'
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
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
  if (!value) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Para fecha_contacto/fecha_cierre (timestamptz) — a diferencia de
// formatDate() de arriba, estos ya traen hora real, así que no hace falta
// el truco de +T12:00:00 (ese es solo para evitar corrimiento de día en
// columnas `date` puras).
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Los 3 mensajes que pide el punto C: qué falta para avanzar, y si el
// contacto automático por WhatsApp está activo (nunca lo está hoy — no hay
// ningún flag de "bot activo" en la base para ningún cliente/agente, así
// que este mensaje es el mismo para todos, no depende del referido).
const BOT_WHATSAPP_DISCLAIMER =
  "El contacto automático por WhatsApp todavía no está activo para ningún agente — el bot de GHL para esto no está terminado de configurar. Por ahora el equipo de Torii contacta a los referidos a mano."

function getEstadoGuidance(estado: string): { missing: string; bot: string | null } {
  if (estado === 'pendiente_datos') {
    return { missing: 'Falta el teléfono del referido para poder contactarlo.', bot: BOT_WHATSAPP_DISCLAIMER }
  }
  if (estado === 'pendiente_contacto') {
    return { missing: 'Ya tiene teléfono cargado — está listo para que lo contacten.', bot: BOT_WHATSAPP_DISCLAIMER }
  }
  if (estado === 'contactado' || estado === 'en_proceso') {
    return { missing: 'Ya está en conversación con el equipo de Torii.', bot: BOT_WHATSAPP_DISCLAIMER }
  }
  // cerrado / no_califico — proceso terminado, no aplica ninguno de los 2 mensajes.
  return { missing: 'Proceso terminado.', bot: null }
}

const GRID_COLUMNS = '2fr 1.4fr 2fr 90px 1.4fr 110px 90px'

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(var(--overlay-rgb),0.04)',
  border: '1px solid rgba(var(--overlay-rgb),0.10)',
  borderRadius: 8,
  padding: '11px 14px',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'DM Sans, sans-serif',
  marginBottom: 16,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--text-secondary)',
  fontSize: 12,
  marginBottom: 8,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

// ─── Modal de alta/edición ──────────────────────────────────────────────
// Campos editables: referido_nombre, presentado_por, referido_telefono,
// perfil_referido, warm_intro, incentivo. `estado` (y id/client_id/
// origen_call_id/ghl_contact_id/created_at) nunca aparecen acá.

function ReferidoModal({
  isEditing, form, setForm, saving, error, onSave, onClose,
}: {
  isEditing: boolean
  form: ReferidoFormState
  setForm: React.Dispatch<React.SetStateAction<ReferidoFormState>>
  saving: boolean
  error: string | null
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-solid)', border: '1px solid rgba(var(--overlay-rgb),0.1)', borderRadius: 20, padding: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {isEditing ? 'Editar referido' : 'Agregar referido'}
          </h2>
          <button style={{ color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', background: 'transparent', border: 'none', lineHeight: 1 }} onClick={onClose}>✕</button>
        </div>

        <label style={labelStyle}>Nombre del referido *</label>
        <input style={inputStyle} type="text" required value={form.referido_nombre} onChange={(e) => setForm((f) => ({ ...f, referido_nombre: e.target.value }))} />

        <label style={labelStyle}>Presentado por *</label>
        <input style={inputStyle} type="text" required placeholder="Nombre del cliente que hizo la referencia" value={form.presentado_por} onChange={(e) => setForm((f) => ({ ...f, presentado_por: e.target.value }))} />

        <label style={labelStyle}>Teléfono</label>
        <input style={inputStyle} type="text" value={form.referido_telefono} onChange={(e) => setForm((f) => ({ ...f, referido_telefono: e.target.value }))} />

        <label style={labelStyle}>Perfil del referido</label>
        <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={form.perfil_referido} onChange={(e) => setForm((f) => ({ ...f, perfil_referido: e.target.value }))} />

        <label style={labelStyle}>Incentivo</label>
        <select style={{ ...inputStyle, backgroundColor: 'var(--surface-solid)' }} value={form.incentivo} onChange={(e) => setForm((f) => ({ ...f, incentivo: e.target.value }))}>
          <option value="">Sin especificar</option>
          {INCENTIVO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, cursor: 'pointer' }} onClick={() => setForm((f) => ({ ...f, warm_intro: !f.warm_intro }))}>
          <div style={{ width: 40, height: 22, borderRadius: 11, background: form.warm_intro ? 'var(--accent)' : 'rgba(var(--overlay-rgb),0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', position: 'absolute', top: 2, left: form.warm_intro ? 20 : 2, transition: 'left 0.2s' }} />
          </div>
          <span style={{ fontSize: 14, color: 'var(--text-primary)', userSelect: 'none' }}>Warm intro (ya hubo contacto directo)</span>
        </div>

        {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '16px 0 0' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(var(--overlay-rgb),0.1)', color: 'var(--text-secondary)', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={onClose}>
            Cancelar
          </button>
          <button
            style={{ padding: '10px 24px', background: 'var(--accent)', color: 'white', fontWeight: 700, borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }}
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReferidosPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [referidos, setReferidos] = useState<Referido[]>([])
  const [clientId, setClientId] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editingReferido, setEditingReferido] = useState<Referido | null>(null)
  const [form, setForm] = useState<ReferidoFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function loadReferidos(cid: string) {
    const { data } = await supabase
      .from('referidos')
      .select('id, referido_nombre, presentado_por, referido_telefono, perfil_referido, warm_intro, incentivo, estado, fecha_pedido, notas, fecha_contacto, fecha_cierre')
      .eq('client_id', cid)
      .order('fecha_pedido', { ascending: false })
    setReferidos((data ?? []) as Referido[])
  }

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
        setClientId(clientData.id)
        await loadReferidos(clientData.id)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  function openNew() {
    setEditingReferido(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowModal(true)
  }

  function openEdit(r: Referido) {
    setEditingReferido(r)
    setForm({
      referido_nombre: r.referido_nombre,
      presentado_por: r.presentado_por ?? '',
      referido_telefono: r.referido_telefono ?? '',
      perfil_referido: r.perfil_referido ?? '',
      warm_intro: r.warm_intro,
      incentivo: r.incentivo ?? '',
    })
    setFormError(null)
    setShowModal(true)
  }

  async function handleSave() {
    if (!clientId) return
    if (!form.referido_nombre.trim() || !form.presentado_por.trim()) {
      setFormError('Nombre del referido y quién lo presentó son obligatorios.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (editingReferido) {
        // Edición: `estado` solo se recalcula si todavía está en uno de los
        // 2 estados "pre-contacto" (pendiente_datos/pendiente_contacto),
        // con la misma regla que el alta — o sea, mientras el bot de GHL
        // todavía no tomó el referido, el Portal puede seguir ajustando el
        // estado según si hay teléfono cargado. Una vez que el bot/webhook
        // lo movió a contactado/en_proceso/cerrado/no_califico, `estado`
        // queda excluido del UPDATE bajo cualquier circunstancia — es
        // exclusivo del bot de GHL y del webhook de agendamiento de ahí en más.
        const updatePayload: Record<string, unknown> = {
          referido_nombre: form.referido_nombre.trim(),
          presentado_por: form.presentado_por.trim(),
          referido_telefono: form.referido_telefono.trim() || null,
          perfil_referido: form.perfil_referido.trim() || null,
          warm_intro: form.warm_intro,
          incentivo: form.incentivo || null,
        }
        if (editingReferido.estado === 'pendiente_datos' || editingReferido.estado === 'pendiente_contacto') {
          updatePayload.estado = form.referido_telefono.trim() ? 'pendiente_contacto' : 'pendiente_datos'
        }
        const { error } = await supabase
          .from('referidos')
          .update(updatePayload)
          .eq('id', editingReferido.id)
        if (error) throw error
      } else {
        const estado = form.referido_telefono.trim() ? 'pendiente_contacto' : 'pendiente_datos'
        const { error } = await supabase.from('referidos').insert({
          client_id: clientId,
          referido_nombre: form.referido_nombre.trim(),
          presentado_por: form.presentado_por.trim(),
          referido_telefono: form.referido_telefono.trim() || null,
          perfil_referido: form.perfil_referido.trim() || null,
          warm_intro: form.warm_intro,
          incentivo: form.incentivo || null,
          origen_call_id: null,
          estado,
          fecha_pedido: new Date().toISOString().slice(0, 10),
        })
        if (error) throw error
      }
      await loadReferidos(clientId)
      setShowModal(false)
    } catch (e) {
      console.error(e)
      setFormError('No se pudo guardar. Probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(r: Referido) {
    setConfirmDeleteId(null)
    if (!clientId) return
    const prev = referidos
    setReferidos((cur) => cur.filter((x) => x.id !== r.id))
    if (expandedId === r.id) setExpandedId(null)
    // client_closer_calls.referido_id -> ON DELETE SET NULL: no borra
    // ninguna llamada/venta real, solo la desvincula de este referido.
    const { error } = await supabase.from('referidos').delete().eq('id', r.id)
    if (error) {
      console.error(error)
      setReferidos(prev)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif' }}>
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
              textTransform: 'uppercase', color: 'var(--accent)',
              background: 'rgba(var(--accent-rgb),0.10)',
              border: '1px solid rgba(var(--accent-rgb),0.22)',
              borderRadius: 99, padding: '5px 14px', marginBottom: 16,
            }}>
              MIS REFERIDOS
            </div>
            <h1 style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800, color: 'var(--text-primary)',
              margin: '0 0 8px',
            }}>
              El funnel de tus referidos
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, margin: 0 }}>
              Cada persona que presentaste, desde que se pidió el referido hasta el cierre.
            </p>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button
              onClick={openNew}
              style={{ padding: '8px 18px', background: 'var(--accent)', color: 'white', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              + Agregar referido
            </button>
          </div>

          {referidos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 16, margin: 0 }}>
                Todavía no generaste referidos.
              </p>
            </div>
          ) : (
            <div style={{
              background: 'rgba(var(--overlay-rgb),0.02)',
              border: '1px solid rgba(var(--overlay-rgb),0.07)',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: GRID_COLUMNS,
                gap: 12,
                padding: '12px 20px',
                background: 'var(--surface-solid)',
                color: 'var(--text-muted)',
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
                <div />
              </div>

              {/* Rows */}
              {referidos.map((r) => {
                const expanded = expandedId === r.id
                const guidance = getEstadoGuidance(r.estado)
                return (
                <div key={r.id}>
                  <div
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: GRID_COLUMNS,
                      gap: 12,
                      padding: '16px 20px',
                      borderTop: '1px solid rgba(var(--overlay-rgb),0.05)',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: expanded ? 'rgba(var(--overlay-rgb),0.02)' : 'transparent',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.referido_nombre}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.presentado_por || '—'}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{r.perfil_referido || '—'}</div>
                    <div><WarmIntroMark value={r.warm_intro} /></div>
                    <div><EstadoBadge estado={r.estado} /></div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{formatDate(r.fecha_pedido)}</div>
                    <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        title="Editar"
                        onClick={() => openEdit(r)}
                        style={{ background: 'rgba(var(--overlay-rgb),0.05)', border: '1px solid rgba(var(--overlay-rgb),0.1)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, padding: '5px 9px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        ✎
                      </button>
                      {confirmDeleteId === r.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button title="Confirmar" onClick={() => handleDelete(r)} style={{ background: 'rgba(var(--success-rgb),0.12)', border: '1px solid rgba(var(--success-rgb),0.3)', borderRadius: 6, color: 'var(--success)', fontSize: 13, padding: '5px 9px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>✓</button>
                          <button title="Cancelar" onClick={() => setConfirmDeleteId(null)} style={{ background: 'rgba(var(--overlay-rgb),0.05)', border: '1px solid rgba(var(--overlay-rgb),0.1)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 13, padding: '5px 9px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>✕</button>
                        </div>
                      ) : (
                        <button
                          title="Eliminar"
                          onClick={() => setConfirmDeleteId(r.id)}
                          style={{ background: 'rgba(var(--accent-rgb),0.10)', border: '1px solid rgba(var(--accent-rgb),0.25)', borderRadius: 6, color: 'var(--accent)', fontSize: 13, padding: '5px 9px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(var(--overlay-rgb),0.05)', background: 'rgba(var(--overlay-rgb),0.015)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 18 }} className="referido-detail-grid">
                        {[
                          { label: 'Teléfono', value: r.referido_telefono || '—' },
                          { label: 'Incentivo', value: INCENTIVO_OPTIONS.find((o) => o.value === r.incentivo)?.label ?? '—' },
                          { label: 'Fecha de contacto', value: formatDateTime(r.fecha_contacto) },
                          { label: 'Fecha de cierre', value: formatDateTime(r.fecha_cierre) },
                        ].map((f) => (
                          <div key={f.label}>
                            <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{f.label}</div>
                            <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{f.value}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginBottom: 18 }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Notas</div>
                        <div style={{ color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5 }}>{r.notas || '—'}</div>
                      </div>

                      <div style={{ background: 'rgba(var(--overlay-rgb),0.02)', border: '1px solid rgba(var(--overlay-rgb),0.07)', borderRadius: 10, padding: '14px 16px' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, margin: guidance.bot ? '0 0 8px' : 0 }}>{guidance.missing}</p>
                        {guidance.bot && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>{guidance.bot}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ReferidoModal
          isEditing={!!editingReferido}
          form={form}
          setForm={setForm}
          saving={saving}
          error={formError}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
