import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import type { Client, ClientCloser } from '../types'
import {
  ComposedChart, Bar, Line,
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
  closer?: string
  calificacion?: 'A' | 'B' | 'C'
  segunda_reunion?: boolean
  fecha_segunda_reunion?: string
  resultado_segunda_reunion?: string
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
  closer: string
  calificacion: string
  segunda_reunion: boolean
  fecha_segunda_reunion: string
  resultado_segunda_reunion: string
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
  closer: '',
  calificacion: '',
  segunda_reunion: false,
  fecha_segunda_reunion: '',
  resultado_segunda_reunion: '',
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

function AnalysisVideoCard({ material, onPlay }: { material: SalesMaterial; onPlay: (url: string, title: string) => void }) {
  const [hov, setHov] = useState(false)
  const ytId = getYoutubeId(material.url)
  const isLoom = material.url.includes('loom.com')
  return (
    <div
      style={{ background: 'rgba(255,255,255,0.02)', border: hov ? '1px solid rgba(229,24,43,0.35)' : '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.25s ease' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onPlay(material.url, material.title)}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0d0e17', overflow: 'hidden' }}>
        {ytId ? (
          <img
            src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
            onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s', transform: hov ? 'scale(1.05)' : 'scale(1)' }}
            alt={material.title}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#111220', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="#555669" strokeWidth="1.5"/><polygon points="10,8 17,12 10,16" fill="#555669"/></svg>
            <span style={{ color: '#555669', fontSize: 13 }}>{isLoom ? 'Ver en Loom' : 'Ver video'}</span>
          </div>
        )}
        {/* Play overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hov ? 1 : 0, transition: 'opacity 0.25s' }}>
          <div style={{ width: 52, height: 52, background: '#e5182b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 32px rgba(229,24,43,0.6)', transform: hov ? 'scale(1)' : 'scale(0.8)', transition: 'transform 0.25s' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><polygon points="7,4 17,10 7,16" fill="white"/></svg>
          </div>
        </div>
      </div>
      {/* Content */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f1f7', marginBottom: material.description ? 4 : 0 }}>{material.title}</div>
        {material.description && <div style={{ fontSize: 12, color: '#8a8c9e', lineHeight: 1.5 }}>{material.description}</div>}
      </div>
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
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '960px', background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e5182b', animation: 'glow-pulse 2s ease-in-out infinite' }} />
            <span style={{ color: '#f0f1f7', fontSize: '15px', fontWeight: 700 }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ color: '#555669', fontSize: '22px', cursor: 'pointer', background: 'transparent', border: 'none', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, background: '#000' }}>
          <iframe
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            src={getEmbedUrl(url)}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}

// ─── Lead Modal ───────────────────────────────────────────────

function LeadModal({
  editingLead, form, setForm, saving, onSave, onClose, onDelete, closers,
}: {
  editingLead: CrmLead | null
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  saving: boolean
  onSave: () => void
  onClose: () => void
  onDelete?: () => void
  closers: ClientCloser[]
}) {
  const [showConfirm, setShowConfirm] = useState(false)
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

        <label style={lbl}>Closer</label>
        <select style={{ ...inp, marginBottom: closers.length === 0 ? 4 : 16 }} value={form.closer || ''} onChange={(e) => setForm((f) => ({ ...f, closer: e.target.value }))}>
          <option value="">Sin asignar</option>
          {closers.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        {closers.length === 0 && (
          <p style={{ color: '#555669', fontSize: 12, margin: '0 0 16px' }}>Configurá los closers desde el panel admin.</p>
        )}

        <label style={lbl}>Calificación del lead</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            { val: 'A', label: 'A — Muy calificado', activeColor: '#4ade80', activeBg: 'rgba(74,222,128,0.15)' },
            { val: 'B', label: 'B — Semi calificado', activeColor: '#fcd34d', activeBg: 'rgba(252,211,77,0.15)' },
            { val: 'C', label: 'C — Descalificado', activeColor: '#f87171', activeBg: 'rgba(248,113,113,0.15)' },
          ] as { val: string; label: string; activeColor: string; activeBg: string }[]).map(({ val, label: optLabel, activeColor, activeBg }) => (
            <button
              key={val}
              onClick={() => setForm((f) => ({ ...f, calificacion: f.calificacion === val ? '' : val }))}
              style={{
                padding: '6px 14px', borderRadius: 99, fontSize: 13, cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif', border: 'none',
                ...(form.calificacion === val
                  ? { background: activeBg, color: activeColor, outline: `1px solid ${activeColor}` }
                  : { background: 'transparent', color: '#8a8c9e', outline: '1px solid rgba(255,255,255,0.1)' }),
              }}
            >
              {optLabel}
            </button>
          ))}
        </div>

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

        <Toggle checked={form.segunda_reunion} onChange={(v) => setForm((f) => ({ ...f, segunda_reunion: v }))} label="¿Agendó segunda reunión?" />

        {form.segunda_reunion && (
          <>
            <label style={lbl}>Fecha segunda reunión</label>
            <input style={{ ...inp, colorScheme: 'dark' }} type="date" value={form.fecha_segunda_reunion} onChange={(e) => setForm((f) => ({ ...f, fecha_segunda_reunion: e.target.value }))} />

            <label style={lbl}>Resultado segunda reunión</label>
            <select style={{ ...inp, marginBottom: 16 }} value={form.resultado_segunda_reunion} onChange={(e) => setForm((f) => ({ ...f, resultado_segunda_reunion: e.target.value }))}>
              <option value="">Seleccionar...</option>
              <option value="Cerrado">Cerrado</option>
              <option value="No cerrado">No cerrado</option>
              <option value="Reagendado">Reagendado</option>
              <option value="No asistió">No asistió</option>
              <option value="Pendiente de cerrar">Pendiente de cerrar</option>
            </select>
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
        {showConfirm ? (
          <div style={{ marginTop: 24 }}>
            <p style={{ color: '#f87171', fontSize: 13, margin: '0 0 12px' }}>¿Eliminar esta llamada?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{ padding: '9px 18px', background: '#e5182b', color: 'white', fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}
                onClick={() => { setShowConfirm(false); onDelete?.() }}
              >
                Sí, eliminar
              </button>
              <button
                style={{ padding: '9px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8a8c9e', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}
                onClick={() => setShowConfirm(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
            <div>
              {editingLead && (
                <button
                  style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(248,113,113,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setShowConfirm(true)}
                >
                  Eliminar llamada
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8a8c9e', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={onClose}>
                Cancelar
              </button>
              <button style={{ padding: '10px 24px', background: '#e5182b', color: 'white', fontWeight: 700, borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }} onClick={onSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
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

  const [closers, setClosers] = useState<ClientCloser[]>([])
  const [showCloserChart, setShowCloserChart] = useState(false)

  const [previewMaterial, setPreviewMaterial] = useState<SalesMaterial | null>(null)
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data: clientData } = await supabase.from('clients').select('*').eq('profile_id', user!.id).single()
        if (!clientData) return
        const c = clientData as Client
        setClient(c)

        const [{ data: leadsData }, { data: matsData }, { data: closersData }, { data: configData }] = await Promise.all([
          supabase.from('crm_clientes').select('*').eq('client_id', c.id).order('created_at', { ascending: false }),
          supabase.from('sales_materials').select('*').eq('client_id', c.id).order('order_index', { ascending: true }),
          supabase.from('client_closers').select('*').eq('client_id', c.id).eq('active', true).order('name'),
          supabase.from('client_metrics_config').select('show_closer_chart').eq('client_id', c.id).maybeSingle(),
        ])
        setLeads((leadsData ?? []) as CrmLead[])
        setMaterials((matsData ?? []) as SalesMaterial[])
        setClosers((closersData ?? []) as ClientCloser[])
        setShowCloserChart((configData as { show_closer_chart?: boolean } | null)?.show_closer_chart || false)
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
      closer: lead.closer ?? '',
      calificacion: lead.calificacion ?? '',
      segunda_reunion: lead.segunda_reunion ?? false,
      fecha_segunda_reunion: lead.fecha_segunda_reunion ?? '',
      resultado_segunda_reunion: lead.resultado_segunda_reunion ?? '',
    })
    setShowModal(true)
  }

  async function handleDelete() {
    if (!editingLead) return
    await supabase.from('crm_clientes').delete().eq('id', editingLead.id)
    setLeads((prev) => prev.filter((l) => l.id !== editingLead.id))
    setShowModal(false)
    setEditingLead(null)
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
        closer: form.closer || null,
        calificacion: (form.calificacion as 'A' | 'B' | 'C') || null,
        segunda_reunion: form.segunda_reunion || false,
        fecha_segunda_reunion: form.segunda_reunion ? form.fecha_segunda_reunion || null : null,
        resultado_segunda_reunion: form.segunda_reunion ? form.resultado_segunda_reunion || null : null,
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
  const analysisVideos = materials.filter((m) => m.type === 'analysis_video')

  const salesChartData = (() => {
    const map: Record<string, { mes: string; agendas: number; asistieron: number; calificados: number; cerrados: number }> = {}
    leads.forEach((lead) => {
      const date = new Date((lead.created_at || '').split('T')[0] + 'T12:00:00')
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = date.toLocaleDateString('es', { month: 'short', year: '2-digit' })
      if (!map[key]) map[key] = { mes: label, agendas: 0, asistieron: 0, calificados: 0, cerrados: 0 }
      map[key].agendas++
      if (lead.asistio) map[key].asistieron++
      if (lead.calificado) map[key].calificados++
      if (lead.cerrado) map[key].cerrados++
    })
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, m]) => ({
        mes: m.mes,
        agendas: m.agendas,
        show_rate: m.agendas > 0 ? Math.round(m.asistieron / m.agendas * 100) : 0,
        tasa_calificacion: m.agendas > 0 ? Math.round(m.calificados / m.agendas * 100) : 0,
        close_rate: m.calificados > 0 ? Math.round(m.cerrados / m.calificados * 100) : 0,
      }))
  })()

  const GRID = '2fr 1fr 1fr 1fr 1fr 1fr 1fr 80px'

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

          {/* Section 3 — Gráficos */}
          {leads.length > 0 && (
            <div className="fade-in visible" style={{ marginBottom: 40 }}>
              <div style={{ marginBottom: 20 }}>
                <SectionPill text="GRÁFICOS HISTÓRICOS" />
              </div>

              {/* Gráfico unificado */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 20 }}>Evolución del pipeline</div>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={salesChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} />
                    <YAxis stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} />
                    <Tooltip contentStyle={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f0f1f7', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ color: '#8a8c9e', fontSize: '12px', paddingTop: '12px' }} />
                    <Line type="monotone" dataKey="agendas" stroke="#60a5fa" strokeWidth={2.5} dot={{ fill: '#60a5fa', r: 4, strokeWidth: 2, stroke: '#08090f' }} activeDot={{ r: 6 }} name="Agendas" />
                    <Line type="monotone" dataKey="show_rate" stroke="#f0f1f7" strokeWidth={2} dot={{ fill: '#f0f1f7', r: 3 }} name="Show rate %" />
                    <Line type="monotone" dataKey="tasa_calificacion" stroke="#c9a84c" strokeWidth={2} dot={{ fill: '#c9a84c', r: 3 }} name="Calificación %" />
                    <Line type="monotone" dataKey="close_rate" stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80', r: 3 }} name="Close rate %" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico por closer */}
              {showCloserChart && closers.length > 0 && (() => {
                const closerChartData = (() => {
                  const map: Record<string, { closer: string; agendas: number; cerrados: number; close_rate: number }> = {}
                  leads.filter((l) => l.closer).forEach((lead) => {
                    const key = lead.closer!
                    if (!map[key]) map[key] = { closer: key, agendas: 0, cerrados: 0, close_rate: 0 }
                    map[key].agendas++
                    if (lead.cerrado) map[key].cerrados++
                  })
                  return Object.values(map).map((m) => ({
                    ...m,
                    close_rate: m.agendas > 0 ? Math.round(m.cerrados / m.agendas * 100) : 0,
                  }))
                })()
                if (closerChartData.length === 0) return null
                return (
                  <>
                    <div style={{ marginBottom: 20 }}>
                      <SectionPill text="RENDIMIENTO POR CLOSER" />
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px', marginBottom: 16 }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={closerChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="closer" stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} />
                          <YAxis stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} />
                          <Tooltip contentStyle={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f0f1f7', fontSize: '12px' }} />
                          <Legend wrapperStyle={{ color: '#8a8c9e', fontSize: '12px', paddingTop: '12px' }} />
                          <Bar dataKey="agendas" fill="rgba(96,165,250,0.6)" radius={[3, 3, 0, 0]} name="Agendas" />
                          <Bar dataKey="cerrados" fill="rgba(74,222,128,0.8)" radius={[3, 3, 0, 0]} name="Cerrados" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* Pipeline header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <SectionPill text="PIPELINE" />
            <button style={{ padding: '8px 18px', background: '#e5182b', color: 'white', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={openNew}>
              + Nueva llamada
            </button>
          </div>

          {/* Leads table / cards */}
          {leads.length === 0 ? (
            <div className="fade-in visible" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 12, padding: '60px 20px', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
                <rect x="6" y="10" width="36" height="32" rx="4" stroke="#333" strokeWidth="2"/>
                <path d="M6 20h36" stroke="#333" strokeWidth="2"/>
                <rect x="14" y="6" width="4" height="8" rx="2" fill="#333"/>
                <rect x="30" y="6" width="4" height="8" rx="2" fill="#333"/>
              </svg>
              <p style={{ color: '#8a8c9e', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Aún no hay llamadas registradas.</p>
              <p style={{ color: '#555669', fontSize: 13, margin: 0 }}>Hacé click en '+ Nueva llamada' para empezar.</p>
            </div>
          ) : isMobile ? (
            <div style={{ marginBottom: 12 }}>
              {leads.map((lead) => (
                <div key={lead.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 700 }}>{lead.lead_nombre}</div>
                    <StageBadge etapa={lead.etapa} />
                  </div>
                  {lead.fecha_llamada && (
                    <div style={{ color: '#8a8c9e', fontSize: 13, marginBottom: 10 }}>
                      📅 {formatDate(lead.fecha_llamada)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: lead.asistio ? '#4ade80' : '#f87171' }}>
                      {lead.asistio ? '✓' : '✗'} Asistió
                    </span>
                    <span style={{ fontSize: 12, color: lead.calificado ? '#4ade80' : '#f87171' }}>
                      {lead.calificado ? '✓' : '✗'} Calificado
                    </span>
                    {lead.cerrado
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#071a0f', color: '#4ade80' }}>Cerrado</span>
                      : <span style={{ fontSize: 12, color: '#555669' }}>Pendiente</span>}
                  </div>
                  {lead.recording_url && (
                    <div
                      style={{ fontSize: 13, color: '#c084fc', fontWeight: 600, marginBottom: 10, cursor: 'pointer' }}
                      onClick={() => {
                        if (lead.recording_url!.includes('fathom')) { window.open(lead.recording_url!, '_blank'); return }
                        setPlayingVideo({ url: lead.recording_url!, title: lead.lead_nombre })
                      }}
                    >
                      🎙 Ver grabación →
                    </div>
                  )}
                  <button style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#f0f1f7', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={() => openEdit(lead)}>
                    Ver / Editar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="fade-in visible" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ background: '#0d0e17', display: 'grid', gridTemplateColumns: GRID, padding: '12px 20px', color: '#555669', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {['NOMBRE', 'ETAPA', 'CALIF', 'LLAMADA', 'ASISTIÓ', 'CERRADO', '2DA REUNIÓN', 'ACCIONES'].map((h) => (
                  <div key={h}>{h}</div>
                ))}
              </div>
              {leads.map((lead, i) => (
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
                  <div>
                    {lead.calificacion === 'A' ? (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>A · Muy cal.</span>
                    ) : lead.calificacion === 'B' ? (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: 'rgba(252,211,77,0.15)', color: '#fcd34d' }}>B · Semi</span>
                    ) : lead.calificacion === 'C' ? (
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>C · Desc.</span>
                    ) : (
                      <span style={{ color: '#555669', fontSize: 13 }}>—</span>
                    )}
                  </div>
                  <div style={{ color: '#8a8c9e', fontSize: 13 }}>{formatDate(lead.fecha_llamada)}</div>
                  <div><BoolIcon value={lead.asistio} /></div>
                  <div>
                    {lead.cerrado
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: '#071a0f', color: '#4ade80' }}>Cerrado</span>
                      : <span style={{ color: '#555669', fontSize: 13 }}>Pendiente</span>}
                  </div>
                  <div>
                    {lead.segunda_reunion ? (
                      <div>
                        <span style={{ fontSize: 12, background: 'rgba(192,132,252,0.15)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.3)', borderRadius: '6px', padding: '3px 8px', display: 'inline-block' }}>
                          {lead.fecha_segunda_reunion
                            ? (() => {
                                const d = new Date(lead.fecha_segunda_reunion + 'T12:00:00')
                                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
                              })()
                            : 'Agendada'}
                        </span>
                        {lead.resultado_segunda_reunion && (
                          <div style={{ color: '#8a8c9e', fontSize: 11, marginTop: 3 }}>{lead.resultado_segunda_reunion}</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#555669', fontSize: 13 }}>—</span>
                    )}
                  </div>
                  <div>
                    <button style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#f0f1f7', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={() => openEdit(lead)}>
                      Ver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

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
                    onClick={() => {
                      const url = lead.recording_url!
                      if (url.includes('fathom')) { window.open(url, '_blank'); return }
                      setPlayingVideo({ url, title: lead.lead_nombre })
                    }}
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

              {analysisVideos.length > 0 && (
                <>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#8a8c9e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', marginTop: '24px' }}>
                    Videos de análisis
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }} className="ventas-analysis-grid">
                    {analysisVideos.map((material) => (
                      <AnalysisVideoCard
                        key={material.id}
                        material={material}
                        onPlay={(url, title) => {
                          if (url.includes('fathom')) { window.open(url, '_blank'); return }
                          setPlayingVideo({ url, title })
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
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
          onDelete={handleDelete}
          closers={closers}
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
          .ventas-analysis-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
