import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAcademia } from '../../context/AcademiaContext'
import { Spinner } from '../../components/Spinner'
import type {
  AcademyModule, AcademyVideo, ModuleMaterial, AcademyExam, ExamQuestion, ExamSubmission,
} from './academiaTypes'

type SelectedItem =
  | { kind: 'video'; video: AcademyVideo }
  | { kind: 'material'; material: ModuleMaterial; index: number }

function getEmbedUrl(url: string): string {
  if (url.includes('youtube.com/watch')) {
    try { return `https://www.youtube.com/embed/${new URL(url).searchParams.get('v')}` } catch { return url }
  }
  if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1]}`
  if (url.includes('vimeo.com/')) return `https://player.vimeo.com/video/${url.split('vimeo.com/')[1]}`
  return url
}

function isPdf(mat: ModuleMaterial): boolean {
  return /\.pdf($|\?)/i.test(mat.file_url) || /\.pdf$/i.test(mat.file_name)
}

export function ModuleView() {
  const { moduleId } = useParams()
  const { activeTeamMember, activeTeamMemberId } = useAcademia()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [mod, setMod] = useState<AcademyModule | null>(null)
  const [videos, setVideos] = useState<AcademyVideo[]>([])
  const [videoProgress, setVideoProgress] = useState<Record<string, boolean>>({})
  const [reflection, setReflection] = useState('')
  const [existingReflection, setExistingReflection] = useState<{ content: string; is_reviewed: boolean } | null>(null)
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [materials, setMaterials] = useState<ModuleMaterial[]>([])
  const [exams, setExams] = useState<AcademyExam[]>([])
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([])
  const [examSubmissions, setExamSubmissions] = useState<ExamSubmission[]>([])
  const [currentExamAnswers, setCurrentExamAnswers] = useState<Record<string, string>>({})
  const [previewMaterial, setPreviewMaterial] = useState<ModuleMaterial | null>(null)
  const [savingVideoId, setSavingVideoId] = useState<string | null>(null)
  const [savingReflection, setSavingReflection] = useState(false)
  const [savingExamId, setSavingExamId] = useState<string | null>(null)
  const [examError, setExamError] = useState<string | null>(null)

  useEffect(() => {
    if (!moduleId || !activeTeamMemberId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, activeTeamMemberId])

  async function load() {
    setLoading(true)
    const schema = supabase.schema('academy')
    const [{ data: modData }, { data: vids }, { data: vp }, { data: refl }] = await Promise.all([
      schema.from('modules').select('*').eq('id', moduleId as string).single(),
      schema.from('videos').select('*').eq('module_id', moduleId as string).order('order_index'),
      schema.from('video_progress').select('video_id, completed').eq('team_member_id', activeTeamMemberId as string),
      schema.from('reflection_tasks').select('*').eq('team_member_id', activeTeamMemberId as string).eq('module_id', moduleId as string).maybeSingle(),
    ])

    setMod(modData as AcademyModule | null)
    const videoList = (vids ?? []) as AcademyVideo[]
    setVideos(videoList)

    const videoIds = videoList.map((v) => v.id)
    const orFilter = `module_id.eq.${moduleId},video_id.in.(${videoIds.length ? videoIds.join(',') : '00000000-0000-0000-0000-000000000000'})`
    const [{ data: mats }, { data: exs }, { data: eqs }, { data: subs }] = await Promise.all([
      schema.from('module_materials').select('*').or(orFilter).order('order_index'),
      videoIds.length
        ? schema.from('exams').select('*').in('video_id', videoIds).order('order_index')
        : Promise.resolve({ data: [] as AcademyExam[] }),
      schema.from('exam_questions').select('*'),
      schema.from('exam_submissions').select('*').eq('team_member_id', activeTeamMemberId as string),
    ])
    setMaterials((mats ?? []) as ModuleMaterial[])
    setExams((exs ?? []) as AcademyExam[])
    setExamQuestions((eqs ?? []) as ExamQuestion[])
    setExamSubmissions((subs ?? []) as unknown as ExamSubmission[])

    const prog: Record<string, boolean> = {}
    videoList.forEach((v) => {
      prog[v.id] = (vp ?? []).some((p) => p.video_id === v.id && p.completed)
    })
    setVideoProgress(prog)

    if (refl) {
      setExistingReflection(refl as { content: string; is_reviewed: boolean })
      setReflection((refl as { content: string }).content)
    } else {
      setExistingReflection(null)
      setReflection('')
    }

    setSelected((prev) => {
      if (prev) return prev
      if (videoList.length > 0) return { kind: 'video', video: videoList[0] }
      return null
    })

    setLoading(false)
  }

  async function markComplete(videoId: string) {
    if (!activeTeamMemberId) return
    setSavingVideoId(videoId)
    const { error } = await supabase.schema('academy').from('video_progress').upsert({
      team_member_id: activeTeamMemberId, video_id: videoId, completed: true, completed_at: new Date().toISOString(),
    }, { onConflict: 'team_member_id,video_id' })
    if (!error) setVideoProgress((prev) => ({ ...prev, [videoId]: true }))
    setSavingVideoId(null)
  }

  async function submitReflection() {
    if (!reflection.trim() || !activeTeamMemberId || !moduleId) return
    setSavingReflection(true)
    const { error } = await supabase.schema('academy').from('reflection_tasks').upsert({
      team_member_id: activeTeamMemberId, module_id: moduleId, content: reflection, submitted_at: new Date().toISOString(),
    }, { onConflict: 'team_member_id,module_id' })
    setSavingReflection(false)
    if (!error) await load()
  }

  async function submitExam(examId: string) {
    if (!activeTeamMemberId) return
    setExamError(null)
    const questions = examQuestions.filter((q) => q.exam_id === examId)
    const unanswered = questions.filter((q) => !currentExamAnswers[q.id]?.trim())
    if (unanswered.length > 0) { setExamError(`Faltan ${unanswered.length} respuestas`); return }

    let score = 0
    let autoGradable = true
    questions.forEach((q) => {
      if (q.question_type === 'multiple_choice') {
        if (currentExamAnswers[q.id] === q.correct_answer) score++
      } else {
        autoGradable = false
      }
    })

    setSavingExamId(examId)
    const { error } = await supabase.schema('academy').from('exam_submissions').upsert({
      exam_id: examId, team_member_id: activeTeamMemberId, answers: currentExamAnswers,
      score: autoGradable ? score : null, total_questions: questions.length,
      is_graded: autoGradable, submitted_at: new Date().toISOString(),
    }, { onConflict: 'exam_id,team_member_id' })
    setSavingExamId(null)

    if (!error) {
      setCurrentExamAnswers({})
      await load()
    }
  }

  if (!activeTeamMemberId) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#8a8c9e' }}>Elegí un miembro del equipo arriba para ver este módulo.</div>
  }

  if (loading || !mod) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
  }

  const completedCount = Object.values(videoProgress).filter(Boolean).length
  const progressPct = videos.length > 0 ? Math.round((completedCount / videos.length) * 100) : 0
  const materialsWithoutVideo = materials.filter((m) => !m.video_id)

  const selectedVideoMaterials = selected?.kind === 'video' ? materials.filter((m) => m.video_id === selected.video.id) : []
  const selectedVideoExams = selected?.kind === 'video' ? exams.filter((e) => e.video_id === selected.video.id) : []

  const lbl: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#8a8c9e', marginBottom: 6, display: 'block',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  }
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20,
  }
  const btn: React.CSSProperties = {
    padding: '9px 16px', background: '#e5182b', color: 'white', fontWeight: 700, fontSize: 13, borderRadius: 8,
    border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
  }
  const btnOutline: React.CSSProperties = {
    padding: '7px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#f0f1f7', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
  }

  return (
    <div style={{ paddingBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button onClick={() => navigate('/portal/academia')} style={{ background: 'transparent', border: 'none', color: '#8a8c9e', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>←</button>
        <div>
          <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 24, fontWeight: 800, margin: 0 }}>{mod.title}</h1>
          {mod.description && <p style={{ color: '#8a8c9e', fontSize: 14, margin: '4px 0 0' }}>{mod.description}</p>}
        </div>
      </div>
      <p style={{ color: '#555669', fontSize: 12, margin: '0 0 20px' }}>Cargando el progreso de {activeTeamMember?.full_name}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: '#e5182b', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{progressPct}%</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24 }} className="academia-modview-grid">
        {/* Lista de lecciones */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Lecciones</div>
          {videos.map((video, i) => {
            const isSelected = selected?.kind === 'video' && selected.video.id === video.id
            return (
              <div
                key={video.id}
                onClick={() => { setSelected({ kind: 'video', video }); setCurrentExamAnswers({}); setExamError(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  marginBottom: 6, border: `1px solid ${isSelected ? 'rgba(229,24,43,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  background: isSelected ? 'rgba(229,24,43,0.06)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <span style={{ color: videoProgress[video.id] ? '#4ade80' : '#555669', fontSize: 16 }}>{videoProgress[video.id] ? '✓' : '○'}</span>
                <span style={{ fontSize: 13 }}>{i + 1}. {video.title}</span>
              </div>
            )
          })}
          {materialsWithoutVideo.map((mat, idx) => {
            const isSelected = selected?.kind === 'material' && selected.material.id === mat.id
            return (
              <div
                key={mat.id}
                onClick={() => setSelected({ kind: 'material', material: mat, index: idx })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  marginBottom: 6, border: `1px solid ${isSelected ? 'rgba(229,24,43,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  background: isSelected ? 'rgba(229,24,43,0.06)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <span style={{ color: '#c084fc', fontSize: 15 }}>📄</span>
                <span style={{ fontSize: 13 }}>{videos.length + idx + 1}. {mat.title}</span>
              </div>
            )
          })}
        </div>

        {/* Contenido */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selected ? (
            <div style={{ ...card, textAlign: 'center', color: '#555669', padding: 48 }}>No hay videos en este módulo.</div>
          ) : selected.kind === 'material' ? (
            <>
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000' }}>
                  <iframe
                    src={selected.material.is_downloadable === false ? `${selected.material.file_url}#toolbar=0&navpanes=0` : selected.material.file_url}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                    title={selected.material.title}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{selected.material.title}</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnOutline} onClick={() => setPreviewMaterial(selected.material)}>👁 Previsualizar</button>
                  {selected.material.is_downloadable !== false && (
                    <a href={selected.material.file_url} target="_blank" rel="noopener noreferrer" style={btnOutline}>⬇ Descargar</a>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000' }}>
                  <iframe
                    src={getEmbedUrl(selected.video.video_url)}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{selected.video.title}</h2>
                {!videoProgress[selected.video.id] ? (
                  <button
                    style={{ ...btn, opacity: savingVideoId === selected.video.id ? 0.7 : 1, cursor: savingVideoId === selected.video.id ? 'not-allowed' : 'pointer' }}
                    onClick={() => markComplete(selected.video.id)}
                    disabled={savingVideoId === selected.video.id}
                  >
                    {savingVideoId === selected.video.id ? 'Guardando...' : '✓ Completado'}
                  </button>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 99, padding: '5px 14px' }}>
                    Completado
                  </span>
                )}
              </div>

              {selectedVideoMaterials.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>📄 Material del video</div>
                  {selectedVideoMaterials.map((mat) => (
                    <div key={mat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13 }}>{mat.title}</span>
                        <span style={{ fontSize: 11, color: '#555669' }}>({mat.file_name})</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {isPdf(mat) && <button style={btnOutline} onClick={() => setPreviewMaterial(mat)}>👁 Previsualizar</button>}
                        {mat.is_downloadable !== false && (
                          <a href={mat.file_url} target="_blank" rel="noopener noreferrer" style={btnOutline}>⬇ Descargar</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedVideoExams.map((exam) => {
                const questions = examQuestions.filter((q) => q.exam_id === exam.id)
                const submission = examSubmissions.find((s) => s.exam_id === exam.id)
                return (
                  <div key={exam.id} style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>📋 {exam.title}</div>
                      {submission && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '4px 12px',
                          color: submission.is_graded ? '#4ade80' : '#8a8c9e',
                          background: submission.is_graded ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${submission.is_graded ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        }}>
                          {submission.is_graded ? `${submission.score}/${submission.total_questions}` : 'Pendiente de revisión'}
                        </span>
                      )}
                    </div>

                    {submission ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <p style={{ color: '#8a8c9e', fontSize: 13, margin: 0 }}>Examen enviado.</p>
                        {questions.map((q, i) => {
                          const answer = submission.answers?.[q.id]
                          const isCorrect = q.question_type === 'multiple_choice' && answer === q.correct_answer
                          return (
                            <div key={q.id}>
                              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>{i + 1}. {q.question_text}</p>
                              <p style={{ fontSize: 13, margin: 0, color: q.question_type === 'multiple_choice' ? (isCorrect ? '#4ade80' : '#f87171') : '#8a8c9e' }}>
                                Tu respuesta: {answer || 'Sin respuesta'}
                              </p>
                              {q.question_type === 'multiple_choice' && !isCorrect && (
                                <p style={{ fontSize: 13, margin: 0, color: '#4ade80' }}>Correcta: {q.correct_answer}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {questions.map((q, i) => (
                          <div key={q.id}>
                            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>{i + 1}. {q.question_text}</p>
                            {q.question_type === 'multiple_choice' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {(q.options ?? []).map((opt, j) => (
                                  <label key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#f0f1f7', cursor: 'pointer' }}>
                                    <input
                                      type="radio"
                                      name={`q-${q.id}`}
                                      checked={currentExamAnswers[q.id] === opt}
                                      onChange={() => setCurrentExamAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                    />
                                    {opt}
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <textarea
                                value={currentExamAnswers[q.id] || ''}
                                onChange={(e) => setCurrentExamAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                placeholder="Escribí tu respuesta..."
                                rows={3}
                                style={{ width: '100%', background: '#080910', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#f0f1f7', fontSize: 13, fontFamily: 'DM Sans, sans-serif', resize: 'vertical', boxSizing: 'border-box' }}
                              />
                            )}
                          </div>
                        ))}
                        {examError && <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>{examError}</p>}
                        <button
                          style={{ ...btn, width: '100%', opacity: savingExamId === exam.id ? 0.7 : 1, cursor: savingExamId === exam.id ? 'not-allowed' : 'pointer' }}
                          onClick={() => submitExam(exam.id)}
                          disabled={savingExamId === exam.id}
                        >
                          {savingExamId === exam.id ? 'Enviando...' : 'Enviar examen'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}

          {/* Reflexión del módulo */}
          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Reflexión del módulo</div>
            <label style={lbl}>Tu reflexión</label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="Escribí tu reflexión..."
              rows={5}
              disabled={!!existingReflection?.is_reviewed}
              style={{ width: '100%', background: '#080910', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#f0f1f7', fontSize: 13, fontFamily: 'DM Sans, sans-serif', resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                style={{
                  ...btn,
                  opacity: (!reflection.trim() || existingReflection?.is_reviewed || savingReflection) ? 0.6 : 1,
                  cursor: (!reflection.trim() || existingReflection?.is_reviewed || savingReflection) ? 'not-allowed' : 'pointer',
                }}
                onClick={submitReflection}
                disabled={!reflection.trim() || !!existingReflection?.is_reviewed || savingReflection}
              >
                {savingReflection ? 'Enviando...' : existingReflection ? 'Actualizar' : 'Enviar'}
              </button>
              {existingReflection?.is_reviewed && (
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 99, padding: '4px 12px' }}>Revisada</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {previewMaterial && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setPreviewMaterial(null)}
        >
          <div style={{ width: '100%', maxWidth: 900, height: '85vh', background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{previewMaterial.title}</span>
              <button style={{ color: '#555669', fontSize: 20, cursor: 'pointer', background: 'transparent', border: 'none', lineHeight: 1 }} onClick={() => setPreviewMaterial(null)}>✕</button>
            </div>
            <div
              style={{ flex: 1 }}
              onContextMenu={previewMaterial.is_downloadable === false ? (e) => e.preventDefault() : undefined}
            >
              <iframe
                src={previewMaterial.is_downloadable === false ? `${previewMaterial.file_url}#toolbar=0&navpanes=0` : previewMaterial.file_url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title={previewMaterial.title}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 800px) {
          .academia-modview-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
