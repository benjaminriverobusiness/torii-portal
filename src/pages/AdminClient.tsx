import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import { JourneyMap } from '../components/JourneyMap'
import { KpiCard } from '../components/KpiCard'
import { VideoCard } from '../components/VideoCard'
import { DocumentCard } from '../components/DocumentCard'
import type {
  Client,
  ClientPortalStatus,
  ClientPhase,
  ClientVideo,
  Document,
  RegistroSemanal,
} from '../types'

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function pct(val: number | null | undefined) {
  if (!val) return 0
  return val > 1 ? val : val * 100
}

type Tab = 'preview' | 'phases' | 'update'

export function AdminClient() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('update')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [client, setClient] = useState<Client | null>(null)
  const [status, setStatus] = useState<ClientPortalStatus | null>(null)
  const [phases, setPhases] = useState<ClientPhase[]>([])
  const [videos, setVideos] = useState<ClientVideo[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [registros, setRegistros] = useState<RegistroSemanal[]>([])
  const [history, setHistory] = useState<ClientPortalStatus[]>([])

  // Form state
  const [activePhaseId, setActivePhaseId] = useState('')
  const [daysInPhase, setDaysInPhase] = useState('')
  const [cpbcObj, setCpbcObj] = useState('')
  const [cpbcCurrent, setCpbcCurrent] = useState('')
  const [currentWin, setCurrentWin] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [lastCallDate, setLastCallDate] = useState('')

  // New video form
  const [newVideos, setNewVideos] = useState<Partial<ClientVideo>[]>([])
  // New doc form
  const [newDocs, setNewDocs] = useState<Partial<Document>[]>([])

  // Phase editing
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [editPhaseName, setEditPhaseName] = useState('')
  const [editPhaseDesc, setEditPhaseDesc] = useState('')
  const [addingPhase, setAddingPhase] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [newPhaseDesc, setNewPhaseDesc] = useState('')

  useEffect(() => {
    if (!id) return
    loadAll()
  }, [id])

  async function loadAll() {
    setLoading(true)
    try {
      const [
        clientRes,
        statusRes,
        phasesRes,
        videosRes,
        docsRes,
        registrosRes,
        historyRes,
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase
          .from('client_portal_status')
          .select('*')
          .eq('client_id', id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('client_phases').select('*').eq('client_id', id).order('phase_order'),
        supabase.from('client_videos').select('*').eq('client_id', id).order('sent_at', { ascending: false }),
        supabase.from('documents').select('*').eq('client_id', id).order('upload_date', { ascending: false }),
        supabase.from('registro_semanal_fullfillment').select('*').eq('client_id', id).order('fecha_inicio', { ascending: false }).limit(4),
        supabase.from('client_portal_status').select('*').eq('client_id', id).order('updated_at', { ascending: false }).limit(8),
      ])

      setClient(clientRes.data as Client)
      setPhases((phasesRes.data ?? []) as ClientPhase[])
      setVideos((videosRes.data ?? []) as ClientVideo[])
      setDocuments((docsRes.data ?? []) as Document[])
      setRegistros((registrosRes.data ?? []) as RegistroSemanal[])
      setHistory((historyRes.data ?? []) as ClientPortalStatus[])

      const st = statusRes.data as ClientPortalStatus | null
      setStatus(st)
      if (st) {
        setActivePhaseId(st.active_phase_id ?? '')
        setDaysInPhase(st.days_in_phase?.toString() ?? '')
        setCpbcObj(st.cpbc_objective?.toString() ?? '')
        setCpbcCurrent(st.cpbc_current?.toString() ?? '')
        setCurrentWin(st.current_win ?? '')
        setNextStep(st.next_step ?? '')
        setLastCallDate(st.last_call_date ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!id) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        client_id: id,
        active_phase_id: activePhaseId || null,
        days_in_phase: daysInPhase ? parseInt(daysInPhase) : null,
        cpbc_objective: cpbcObj ? parseFloat(cpbcObj) : null,
        cpbc_current: cpbcCurrent ? parseFloat(cpbcCurrent) : null,
        current_win: currentWin || null,
        next_step: nextStep || null,
        last_call_date: lastCallDate || null,
        updated_at: new Date().toISOString(),
      }

      await supabase.from('client_portal_status').insert(payload)

      // Save new videos
      const validVideos = newVideos.filter((v) => v.title && v.video_url)
      if (validVideos.length > 0) {
        await supabase.from('client_videos').insert(
          validVideos.map((v) => ({ ...v, client_id: id }))
        )
      }

      // Save new docs
      const validDocs = newDocs.filter((d) => d.name && d.file_url)
      if (validDocs.length > 0) {
        await supabase.from('documents').insert(
          validDocs.map((d) => ({ ...d, client_id: id }))
        )
      }

      setNewVideos([])
      setNewDocs([])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  async function deleteVideo(vid: string) {
    await supabase.from('client_videos').delete().eq('id', vid)
    setVideos((prev) => prev.filter((v) => v.id !== vid))
  }

  async function deleteDocument(docId: string) {
    await supabase.from('documents').delete().eq('id', docId)
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
  }

  async function savePhaseEdit(phase: ClientPhase) {
    await supabase
      .from('client_phases')
      .update({ phase_name: editPhaseName, phase_description: editPhaseDesc })
      .eq('id', phase.id)
    setPhases((prev) =>
      prev.map((p) =>
        p.id === phase.id ? { ...p, phase_name: editPhaseName, phase_description: editPhaseDesc } : p
      )
    )
    setEditingPhaseId(null)
  }

  async function deletePhase(phase: ClientPhase) {
    if (phase.id === activePhaseId) {
      setError('No puedes eliminar la etapa activa')
      setTimeout(() => setError(''), 3000)
      return
    }
    await supabase.from('client_phases').delete().eq('id', phase.id)
    setPhases((prev) => prev.filter((p) => p.id !== phase.id))
  }

  async function reorderPhase(phase: ClientPhase, dir: 'up' | 'down') {
    const idx = phases.findIndex((p) => p.id === phase.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= phases.length) return
    const other = phases[swapIdx]
    const newPhases = [...phases]
    newPhases[idx] = { ...phase, phase_order: other.phase_order }
    newPhases[swapIdx] = { ...other, phase_order: phase.phase_order }
    await Promise.all([
      supabase.from('client_phases').update({ phase_order: other.phase_order }).eq('id', phase.id),
      supabase.from('client_phases').update({ phase_order: phase.phase_order }).eq('id', other.id),
    ])
    setPhases(newPhases.sort((a, b) => a.phase_order - b.phase_order))
  }

  async function addPhase() {
    if (!newPhaseName) return
    const maxOrder = phases.length > 0 ? Math.max(...phases.map((p) => p.phase_order)) + 1 : 1
    const { data } = await supabase
      .from('client_phases')
      .insert({ client_id: id, phase_order: maxOrder, phase_name: newPhaseName, phase_description: newPhaseDesc })
      .select()
      .single()
    if (data) setPhases((prev) => [...prev, data as ClientPhase])
    setAddingPhase(false)
    setNewPhaseName('')
    setNewPhaseDesc('')
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

  const sectionTitle: React.CSSProperties = {
    color: '#f0f1f7',
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#08090f' }}>
        <Navbar isAdmin showNav={false} />
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <Spinner size={36} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#08090f' }}>
      <Navbar isAdmin />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
        <Link to="/admin" style={{ color: '#8a8c9e', fontSize: 14, textDecoration: 'none', display: 'block', marginBottom: 24 }}>
          ← Volver
        </Link>

        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: 28,
              color: '#f0f1f7',
              margin: '0 0 4px',
            }}
          >
            {client?.name}
          </h1>
          <p style={{ color: '#555669', fontSize: 14, margin: 0 }}>{client?.email}</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 32 }}>
          {(['preview', 'phases', 'update'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #e5182b' : '2px solid transparent',
                padding: '12px 20px',
                color: tab === t ? '#f0f1f7' : '#555669',
                fontSize: 14,
                fontWeight: tab === t ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                marginBottom: -1,
                transition: 'color 0.2s',
              }}
            >
              {t === 'preview' ? 'Vista previa' : t === 'phases' ? 'Etapas' : 'Actualizar'}
            </button>
          ))}
        </div>

        {/* TAB: PREVIEW */}
        {tab === 'preview' && (
          <div>
            <div
              style={{
                backgroundColor: 'rgba(229,24,43,0.08)',
                borderBottom: '1px solid rgba(229,24,43,0.22)',
                padding: '10px 20px',
                marginBottom: 24,
                borderRadius: 8,
              }}
            >
              <span style={{ color: '#e5182b', fontSize: 13 }}>👁 Vista previa del cliente</span>
            </div>

            {!status ? (
              <p style={{ color: '#555669', textAlign: 'center', padding: 40 }}>
                Sin datos de portal todavía. Ve a "Actualizar" para configurarlo.
              </p>
            ) : (
              <div>
                {/* Hero */}
                <div
                  style={{
                    background: 'radial-gradient(ellipse at 50% 0%, rgba(229,24,43,0.06) 0%, transparent 65%), rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16,
                    padding: 36,
                    marginBottom: 32,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40 }}>
                    <div>
                      <div
                        style={{
                          display: 'inline-flex',
                          textTransform: 'uppercase',
                          fontSize: 11,
                          letterSpacing: '0.1em',
                          color: '#e5182b',
                          backgroundColor: 'rgba(229,24,43,0.10)',
                          border: '1px solid rgba(229,24,43,0.22)',
                          borderRadius: 99,
                          padding: '5px 14px',
                          marginBottom: 16,
                        }}
                      >
                        ETAPA ACTUAL
                      </div>
                      <h2
                        style={{
                          fontFamily: 'Bricolage Grotesque, sans-serif',
                          fontSize: 28,
                          color: '#f0f1f7',
                          margin: '0 0 12px',
                        }}
                      >
                        {phases.find((p) => p.id === status.active_phase_id)?.phase_name ?? 'Sin etapa'}
                      </h2>
                      <p style={{ color: '#8a8c9e', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
                        {phases.find((p) => p.id === status.active_phase_id)?.phase_description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Journey Map */}
                <div
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16,
                    padding: '48px 40px',
                    marginBottom: 32,
                    overflow: 'visible',
                  }}
                >
                  <JourneyMap
                    phases={phases}
                    active_phase_id={status.active_phase_id}
                    days_in_phase={status.days_in_phase}
                  />
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
                  <KpiCard label="AGENDAS" value={registros[0]?.agendas_generadas ?? null} colorLogic="neutral" />
                  <KpiCard label="SHOW RATE" value={pct(registros[0]?.show_rate)} suffix="%" objective={60} colorLogic="showRate" />
                  <KpiCard label="TASA CIERRE" value={pct(registros[0]?.tasa_cierre)} suffix="%" objective={25} colorLogic="closingRate" />
                  <KpiCard label="CPBC" value={status.cpbc_current} prefix="$" objective={status.cpbc_objective} colorLogic="cpbc" />
                </div>

                {/* Win + Next step */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
                  <div style={{ borderLeft: '3px solid #e5182b', borderTop: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', borderRadius: '0 16px 16px 0', backgroundColor: 'rgba(255,255,255,0.03)', padding: 24 }}>
                    <div style={{ color: '#e5182b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>ÚLTIMO RESULTADO</div>
                    <p style={{ color: '#f0f1f7', fontSize: 15, lineHeight: 1.7, margin: 0 }}>{status.current_win ?? '—'}</p>
                  </div>
                  <div style={{ borderLeft: '3px solid #60a5fa', borderTop: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', borderRadius: '0 16px 16px 0', backgroundColor: 'rgba(255,255,255,0.03)', padding: 24 }}>
                    <div style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>PRÓXIMOS 7 DÍAS</div>
                    <p style={{ color: '#f0f1f7', fontSize: 15, lineHeight: 1.7, margin: 0 }}>{status.next_step ?? '—'}</p>
                  </div>
                </div>

                {/* Videos */}
                {videos.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
                      {videos.map((v) => <VideoCard key={v.id} video={v} />)}
                    </div>
                  </div>
                )}

                {/* Docs */}
                {documents.length > 0 && (
                  <div>
                    {documents.map((d) => <DocumentCard key={d.id} document={d} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: PHASES */}
        {tab === 'phases' && (
          <div>
            {error && (
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 16, backgroundColor: 'rgba(248,113,113,0.1)', padding: '10px 16px', borderRadius: 8 }}>
                {error}
              </div>
            )}
            {phases.map((phase, i) => (
              <div
                key={phase.id}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                {editingPhaseId === phase.id ? (
                  <div>
                    <input
                      value={editPhaseName}
                      onChange={(e) => setEditPhaseName(e.target.value)}
                      style={{ ...inputStyle, marginBottom: 10 }}
                    />
                    <textarea
                      value={editPhaseDesc}
                      onChange={(e) => setEditPhaseDesc(e.target.value)}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => savePhaseEdit(phase)}
                        style={{ backgroundColor: '#e5182b', border: 'none', borderRadius: 6, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingPhaseId(null)}
                        style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 16px', color: '#f0f1f7', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(201,168,76,0.15)',
                        border: '1px solid rgba(201,168,76,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#c9a84c',
                        fontWeight: 700,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {phase.phase_order}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{phase.phase_name}</div>
                      <div style={{ color: '#8a8c9e', fontSize: 13, lineHeight: 1.5 }}>{phase.phase_description}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => reorderPhase(phase, 'up')}
                        disabled={i === 0}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6, padding: '4px 8px', color: i === 0 ? '#333' : '#8a8c9e', cursor: i === 0 ? 'default' : 'pointer', fontSize: 12 }}
                      >↑</button>
                      <button
                        onClick={() => reorderPhase(phase, 'down')}
                        disabled={i === phases.length - 1}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6, padding: '4px 8px', color: i === phases.length - 1 ? '#333' : '#8a8c9e', cursor: i === phases.length - 1 ? 'default' : 'pointer', fontSize: 12 }}
                      >↓</button>
                      <button
                        onClick={() => { setEditingPhaseId(phase.id); setEditPhaseName(phase.phase_name); setEditPhaseDesc(phase.phase_description ?? '') }}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6, padding: '4px 10px', color: '#8a8c9e', cursor: 'pointer', fontSize: 12 }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deletePhase(phase)}
                        style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '4px 10px', color: '#f87171', cursor: 'pointer', fontSize: 12 }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addingPhase ? (
              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                <input
                  placeholder="Nombre de la etapa"
                  value={newPhaseName}
                  onChange={(e) => setNewPhaseName(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 10 }}
                />
                <textarea
                  placeholder="Descripción"
                  value={newPhaseDesc}
                  onChange={(e) => setNewPhaseDesc(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={addPhase}
                    style={{ backgroundColor: '#e5182b', border: 'none', borderRadius: 6, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    Guardar etapa
                  </button>
                  <button
                    onClick={() => setAddingPhase(false)}
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 16px', color: '#f0f1f7', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingPhase(true)}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: '2px dashed rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  padding: 16,
                  color: '#555669',
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(229,24,43,0.3)'; e.currentTarget.style.color = '#e5182b' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#555669' }}
              >
                + Agregar etapa
              </button>
            )}
          </div>
        )}

        {/* TAB: UPDATE */}
        {tab === 'update' && (
          <div>
            {success && (
              <div style={{ backgroundColor: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, padding: '12px 20px', color: '#4ade80', fontSize: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                Dashboard actualizado ✓
              </div>
            )}
            {error && (
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 16, backgroundColor: 'rgba(248,113,113,0.1)', padding: '10px 16px', borderRadius: 8 }}>
                {error}
              </div>
            )}

            {/* PROGRESO */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>PROGRESO</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Etapa activa</label>
                  <select
                    value={activePhaseId}
                    onChange={(e) => setActivePhaseId(e.target.value)}
                    style={{ ...inputStyle, backgroundColor: '#0d0e17' }}
                  >
                    <option value="">Sin etapa activa</option>
                    {phases.map((p) => (
                      <option key={p.id} value={p.id}>{p.phase_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Días en esta etapa</label>
                  <input type="number" value={daysInPhase} onChange={(e) => setDaysInPhase(e.target.value)} style={inputStyle} min="0" />
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>KPIs</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>CPBC objetivo (USD)</label>
                  <input type="number" value={cpbcObj} onChange={(e) => setCpbcObj(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>CPBC actual (USD)</label>
                  <input type="number" value={cpbcCurrent} onChange={(e) => setCpbcCurrent(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>

            {/* MENSAJE AL CLIENTE */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>MENSAJE AL CLIENTE</p>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Último resultado</label>
                <textarea
                  value={currentWin}
                  onChange={(e) => setCurrentWin(e.target.value)}
                  rows={4}
                  placeholder="¿Cuál fue el mejor resultado de las últimas 2 semanas?"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Próximos 7 días</label>
                <textarea
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  rows={3}
                  placeholder="Una sola promesa concreta."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </div>

            {/* COMUNICACIÓN */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>COMUNICACIÓN</p>
              <div>
                <label style={labelStyle}>Fecha última call</label>
                <input type="date" value={lastCallDate} onChange={(e) => setLastCallDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            {/* VIDEOS */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>VIDEOS</p>
              {videos.map((v) => (
                <div
                  key={v.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 8 }}
                >
                  <div>
                    <div style={{ color: '#f0f1f7', fontSize: 13, fontWeight: 600 }}>{v.title}</div>
                    <div style={{ color: '#555669', fontSize: 12 }}>{v.video_url}</div>
                  </div>
                  <button
                    onClick={() => deleteVideo(v.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              {newVideos.map((v, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16, marginBottom: 12 }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>Título</label>
                      <input
                        value={v.title ?? ''}
                        onChange={(e) => {
                          const updated = [...newVideos]
                          updated[i] = { ...updated[i], title: e.target.value }
                          setNewVideos(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>URL</label>
                      <input
                        value={v.video_url ?? ''}
                        onChange={(e) => {
                          const updated = [...newVideos]
                          updated[i] = { ...updated[i], video_url: e.target.value }
                          setNewVideos(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Descripción</label>
                      <input
                        value={v.description ?? ''}
                        onChange={(e) => {
                          const updated = [...newVideos]
                          updated[i] = { ...updated[i], description: e.target.value }
                          setNewVideos(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Fecha enviado</label>
                      <input
                        type="date"
                        value={v.sent_at ?? ''}
                        onChange={(e) => {
                          const updated = [...newVideos]
                          updated[i] = { ...updated[i], sent_at: e.target.value }
                          setNewVideos(updated)
                        }}
                        style={{ ...inputStyle, colorScheme: 'dark' }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setNewVideos(newVideos.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12 }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                onClick={() => setNewVideos([...newVideos, {}])}
                style={{
                  backgroundColor: 'transparent',
                  border: '2px dashed rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '10px 16px',
                  color: '#555669',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                + Agregar video
              </button>
            </div>

            {/* DOCUMENTOS */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>DOCUMENTOS</p>
              {documents.map((d) => (
                <div
                  key={d.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 8 }}
                >
                  <div>
                    <div style={{ color: '#f0f1f7', fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ color: '#555669', fontSize: 12 }}>{d.file_url}</div>
                  </div>
                  <button
                    onClick={() => deleteDocument(d.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              {newDocs.map((d, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16, marginBottom: 12 }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>Nombre</label>
                      <input
                        value={d.name ?? ''}
                        onChange={(e) => {
                          const updated = [...newDocs]
                          updated[i] = { ...updated[i], name: e.target.value }
                          setNewDocs(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>URL</label>
                      <input
                        value={d.file_url ?? ''}
                        onChange={(e) => {
                          const updated = [...newDocs]
                          updated[i] = { ...updated[i], file_url: e.target.value }
                          setNewDocs(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Descripción</label>
                      <input
                        value={d.description ?? ''}
                        onChange={(e) => {
                          const updated = [...newDocs]
                          updated[i] = { ...updated[i], description: e.target.value }
                          setNewDocs(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Tipo</label>
                      <select
                        value={d.file_type ?? 'pdf'}
                        onChange={(e) => {
                          const updated = [...newDocs]
                          updated[i] = { ...updated[i], file_type: e.target.value }
                          setNewDocs(updated)
                        }}
                        style={{ ...inputStyle, backgroundColor: '#0d0e17' }}
                      >
                        <option value="pdf">PDF</option>
                        <option value="google_doc">Google Doc</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Fecha</label>
                      <input
                        type="date"
                        value={d.upload_date ?? ''}
                        onChange={(e) => {
                          const updated = [...newDocs]
                          updated[i] = { ...updated[i], upload_date: e.target.value }
                          setNewDocs(updated)
                        }}
                        style={{ ...inputStyle, colorScheme: 'dark' }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setNewDocs(newDocs.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12 }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                onClick={() => setNewDocs([...newDocs, {}])}
                style={{
                  backgroundColor: 'transparent',
                  border: '2px dashed rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '10px 16px',
                  color: '#555669',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                + Agregar documento
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                backgroundColor: saving ? 'rgba(229,24,43,0.5)' : '#e5182b',
                border: 'none',
                borderRadius: 8,
                padding: '14px',
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: 'DM Sans, sans-serif',
                marginBottom: 40,
              }}
            >
              {saving && <Spinner size={18} color="white" />}
              Guardar todo →
            </button>

            {/* History log */}
            {history.length > 0 && (
              <div>
                <p style={sectionTitle}>HISTORIAL</p>
                {history.map((h) => (
                  <div
                    key={h.id}
                    style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}
                  >
                    <span style={{ color: '#555669', fontSize: 12, whiteSpace: 'nowrap', minWidth: 80 }}>
                      {formatDate(h.updated_at)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#8a8c9e', fontSize: 12 }}>
                        CPBC: ${h.cpbc_current ?? '—'} · Fase: {phases.find((p) => p.id === h.active_phase_id)?.phase_name ?? '—'}
                      </span>
                      {h.current_win && (
                        <p style={{ color: '#555669', fontSize: 12, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.current_win.slice(0, 80)}{h.current_win.length > 80 ? '...' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
