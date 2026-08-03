import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAcademia } from '../../context/AcademiaContext'
import { Spinner } from '../../components/Spinner'
import { ROLE_LABELS, STATUS_LABELS } from './academiaTypes'
import type {
  AcademyTeamMember, Formacion, AcademyModule, FormacionAccess, ModuleAccessRow, VideoProgressRow, AcademyVideo,
} from './academiaTypes'

const inp: React.CSSProperties = {
  background: '#080910', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  padding: '5px 8px', color: '#f0f1f7', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none',
}

export function TeamManagement() {
  const { client, teamMembers, reloadTeamMembers } = useAcademia()
  const [loading, setLoading] = useState(true)
  const [formaciones, setFormaciones] = useState<Formacion[]>([])
  const [modules, setModules] = useState<AcademyModule[]>([])
  const [formacionAccess, setFormacionAccess] = useState<FormacionAccess[]>([])
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessRow[]>([])
  const [videoProgress, setVideoProgress] = useState<VideoProgressRow[]>([])
  const [videos, setVideos] = useState<AcademyVideo[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [addingRow, setAddingRow] = useState(false)
  const [newMemberId, setNewMemberId] = useState<string | null>(null)

  async function loadAccessData() {
    if (teamMembers.length === 0) {
      setFormacionAccess([]); setModuleAccess([]); setVideoProgress([])
      return
    }
    const ids = teamMembers.map((tm) => tm.id)
    const schema = supabase.schema('academy')
    const [{ data: f }, { data: m }, { data: fa }, { data: ma }, { data: vp }, { data: v }] = await Promise.all([
      schema.from('formaciones').select('*').order('order_index'),
      schema.from('modules').select('*').order('order_index'),
      schema.from('formacion_access').select('*').in('team_member_id', ids),
      schema.from('module_access').select('*').in('team_member_id', ids),
      schema.from('video_progress').select('*').in('team_member_id', ids),
      schema.from('videos').select('id, module_id'),
    ])
    setFormaciones((f ?? []) as Formacion[])
    setModules((m ?? []) as AcademyModule[])
    setFormacionAccess((fa ?? []) as FormacionAccess[])
    setModuleAccess((ma ?? []) as ModuleAccessRow[])
    setVideoProgress((vp ?? []) as VideoProgressRow[])
    setVideos((v ?? []) as AcademyVideo[])
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      await loadAccessData()
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMembers.length])

  async function handleAddRow() {
    if (addingRow) return
    setAddingRow(true)
    const { data, error } = await supabase.schema('academy').from('team_members').insert({
      client_id: client.id, full_name: '', status: 'capacitacion', active: true,
    }).select('*').single()
    setAddingRow(false)
    if (error || !data) { console.error(error); return }
    setNewMemberId((data as AcademyTeamMember).id)
    await reloadTeamMembers()
  }

  async function handleUpdateMember(id: string, patch: Partial<AcademyTeamMember>) {
    await supabase.schema('academy').from('team_members').update(patch).eq('id', id)
    await reloadTeamMembers()
  }

  async function handleDeleteMember(id: string) {
    setConfirmDeleteId(null)
    await supabase.schema('academy').from('team_members').delete().eq('id', id)
    await reloadTeamMembers()
  }

  async function toggleFormacionAccess(teamMemberId: string, formacionId: string, currentlyUnlocked: boolean) {
    const schema = supabase.schema('academy')
    if (currentlyUnlocked) {
      await schema.from('formacion_access').update({ is_unlocked: false }).eq('team_member_id', teamMemberId).eq('formacion_id', formacionId)
    } else {
      await schema.from('formacion_access').upsert({
        team_member_id: teamMemberId, formacion_id: formacionId, is_unlocked: true, unlocked_at: new Date().toISOString(),
      }, { onConflict: 'team_member_id,formacion_id' })
    }
    await loadAccessData()
  }

  async function toggleModuleAccess(teamMemberId: string, moduleId: string, currentlyUnlocked: boolean) {
    const schema = supabase.schema('academy')
    if (currentlyUnlocked) {
      await schema.from('module_access').update({ is_unlocked: false }).eq('team_member_id', teamMemberId).eq('module_id', moduleId)
    } else {
      await schema.from('module_access').upsert({
        team_member_id: teamMemberId, module_id: moduleId, is_unlocked: true, unlocked_at: new Date().toISOString(),
      }, { onConflict: 'team_member_id,module_id' })
    }
    await loadAccessData()
  }

  const isFormacionUnlocked = (teamMemberId: string, formacionId: string) =>
    formacionAccess.some((a) => a.team_member_id === teamMemberId && a.formacion_id === formacionId && a.is_unlocked)
  const isModuleUnlocked = (teamMemberId: string, moduleId: string) =>
    moduleAccess.some((a) => a.team_member_id === teamMemberId && a.module_id === moduleId && a.is_unlocked)
  const getModuleProgress = (teamMemberId: string, moduleId: string) => {
    const moduleVideos = videos.filter((v) => v.module_id === moduleId)
    if (moduleVideos.length === 0) return 0
    const completed = moduleVideos.filter((v) => videoProgress.some((p) => p.team_member_id === teamMemberId && p.video_id === v.id && p.completed)).length
    return Math.round((completed / moduleVideos.length) * 100)
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
  }

  return (
    <div style={{ paddingBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 26, fontWeight: 800, margin: 0 }}>Mi equipo</h1>
        <button
          onClick={handleAddRow}
          disabled={addingRow}
          style={{ padding: '8px 16px', background: '#e5182b', color: 'white', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: addingRow ? 'not-allowed' : 'pointer', opacity: addingRow ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }}
        >
          + Agregar persona
        </button>
      </div>
      <p style={{ color: '#8a8c9e', fontSize: 14, margin: '0 0 28px' }}>
        Cada persona de tu equipo carga su progreso a través de tu sesión — no tiene login propio.
      </p>

      {teamMembers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a8c9e' }}>
          Todavía no agregaste a nadie. Click en "+ Agregar persona" para empezar.
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 90px 130px 40px', padding: '10px 16px', background: '#0d0e17', color: '#555669', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <div>Nombre</div><div>Rol</div><div>Estado</div><div>Activo</div><div>Formaciones</div><div />
          </div>
          {teamMembers.map((tm) => {
            const isExpanded = expandedId === tm.id
            const unlockedCount = formaciones.filter((f) => isFormacionUnlocked(tm.id, f.id)).length
            return (
              <div key={tm.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 90px 130px 40px', padding: '10px 16px', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : tm.id)}
                >
                  <input
                    style={{ ...inp, fontWeight: 700 }}
                    defaultValue={tm.full_name}
                    autoFocus={newMemberId === tm.id}
                    placeholder="Nombre"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      if (newMemberId === tm.id) setNewMemberId(null)
                      const val = e.target.value.trim()
                      if (val && val !== tm.full_name) handleUpdateMember(tm.id, { full_name: val })
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  />
                  <select
                    style={inp}
                    value={tm.role ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateMember(tm.id, { role: (e.target.value || null) as AcademyTeamMember['role'] })}
                  >
                    <option value="">—</option>
                    {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'admin').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select
                    style={inp}
                    value={tm.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateMember(tm.id, { status: e.target.value as AcademyTeamMember['status'] })}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <div onClick={(e) => e.stopPropagation()}>
                    <span
                      onClick={() => handleUpdateMember(tm.id, { active: !tm.active })}
                      style={{ cursor: 'pointer', fontWeight: 700, color: tm.active ? '#4ade80' : '#f87171' }}
                    >
                      {tm.active ? '✓' : '✗'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8a8c9e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99, padding: '3px 10px', width: 'fit-content' }}>
                    {unlockedCount} formaciones
                  </span>
                  <div onClick={(e) => e.stopPropagation()}>
                    {confirmDeleteId === tm.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleDeleteMember(tm.id)} style={{ background: 'transparent', border: 'none', color: '#4ade80', cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'transparent', border: 'none', color: '#8a8c9e', cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(tm.id)} style={{ background: 'transparent', border: 'none', color: '#555669', cursor: 'pointer', fontSize: 14 }}>🗑</button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '16px 20px 20px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#8a8c9e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                      Control de acceso
                    </div>
                    {formaciones.length === 0 && <p style={{ color: '#555669', fontSize: 13 }}>No hay formaciones cargadas todavía.</p>}
                    {formaciones.map((f) => {
                      const fUnlocked = isFormacionUnlocked(tm.id, f.id)
                      const fModules = modules.filter((m) => m.formacion_id === f.id)
                      return (
                        <div key={f.id} style={{ marginBottom: 12 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                            <input type="checkbox" checked={fUnlocked} onChange={() => toggleFormacionAccess(tm.id, f.id, fUnlocked)} />
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{f.title}</span>
                          </label>
                          {fUnlocked && fModules.length > 0 && (
                            <div style={{ marginLeft: 26, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {fModules.map((m) => {
                                const mUnlocked = isModuleUnlocked(tm.id, m.id)
                                return (
                                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={mUnlocked} onChange={() => toggleModuleAccess(tm.id, m.id, mUnlocked)} />
                                    <span style={{ fontSize: 13, color: '#f0f1f7' }}>{m.title}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#8a8c9e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99, padding: '1px 8px' }}>
                                      {getModuleProgress(tm.id, m.id)}%
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
