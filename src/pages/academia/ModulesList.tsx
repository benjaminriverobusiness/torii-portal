import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAcademia } from '../../context/AcademiaContext'
import { Spinner } from '../../components/Spinner'
import type { Formacion, AcademyModule, AcademyVideo, FormacionAccess, ModuleAccessRow, VideoProgressRow } from './academiaTypes'

export function ModulesList() {
  const { activeTeamMember, activeTeamMemberId } = useAcademia()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [formaciones, setFormaciones] = useState<Formacion[]>([])
  const [modules, setModules] = useState<AcademyModule[]>([])
  const [formacionAccess, setFormacionAccess] = useState<FormacionAccess[]>([])
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessRow[]>([])
  const [videos, setVideos] = useState<AcademyVideo[]>([])
  const [videoProgress, setVideoProgress] = useState<VideoProgressRow[]>([])

  useEffect(() => {
    if (!activeTeamMemberId) return
    async function load() {
      setLoading(true)
      const schema = supabase.schema('academy')
      const [{ data: forms }, { data: mods }, { data: fa }, { data: ma }, { data: vids }, { data: vp }] = await Promise.all([
        schema.from('formaciones').select('*').order('order_index'),
        schema.from('modules').select('*').order('order_index'),
        schema.from('formacion_access').select('*').eq('team_member_id', activeTeamMemberId as string),
        schema.from('module_access').select('*').eq('team_member_id', activeTeamMemberId as string),
        schema.from('videos').select('id, module_id'),
        schema.from('video_progress').select('video_id, completed').eq('team_member_id', activeTeamMemberId as string),
      ])
      setFormaciones((forms ?? []) as Formacion[])
      setModules((mods ?? []) as AcademyModule[])
      setFormacionAccess((fa ?? []) as FormacionAccess[])
      setModuleAccess((ma ?? []) as ModuleAccessRow[])
      setVideos((vids ?? []) as AcademyVideo[])
      setVideoProgress((vp ?? []) as VideoProgressRow[])
      setLoading(false)
    }
    load()
  }, [activeTeamMemberId])

  if (!activeTeamMemberId) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a8c9e' }}>
        Todavía no tenés miembros de equipo activos. Andá a "Gestionar equipo" para agregar el primero.
      </div>
    )
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
  }

  const isFormacionUnlocked = (id: string) => formacionAccess.some((a) => a.formacion_id === id && a.is_unlocked)
  const isModuleUnlocked = (id: string) => moduleAccess.some((a) => a.module_id === id && a.is_unlocked)
  const getModuleProgress = (moduleId: string) => {
    const moduleVideos = videos.filter((v) => v.module_id === moduleId)
    if (moduleVideos.length === 0) return 0
    const completed = moduleVideos.filter((v) => videoProgress.some((p) => p.video_id === v.id && p.completed)).length
    return Math.round((completed / moduleVideos.length) * 100)
  }

  return (
    <div style={{ paddingBottom: 48 }}>
      <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 28, fontWeight: 800, margin: '0 0 8px' }}>
        Formación de {activeTeamMember?.full_name}
      </h1>
      <p style={{ color: '#8a8c9e', fontSize: 14, margin: '0 0 32px' }}>Formaciones y módulos disponibles.</p>

      {formaciones.length === 0 && (
        <div style={{ color: '#555669', textAlign: 'center', padding: 40 }}>Todavía no hay formaciones cargadas.</div>
      )}

      {formaciones.map((formacion) => {
        const unlocked = isFormacionUnlocked(formacion.id)
        const formModules = modules.filter((m) => m.formacion_id === formacion.id)
        return (
          <div key={formacion.id} style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>{unlocked ? '🔓' : '🔒'}</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{formacion.title}</h2>
              {!unlocked && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#555669', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 99, padding: '2px 10px' }}>
                  Bloqueada
                </span>
              )}
            </div>
            {unlocked ? (
              formModules.length === 0 ? (
                <p style={{ color: '#555669', fontSize: 13, marginLeft: 26 }}>Sin módulos todavía.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                  {formModules.map((mod) => {
                    const modUnlocked = isModuleUnlocked(mod.id)
                    const pct = getModuleProgress(mod.id)
                    return (
                      <div
                        key={mod.id}
                        onClick={() => modUnlocked && navigate(`/portal/academia/modulo/${mod.id}`)}
                        style={{
                          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
                          overflow: 'hidden', cursor: modUnlocked ? 'pointer' : 'default', opacity: modUnlocked ? 1 : 0.55,
                          transition: 'border-color 0.2s',
                        }}
                        onMouseEnter={(e) => { if (modUnlocked) e.currentTarget.style.borderColor = 'rgba(229,24,43,0.3)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
                      >
                        {mod.cover_image_url && (
                          <div style={{ height: 120, overflow: 'hidden' }}>
                            <img src={mod.cover_image_url} alt={mod.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                        <div style={{ padding: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>{mod.title}</span>
                            <span>{modUnlocked ? '🔓' : '🔒'}</span>
                          </div>
                          {mod.description && <p style={{ color: '#8a8c9e', fontSize: 13, margin: '0 0 12px' }}>{mod.description}</p>}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8a8c9e', marginBottom: 4 }}>
                            <span>Progreso</span><span style={{ fontWeight: 700, color: '#f0f1f7' }}>{pct}%</span>
                          </div>
                          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#e5182b', transition: 'width 0.3s' }} />
                          </div>
                          {pct === 100 && <div style={{ marginTop: 8, fontSize: 12, color: '#4ade80', fontWeight: 700 }}>✓ Completado</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              <p style={{ color: '#555669', fontSize: 13, marginLeft: 26 }}>Desbloqueala desde "Gestionar equipo".</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
