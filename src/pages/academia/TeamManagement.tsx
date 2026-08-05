import { useEffect, useState, useRef } from 'react'
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

const pill: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#8a8c9e', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 99, padding: '1px 8px',
}

async function uploadAvatar(teamMemberId: string, file: File): Promise<string | null> {
  const filePath = `${teamMemberId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true })
  if (uploadError) { console.error(uploadError); return null }
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
  const { error: updateError } = await supabase.schema('academy').from('team_members').update({ avatar_url: publicUrl }).eq('id', teamMemberId)
  if (updateError) { console.error(updateError); return null }
  return publicUrl
}

function Avatar({ tm, size = 32 }: { tm: AcademyTeamMember; size?: number }) {
  if (tm.avatar_url) {
    return <img src={tm.avatar_url} alt={tm.full_name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  const initial = tm.full_name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, background: 'rgba(229,24,43,0.15)',
      border: '1px solid rgba(229,24,43,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#e5182b', fontSize: size * 0.42, fontWeight: 700,
    }}>
      {initial}
    </div>
  )
}

export function TeamManagement() {
  const { client, teamMembers, reloadTeamMembers } = useAcademia()
  const [loading, setLoading] = useState(true)
  const [formaciones, setFormaciones] = useState<Formacion[]>([])
  const [formacionAccess, setFormacionAccess] = useState<FormacionAccess[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [addingRow, setAddingRow] = useState(false)
  const [newMemberId, setNewMemberId] = useState<string | null>(null)
  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(null)
  const [avatarErrorId, setAvatarErrorId] = useState<string | null>(null)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  async function loadAccessSummary() {
    if (teamMembers.length === 0) {
      setFormaciones([]); setFormacionAccess([])
      return
    }
    const ids = teamMembers.map((tm) => tm.id)
    const schema = supabase.schema('academy')
    const [{ data: f }, { data: fa }] = await Promise.all([
      schema.from('formaciones').select('*').order('order_index'),
      schema.from('formacion_access').select('*').in('team_member_id', ids),
    ])
    setFormaciones((f ?? []) as Formacion[])
    setFormacionAccess((fa ?? []) as FormacionAccess[])
  }

  useEffect(() => {
    async function init() {
      setLoading(true)
      await loadAccessSummary()
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

  async function handleAvatarChange(teamMemberId: string, file: File) {
    setAvatarErrorId(null)
    setUploadingAvatarId(teamMemberId)
    const url = await uploadAvatar(teamMemberId, file)
    setUploadingAvatarId(null)
    if (!url) { setAvatarErrorId(teamMemberId); setTimeout(() => setAvatarErrorId((c) => (c === teamMemberId ? null : c)), 2500); return }
    await reloadTeamMembers()
  }

  const isFormacionUnlocked = (teamMemberId: string, formacionId: string) =>
    formacionAccess.some((a) => a.team_member_id === teamMemberId && a.formacion_id === formacionId && a.is_unlocked)

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
          <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 90px 130px 40px', padding: '10px 16px', background: '#0d0e17', color: '#555669', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <div /><div>Nombre</div><div>Rol</div><div>Estado</div><div>Activo</div><div>Formaciones</div><div />
          </div>
          {teamMembers.map((tm) => {
            const isExpanded = expandedId === tm.id
            const unlockedCount = formaciones.filter((f) => isFormacionUnlocked(tm.id, f.id)).length
            const isUploading = uploadingAvatarId === tm.id
            return (
              <div key={tm.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr 90px 130px 40px', padding: '10px 16px', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : tm.id)}
                >
                  <div
                    onClick={(e) => { e.stopPropagation(); if (!isUploading) fileInputs.current[tm.id]?.click() }}
                    style={{ position: 'relative', cursor: isUploading ? 'default' : 'pointer', width: 32, height: 32 }}
                    title="Cambiar foto"
                  >
                    <Avatar tm={tm} />
                    {isUploading && (
                      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Spinner size={14} />
                      </div>
                    )}
                    {avatarErrorId === tm.id && (
                      <div style={{ position: 'absolute', top: -4, right: -4, color: '#f87171', fontSize: 12, fontWeight: 700 }} title="No se pudo subir la foto">!</div>
                    )}
                    <input
                      ref={(el) => { fileInputs.current[tm.id] = el }}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (file) handleAvatarChange(tm.id, file)
                      }}
                    />
                  </div>
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
                  <span style={{ ...pill, width: 'fit-content' }}>{unlockedCount} formaciones</span>
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
                    <TeamMemberAccessControl teamMemberId={tm.id} onAccessChanged={loadAccessSummary} />
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

// ─── Control de acceso por formación/módulo ─────────────────────────────
// Fetch propio por team_member (se dispara al expandir la fila), separado
// del resumen de la página (que solo necesita el conteo de formaciones
// desbloqueadas para el badge de la fila colapsada).

function TeamMemberAccessControl({
  teamMemberId, onAccessChanged,
}: { teamMemberId: string; onAccessChanged: () => void }) {
  const [loading, setLoading] = useState(true)
  const [formaciones, setFormaciones] = useState<Formacion[]>([])
  const [modules, setModules] = useState<AcademyModule[]>([])
  const [videos, setVideos] = useState<AcademyVideo[]>([])
  const [formacionAccess, setFormacionAccess] = useState<FormacionAccess[]>([])
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessRow[]>([])
  const [videoProgress, setVideoProgress] = useState<VideoProgressRow[]>([])
  const [openFormaciones, setOpenFormaciones] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMemberId])

  async function loadData() {
    setLoading(true)
    const schema = supabase.schema('academy')
    const [{ data: f }, { data: m }, { data: v }, { data: fa }, { data: ma }, { data: vp }] = await Promise.all([
      schema.from('formaciones').select('*').order('order_index'),
      schema.from('modules').select('*').order('order_index'),
      schema.from('videos').select('id, module_id'),
      schema.from('formacion_access').select('*').eq('team_member_id', teamMemberId),
      schema.from('module_access').select('*').eq('team_member_id', teamMemberId),
      schema.from('video_progress').select('team_member_id, video_id, completed').eq('team_member_id', teamMemberId),
    ])
    setFormaciones((f ?? []) as Formacion[])
    setModules((m ?? []) as AcademyModule[])
    setVideos((v ?? []) as AcademyVideo[])
    setFormacionAccess((fa ?? []) as FormacionAccess[])
    setModuleAccess((ma ?? []) as ModuleAccessRow[])
    setVideoProgress((vp ?? []) as VideoProgressRow[])
    setLoading(false)
  }

  async function toggleFormacion(formacionId: string, next: boolean) {
    const schema = supabase.schema('academy')
    const existing = formacionAccess.find((a) => a.formacion_id === formacionId)
    const payload = { is_unlocked: next, unlocked_at: next ? new Date().toISOString() : null }
    if (existing) await schema.from('formacion_access').update(payload).eq('id', existing.id)
    else await schema.from('formacion_access').insert({ formacion_id: formacionId, team_member_id: teamMemberId, ...payload })
    await loadData()
    onAccessChanged()
  }

  async function toggleModule(moduleId: string, next: boolean) {
    const schema = supabase.schema('academy')
    const existing = moduleAccess.find((a) => a.module_id === moduleId)
    const payload = { is_unlocked: next, unlocked_at: next ? new Date().toISOString() : null }
    if (existing) await schema.from('module_access').update(payload).eq('id', existing.id)
    else await schema.from('module_access').insert({ module_id: moduleId, team_member_id: teamMemberId, ...payload })
    await loadData()
  }

  function moduleProgressPct(moduleId: string): number {
    const videoIds = videos.filter((v) => v.module_id === moduleId).map((v) => v.id)
    if (videoIds.length === 0) return 0
    const completed = videoProgress.filter((p) => videoIds.includes(p.video_id) && p.completed).length
    return Math.round((completed / videoIds.length) * 100)
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner size={20} /></div>
  }

  if (formaciones.length === 0) {
    return <p style={{ color: '#555669', fontSize: 13 }}>No hay formaciones cargadas todavía.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {formaciones.map((formacion) => {
        const formacionModules = modules.filter((m) => m.formacion_id === formacion.id)
        const unlocked = formacionAccess.find((a) => a.formacion_id === formacion.id)?.is_unlocked ?? false
        const isOpen = openFormaciones[formacion.id] ?? false
        return (
          <div key={formacion.id} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
              <div
                onClick={() => setOpenFormaciones((p) => ({ ...p, [formacion.id]: !isOpen }))}
                style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer' }}
              >
                <span style={{ color: '#8a8c9e', fontSize: 12 }}>{isOpen ? '▾' : '▸'}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{formacion.title}</span>
              </div>
              <input type="checkbox" checked={unlocked} onChange={(e) => toggleFormacion(formacion.id, e.target.checked)} />
            </div>
            {isOpen && (
              <div style={{ padding: '4px 12px 10px 34px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {formacionModules.length === 0 && <p style={{ color: '#555669', fontSize: 12, margin: 0 }}>Sin módulos.</p>}
                {formacionModules.map((mod) => {
                  const modUnlocked = moduleAccess.find((a) => a.module_id === mod.id)?.is_unlocked ?? false
                  return (
                    <div key={mod.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13 }}>{mod.title}</span>
                        <span style={pill}>{moduleProgressPct(mod.id)}%</span>
                      </div>
                      <input type="checkbox" checked={modUnlocked} onChange={(e) => toggleModule(mod.id, e.target.checked)} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
