import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import type { Client } from '../types'
import {
  LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ─── Local types ─────────────────────────────────────────────

interface CrmLead {
  id: string
  client_id: string
  lead_nombre: string
  lead_email?: string
  lead_telefono?: string
  lead_linkedin?: string
  canal?: string
  etapa: string
  fecha_agenda?: string
  fecha_llamada?: string
  asistio?: boolean
  calificado?: boolean
  cerrado?: boolean
  monto?: number
  objeciones?: string
  notas?: string
  next_followup_date?: string
  followup_count?: number
  recording_url?: string
  created_at: string
  updated_at: string
}

interface SalesMaterial {
  id: string
  client_id: string
  title: string
  description?: string
  type: string
  url: string
  order_index: number
  created_at: string
}

interface FormState {
  lead_nombre: string
  lead_email: string
  lead_telefono: string
  etapa: string
  fecha_llamada: string
  asistio: boolean
  calificado: boolean
  cerrado: boolean
  monto: string
  notas: string
  objeciones: string
  recording_url: string
  next_followup_date: string
}

const EMPTY_FORM: FormState = {
  lead_nombre: '',
  lead_email: '',
  lead_telefono: '',
  etapa: 'Agendado',
  fecha_llamada: '',
  asistio: false,
  calificado: false,
  cerrado: false,
  monto: '',
  notas: '',
  objeciones: '',
  recording_url: '',
  next_followup_date: '',
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbedded)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
  return m ? m[1] : null
}

function getDriveEmbedUrl(url: string): string {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url
}

function getEmbedUrl(url: string): string {
  const ytId = getYoutubeId(url)
  if (ytId) return `https://www.youtube.com/embed/${ytId}`
  const loom = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`
  return url
}

// ─── Tiny shared pieces ───────────────────────────────────────

function SectionPill({ text }: { text: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: '#e5182b',
      background: 'rgba(229,24,43,0.10)', border: '1px solid rgba(229,24,43,0.22)',
      borderRadius: 99, padding: '5px 14px',
    }}>
      {text}
    </div>
  )
}

function StageBadge({ etapa }: { etapa: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'Agendado':           { bg: '#071228', color: '#60a5fa' },
    'Llamada realizada':  { bg: '#0f0720', color: '#c084fc' },
    'Seguimiento':        { bg: '#1a1500', color: '#fcd34d' },
    'Cerrado':            { bg: '#071a0f', color: '#4ade80' },
    'No calificado':      { bg: '#1a0707', color: '#f87171' },
  }
  const s = map[etapa] ?? { bg: '#111', color: '#8a8c9e' }
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: s.bg, color: s.color }}>
      {etapa}
    </span>
  )
}

function BoolIcon({ value }: { value: boolean | null | undefined }) {
  if (value === true)  return <span style={{ color: '#4ade80', fontWeight: 700 }}>✓</span>
  if (value === false) return <span style={{ color: '#f87171', fontWeight: 700 }}>✗</span>
  return <span style={{ color: '#555669' }}>—</span>
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, cursor: 'pointer' }} onClick={() => onChange(!checked)}>
      <div style={{ width: 40, height: 22, borderRadius: 11, background: checked ? '#e5182b' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: checked ? 20 : 2, transition: 'left 0.2s' }} />
      </div>
      <span style={{ fontSize: 14, color: '#f0f1f7', userSelect: 'none' }}>{label}</span>
    </div>
  )
}

// ─── Material sub-components ──────────────────────────────────

function MaterialVideoCard({ m }: { m: SalesMaterial }) {
  const [hov, setHov] = useState(false)
  const ytId = getYoutubeId(m.url)
  const isLoom = m.url.includes('loom.com')
  return (
    <div
      style={{ background: 'rgba(255,255,255,0.02)', border: hov ? '1px solid rgba(229,24,43,0.35)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', transform: hov ? 'translateY(-4px)' : 'translateY(0)', boxShadow: hov ? '0 12px 40px rgba(229,24,43,0.12)' : 'none', transition: 'all 0.25s ease', cursor: 'pointer' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => window.open(m.url, '_blank')}
    >
      <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#0d0e17', overflow: 'hidden' }}>
        {ytId ? (
          <img src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
            onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s', transform: hov ? 'scale(1.05)' : 'scale(1)' }} alt={m.title} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#111220', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="#555669" strokeWidth="1.5"/><polygon points="10,8 17,12 10,16" fill="#555669"/></svg>
            <span style={{ color: '#555669', fontSize: 13 }}>{isLoom ? 'Ver en Loom' : 'Ver video'}</span>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hov ? 1 : 0, transition: 'opacity 0.25s' }}>
          <div style={{ width: 56, height: 56, background: '#e5182b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 32px rgba(229,24,43,0.6)', transform: hov ? 'scale(1)' : 'scale(0.8)', transition: 'transform 0.25s' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><polygon points="7,4 17,10 7,16" fill="white"/></svg>
          </div>
        </div>
      </div>
      <div style={{ padding: '18px 20px 22px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 6 }}>{m.title}</div>
        {m.description && <div style={{ fontSize: 13, color: '#8a8c9e', lineHeight: 1.5, marginBottom: 14 }}>{m.description}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polygon points="2,1 9,5 2,9" fill="#e5182b"/></svg>
          <span style={{ color: '#e5182b', fontSize: 13, fontWeight: 600 }}>Ver material →</span>
        </div>
      </div>
    </div>
  )
}

function MaterialDocCard({ m, onPreview }: { m: SalesMaterial; onPreview: (m: SalesMaterial) => void }) {
  const [hov, setHov] = useState(false)
  const [btnHov, setBtnHov] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: hov ? 'rgba(229,24,43,0.04)' : 'rgba(255,255,255,0.02)', border: hov ? '1px solid rgba(229,24,43,0.3)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={() => onPreview(m)}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="2" width="18" height="22" rx="2" stroke="#60a5fa" strokeWidth="1.5"/>
        <path d="M18 2v6h6" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round"/>
        <line x1="8" y1="14" x2="22" y2="14" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="8" y1="18" x2="22" y2="18" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 4 }}>{m.title}</div>
        {m.description && <div style={{ fontSize: 13, color: '#8a8c9e' }}>{m.description}</div>}
      </div>
      <button style={{ padding: '6px 14px', background: btnHov ? 'rgba(229,24,43,0.1)' : 'rgba(255,255,255,0.05)', border: btnHov ? '1px solid rgba(229,24,43,0.3)' : '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: btnHov ? '#e5182b' : '#f0f1f7', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'DM Sans, sans-serif' }}
        onMouseEnter={() => setBtnHov(true)} onMouseLeave={() => setBtnHov(false)}
        onClick={(e) => { e.stopPropagation(); onPreview(m) }}>
        Previsualizar
      </button>
    </div>
  )
}

function LinkCard({ m }: { m: SalesMaterial }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: hov ? '1px solid rgba(229,24,43,0.3)' : '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => window.open(m.url, '_blank')}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="#e5182b" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="#e5182b" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7' }}>{m.title}</div>
        {m.description && <div style={{ fontSize: 13, color: '#8a8c9e', marginTop: 2 }}>{m.description}</div>}
      </div>
      <span style={{ color: '#e5182b', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>Abrir →</span>
    </div>
  )
}

function MaterialPreviewModal({ material, onClose }: { material: SalesMaterial; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 900, height: '85vh', background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7' }}>{material.title}</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button style={{ color: '#e5182b', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: 'DM Sans, sans-serif' }} onClick={() => window.open(material.url, '_blank')}>Abrir en Drive →</button>
            <button style={{ color: '#555669', fontSize: 20, cursor: 'pointer', background: 'transparent', border: 'none', marginLeft: 16, lineHeight: 1 }} onClick={onClose}>✕</button>
          </div>
        </div>
        <iframe src={getDriveEmbedUrl(material.url)} allow="autoplay" title={material.title} style={{ flex: 1, width: '100%', border: 'none' }} />
      </div>
    </div>
  )
}

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const embedUrl = getEmbedUrl(url)
  const canEmbed = embedUrl !== url
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 900, background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7' }}>{title}</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ color: '#c084fc', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Abrir original →</a>
            <button style={{ color: '#555669', fontSize: 20, cursor: 'pointer', background: 'transparent', border: 'none', lineHeight: 1 }} onClick={onClose}>✕</button>
          </div>
        </div>
        {canEmbed ? (
          <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
            <iframe src={embedUrl} allow="autoplay; fullscreen" title={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
          </div>
        ) : (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}><circle cx="12" cy="12" r="9" stroke="#c084fc" strokeWidth="1.8"/><circle cx="12" cy="12" r="4" fill="#c084fc"/></svg>
            <p style={{ color: '#8a8c9e', marginBottom: 20, fontSize: 14 }}>Este video no se puede incrustar en el portal. Abrilo directamente en Fathom.</p>
            <a href={url} target="_blank" rel="noreferrer" style={{ color: '#c084fc', fontWeight: 700, fontSize: 14 }}>Ver grabación en Fathom →</a>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Lead Modal ───────────────────────────────────────────────

function LeadModal({
  editingLead, form, setForm, saving, onSave, onClose,
}: {
  editingLead: CrmLead | null
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  saving: boolean
  onSave: () => void
  onClose: () => void
}) {
  const inp: React.CSSProperties = {
    width: '100%', background: '#080910',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
    padding: '10px 14px', color: '#f0f1f7', fontSize: 14,
    outline: 'none', marginBottom: 16, boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif',
  }
  const lbl: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#8a8c9e',
    marginBottom: 6, display: 'block',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 22, fontWeight: 800, color: '#f0f1f7', margin: 0 }}>
            {editingLead ? 'Editar llamada' : 'Nueva llamada'}
          </h2>
          <button style={{ color: '#555669', fontSize: 20, cursor: 'pointer', background: 'transparent', border: 'none', lineHeight: 1 }} onClick={onClose}>✕</button>
        </div>

        {/* Fields */}
        <label style={lbl}>Nombre del prospecto *</label>
        <input style={inp} type="text" required value={form.lead_nombre} onChange={(e) => setForm((f) => ({ ...f, lead_nombre: e.target.value }))} />

        <label style={lbl}>Email</label>
        <input style={inp} type="email" value={form.lead_email} onChange={(e) => setForm((f) => ({ ...f, lead_email: e.target.value }))} />

        <label style={lbl}>Teléfono</label>
        <input style={inp} type="text" value={form.lead_telefono} onChange={(e) => setForm((f) => ({ ...f, lead_telefono: e.target.value }))} />

        <label style={lbl}>Etapa</label>
        <select style={{ ...inp, marginBottom: 16 }} value={form.etapa} onChange={(e) => setForm((f) => ({ ...f, etapa: e.target.value }))}>
          {['Agendado', 'Llamada realizada', 'Seguimiento', 'Cerrado', 'No calificado'].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        <label style={lbl}>Fecha de llamada</label>
        <input style={{ ...inp, colorScheme: 'dark' }} type="date" value={form.fecha_llamada} onChange={(e) => setForm((f) => ({ ...f, fecha_llamada: e.target.value }))} />

        <Toggle checked={form.asistio} onChange={(v) => setForm((f) => ({ ...f, asistio: v }))} label="Asistió a la llamada" />
        <Toggle checked={form.calificado} onChange={(v) => setForm((f) => ({ ...f, calificado: v }))} label="Calificado" />
        <Toggle checked={form.cerrado} onChange={(v) => setForm((f) => ({ ...f, cerrado: v }))} label="Cerrado" />

        {form.cerrado && (
          <>
            <label style={lbl}>Monto del cierre</label>
            <input style={inp} type="number" placeholder="$0" value={form.monto} onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))} />
          </>
        )}

        <label style={lbl}>Objeciones</label>
        <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={form.objeciones} onChange={(e) => setForm((f) => ({ ...f, objeciones: e.target.value }))} />

        <label style={lbl}>Notas</label>
        <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />

        <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#c084fc" strokeWidth="1.8"/><circle cx="12" cy="12" r="4" fill="#c084fc"/></svg>
          <span style={{ color: '#c084fc' }}>Link de grabación Fathom</span>
        </label>
        <input style={inp} type="text" placeholder="https://fathom.video/..." value={form.recording_url} onChange={(e) => setForm((f) => ({ ...f, recording_url: e.target.value }))} />

        <label style={lbl}>Próximo follow-up</label>
        <input style={{ ...inp, colorScheme: 'dark' }} type="date" value={form.next_followup_date} onChange={(e) => setForm((f) => ({ ...f, next_followup_date: e.target.value }))} />

        {/* Footer */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8a8c9e', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={onClose}>
            Cancelar
          </button>
          <button style={{ padding: '10px 24px', background: '#e5182b', color: 'white', fontWeight: 700, borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }} onClick={onSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function VentasPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [materials, setMaterials] = useState<SalesMaterial[]>([])

  const [showModal, setShowModal] = useState(false)
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [previewMaterial, setPreviewMaterial] = useState<SalesMaterial | null>(null)
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data: clientData } = await supabase.from('clients').select('*').eq('profile_id', user!.id).single()
        if (!clientData) return
        const c = clientData as Client
        setClient(c)

        const [{ data: leadsData }, { data: matsData }] = await Promise.all([
          supabase.from('crm_clientes').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
          supabase.from('sales_materials').select('*').eq('client_id', c.id).order('order_index', { ascending: true }),
        ])
        setLeads((leadsData ?? []) as CrmLead[])
        setMaterials((matsData ?? []) as SalesMaterial[])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  function openNew() {
    setEditingLead(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(lead: CrmLead) {
    setEditingLead(lead)
    setForm({
      lead_nombre: lead.lead_nombre,
      lead_email: lead.lead_email ?? '',
      lead_telefono: lead.lead_telefono ?? '',
      etapa: lead.etapa,
      fecha_llamada: lead.fecha_llamada ?? '',
      asistio: lead.asistio ?? false,
      calificado: lead.calificado ?? false,
      cerrado: lead.cerrado ?? false,
      monto: lead.monto?.toString() ?? '',
      notas: lead.notas ?? '',
      objeciones: lead.objeciones ?? '',
      recording_url: lead.recording_url ?? '',
      next_followup_date: lead.next_followup_date ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!client) return
    setSaving(true)
    try {
      const payload = {
        client_id: client.id,
        lead_nombre: form.lead_nombre,
        lead_email: form.lead_email || null,
        lead_telefono: form.lead_telefono || null,
        etapa: form.etapa,
        fecha_llamada: form.fecha_llamada || null,
        asistio: form.asistio,
        calificado: form.calificado,
        cerrado: form.cerrado,
        monto: form.cerrado && form.monto ? parseFloat(form.monto) : null,
        notas: form.notas || null,
        objeciones: form.objeciones || null,
        recording_url: form.recording_url || null,
        next_followup_date: form.next_followup_date || null,
      }

      if (editingLead) {
        await supabase.from('crm_clientes').update(payload).eq('id', editingLead.id)
      } else {
        await supabase.from('crm_clientes').insert(payload)
      }

      const { data } = await supabase.from('crm_clientes').select('*').eq('client_id', client.id).order('created_at', { ascending: false })
      setLeads((data ?? []) as CrmLead[])
      setShowModal(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // ── Metrics ────────────────────────────────────────────────
  const totalLeads = leads.length
  const totalAsistieron = leads.filter((l) => l.asistio).length
  const totalCerrados = leads.filter((l) => l.cerrado).length
  const showRate = totalLeads > 0 ? Math.round((totalAsistieron / totalLeads) * 100) : 0
  const closeRate = totalAsistieron > 0 ? Math.round((totalCerrados / totalAsistieron) * 100) : 0
  const totalMonto = leads.filter((l) => l.cerrado && l.monto).reduce((s, l) => s + (l.monto ?? 0), 0)

  const showRateColor = showRate >= 60 ? '#4ade80' : showRate >= 40 ? '#fcd34d' : '#f87171'
  const closeRateColor = closeRate >= 25 ? '#4ade80' : closeRate >= 15 ? '#fcd34d' : '#f87171'

  const leadsConGrabacion = leads.filter((l) => l.recording_url)

  const monthlyData = (() => {
    const map = new Map<string, { month: string; llamadas: number; cerrados: number; ingresos: number }>()
    leads.forEach((l) => {
      const dateStr = l.fecha_llamada ?? l.created_at
      const d = new Date(dateStr)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
      if (!map.has(key)) map.set(key, { month: label, llamadas: 0, cerrados: 0, ingresos: 0 })
      const entry = map.get(key)!
      entry.llamadas++
      if (l.cerrado) { entry.cerrados++; entry.ingresos += l.monto ?? 0 }
    })
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({ ...v, close_rate: v.llamadas > 0 ? Math.round((v.cerrados / v.llamadas) * 100) : 0 }))
  })()

  const GRID = '2fr 1fr 1fr 1fr 1fr 1fr 80px'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#08090f', color: '#f0f1f7', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar showNav />

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 112px)' }}>
          <Spinner size={40} />
        </div>
      ) : (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

          {/* Hero */}
          <div className="fade-in visible" style={{ marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e5182b', background: 'rgba(229,24,43,0.10)', border: '1px solid rgba(229,24,43,0.22)', borderRadius: 99, padding: '5px 14px', marginBottom: 16 }}>
              VENTAS
            </div>
            <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: '#f0f1f7', margin: '0 0 8px', animation: 'fade-up 0.5s ease both' }}>
              Tu pipeline de ventas
            </h1>
            <p style={{ color: '#8a8c9e', fontSize: 16, margin: 0, animation: 'fade-up 0.5s ease 0.1s both' }}>
              Registrá tus llamadas, seguí tus cierres y accedé al material de apoyo.
            </p>
          </div>

          {/* Metrics */}
          <div className="fade-in ventas-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'TOTAL LLAMADAS', value: totalLeads, color: '#f0f1f7', sub: null },
              { label: 'SHOW RATE', value: `${showRate}%`, color: showRateColor, sub: null },
              { label: 'TASA DE CIERRE', value: `${closeRate}%`, color: closeRateColor, sub: null },
              { label: 'INGRESOS GENERADOS', value: `$${totalMonto.toLocaleString()}`, color: '#c9a84c', sub: 'de cierres confirmados' },
            ].map((m) => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555669', marginBottom: 8 }}>{m.label}</div>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 36, fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</div>
                {m.sub && <div style={{ fontSize: 13, color: '#555669', marginTop: 6 }}>{m.sub}</div>}
              </div>
            ))}
          </div>

          {/* Section 3 — Gráficos Históricos */}
          {leads.length > 0 && (
            <div className="fade-in visible" style={{ marginBottom: 40 }}>
              <div style={{ marginBottom: 20 }}>
                <SectionPill text="GRÁFICOS HISTÓRICOS" />
              </div>

              {/* Gráfico 1 — Llamadas y cierres */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px 24px 16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 20 }}>Llamadas por mes</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f0f1f7', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ color: '#8a8c9e', fontSize: '12px', paddingTop: '8px' }} />
                    <Line type="monotone" dataKey="llamadas" stroke="#60a5fa" strokeWidth={2.5} dot={{ fill: '#60a5fa', r: 4, strokeWidth: 2, stroke: '#08090f' }} activeDot={{ r: 6, fill: '#60a5fa' }} name="Llamadas" />
                    <Line type="monotone" dataKey="cerrados" stroke="#4ade80" strokeWidth={2.5} dot={{ fill: '#4ade80', r: 4, strokeWidth: 2, stroke: '#08090f' }} activeDot={{ r: 6, fill: '#4ade80' }} name="Cerrados" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico 2 — Tasa de cierre */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px 24px 16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 20 }}>Tasa de cierre %</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f0f1f7', fontSize: '12px' }} formatter={(v) => [`${v}%`, 'Close rate %']} />
                    <ReferenceLine y={25} stroke="rgba(74,222,128,0.5)" strokeDasharray="5 5" label={{ value: 'Objetivo 25%', fill: '#4ade80', fontSize: 10, position: 'insideTopRight' }} />
                    <Line type="monotone" dataKey="close_rate" stroke="#e5182b" strokeWidth={2.5} dot={{ fill: '#e5182b', r: 4, strokeWidth: 2, stroke: '#08090f' }} activeDot={{ r: 6 }} name="Close rate %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico 3 — Ingresos */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px 24px 16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 20 }}>Ingresos generados ($)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
                    <Tooltip contentStyle={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f0f1f7', fontSize: '12px' }} formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Ingresos']} />
                    <Line type="monotone" dataKey="ingresos" stroke="#c9a84c" strokeWidth={2.5} dot={{ fill: '#c9a84c', r: 4, strokeWidth: 2, stroke: '#08090f' }} activeDot={{ r: 6 }} name="Ingresos ($)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Pipeline header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <SectionPill text="PIPELINE" />
            <button style={{ padding: '8px 18px', background: '#e5182b', color: 'white', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={openNew}>
              + Nueva llamada
            </button>
          </div>

          {/* Leads table */}
          <div className="fade-in visible" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
            {/* Table header */}
            <div style={{ background: '#0d0e17', display: 'grid', gridTemplateColumns: GRID, padding: '12px 20px', color: '#555669', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {['NOMBRE', 'ETAPA', 'LLAMADA', 'ASISTIÓ', 'CALIFICADO', 'CERRADO', 'ACCIONES'].map((h) => (
                <div key={h}>{h}</div>
              ))}
            </div>

            {leads.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
                  <rect x="6" y="10" width="36" height="32" rx="4" stroke="#333" strokeWidth="2"/>
                  <path d="M6 20h36" stroke="#333" strokeWidth="2"/>
                  <rect x="14" y="6" width="4" height="8" rx="2" fill="#333"/>
                  <rect x="30" y="6" width="4" height="8" rx="2" fill="#333"/>
                </svg>
                <p style={{ color: '#8a8c9e', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Aún no hay llamadas registradas.</p>
                <p style={{ color: '#555669', fontSize: 13, margin: 0 }}>Hacé click en '+ Nueva llamada' para empezar.</p>
              </div>
            ) : (
              leads.map((lead, i) => (
                <div
                  key={lead.id}
                  style={{ display: 'grid', gridTemplateColumns: GRID, padding: '14px 20px', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? '#08090f' : 'rgba(255,255,255,0.01)', transition: 'background 0.15s ease', cursor: 'default' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#08090f' : 'rgba(255,255,255,0.01)')}
                >
                  <div>
                    <div style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 700 }}>{lead.lead_nombre}</div>
                    {lead.lead_email && <div style={{ color: '#555669', fontSize: 12, marginTop: 2 }}>{lead.lead_email}</div>}
                  </div>
                  <div><StageBadge etapa={lead.etapa} /></div>
                  <div style={{ color: '#8a8c9e', fontSize: 13 }}>{formatDate(lead.fecha_llamada)}</div>
                  <div><BoolIcon value={lead.asistio} /></div>
                  <div><BoolIcon value={lead.calificado} /></div>
                  <div>
                    {lead.cerrado
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: '#071a0f', color: '#4ade80' }}>Cerrado</span>
                      : <span style={{ color: '#555669', fontSize: 13 }}>Pendiente</span>}
                  </div>
                  <div>
                    <button style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#f0f1f7', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={() => openEdit(lead)}>
                      Ver
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Section 5 — Análisis de Llamadas */}
          {leadsConGrabacion.length > 0 && (
            <div className="fade-in visible" style={{ marginBottom: 48, marginTop: 16 }}>
              <div style={{ marginBottom: 20 }}>
                <SectionPill text="ANÁLISIS DE LLAMADAS" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }} className="ventas-recordings-grid">
                {leadsConGrabacion.map((lead) => (
                  <div
                    key={lead.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(192,132,252,0.35)'; e.currentTarget.style.background = 'rgba(192,132,252,0.04)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onClick={() => setPlayingVideo({ url: lead.recording_url!, title: lead.lead_nombre })}
                  >
                    <div style={{ width: 36, height: 36, background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#c084fc" strokeWidth="1.8"/><circle cx="12" cy="12" r="4" fill="#c084fc"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f1f7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.lead_nombre}</div>
                      {lead.fecha_llamada && <div style={{ fontSize: 12, color: '#555669', marginTop: 2 }}>{formatDate(lead.fecha_llamada)}</div>}
                    </div>
                    <span style={{ color: '#c084fc', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>Ver grabación →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materials */}
          {materials.length > 0 && (
            <div className="fade-in visible" style={{ marginTop: 48 }}>
              <div style={{ marginBottom: 24 }}>
                <SectionPill text="MATERIAL DE APOYO" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }} className="ventas-mats-grid">
                {materials.map((m) => {
                  if (m.type === 'video') return <MaterialVideoCard key={m.id} m={m} />
                  if (m.type === 'document') return <MaterialDocCard key={m.id} m={m} onPreview={setPreviewMaterial} />
                  return <LinkCard key={m.id} m={m} />
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <LeadModal
          editingLead={editingLead}
          form={form}
          setForm={setForm}
          saving={saving}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
      {previewMaterial && <MaterialPreviewModal material={previewMaterial} onClose={() => setPreviewMaterial(null)} />}
      {playingVideo && <VideoModal url={playingVideo.url} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />}

      <style>{`
        @media (max-width: 900px) {
          .ventas-metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .ventas-mats-grid { grid-template-columns: 1fr !important; }
          .ventas-charts-grid { grid-template-columns: 1fr !important; }
          .ventas-recordings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
