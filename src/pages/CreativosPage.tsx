import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import type { Client, ClientCreative } from '../types'

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbedded)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
  return m ? m[1] : null
}

function getDriveId(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

function isDirectImage(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)
}

// ─── Filter pill ──────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: '99px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        border: active ? '1px solid rgba(229,24,43,0.4)' : '1px solid rgba(255,255,255,0.08)',
        background: active ? 'rgba(229,24,43,0.15)' : 'rgba(255,255,255,0.04)',
        color: active ? '#e5182b' : '#555669',
        fontFamily: 'DM Sans, sans-serif',
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </button>
  )
}

// ─── Creative card ────────────────────────────────────────────

const STATUS_STYLES = {
  active:   { bg: 'rgba(74,222,128,0.2)',    color: '#4ade80',  label: 'Activo' },
  paused:   { bg: 'rgba(252,211,77,0.2)',    color: '#fcd34d',  label: 'Pausado' },
  archived: { bg: 'rgba(255,255,255,0.08)',  color: '#555669',  label: 'Archivado' },
}

const TYPE_LABELS: Record<ClientCreative['type'], string> = {
  image: '🖼 Imagen',
  video: '🎬 Video',
  copy:  '✍ Copy',
}

const CHANNEL_STYLES: Record<string, { bg: string; color: string }> = {
  'Meta Ads': { bg: '#1a0c04', color: '#fb923c' },
  'LinkedIn':  { bg: '#071228', color: '#60a5fa' },
  'Ambos':     { bg: '#0f0720', color: '#c084fc' },
}

function CreativeCard({ creative }: { creative: ClientCreative }) {
  const [hovered, setHovered] = useState(false)

  const ytId    = creative.type === 'video' ? getYoutubeId(creative.url) : null
  const driveId = creative.type !== 'copy'  ? getDriveId(creative.url)   : null
  const isImg   = creative.type === 'image' && isDirectImage(creative.url)
  const isDriveImg = creative.type === 'image' && !!driveId && !isImg
  const isLoom  = creative.type === 'video' && creative.url.includes('loom.com')

  const ss = STATUS_STYLES[creative.status]

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: hovered ? '1px solid rgba(229,24,43,0.35)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px',
        overflow: 'hidden',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 8px 32px rgba(229,24,43,0.1)' : 'none',
        transition: 'all 0.25s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Preview ── */}
      <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: '#0d0e17' }}>

        {creative.type === 'image' && (isImg || isDriveImg) ? (
          <img
            src={isDriveImg ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w800` : creative.url}
            alt={creative.title}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
              transition: '0.3s ease',
            }}
          />
        ) : creative.type === 'image' ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="#333" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="#333" />
              <path d="M3 15l5-5 4 4 3-3 6 6" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ color: '#555669', fontSize: 12 }}>Ver imagen</span>
          </div>

        ) : creative.type === 'video' && ytId ? (
          <>
            <img
              src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
              onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s', transform: hovered ? 'scale(1.05)' : 'scale(1)' }}
              alt={creative.title}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hovered ? 1 : 0, transition: 'opacity 0.25s' }}>
              <div style={{ width: 56, height: 56, background: '#e5182b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 32px rgba(229,24,43,0.6)', transform: hovered ? 'scale(1)' : 'scale(0.8)', transition: 'transform 0.25s' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><polygon points="7,4 17,10 7,16" fill="white" /></svg>
              </div>
            </div>
          </>

        ) : creative.type === 'video' ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="4" stroke="#555669" strokeWidth="1.5" />
              <polygon points="10,8 17,12 10,16" fill="#555669" />
            </svg>
            <span style={{ color: '#555669', fontSize: 12 }}>{isLoom ? 'Ver en Loom' : 'Ver video'}</span>
          </div>

        ) : (
          // copy
          <div style={{ position: 'absolute', inset: 0, padding: 20, overflow: 'hidden' }}>
            <p style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: 14, color: '#8a8c9e', lineHeight: 1.6, margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}>
              {creative.notes || creative.url}
            </p>
          </div>
        )}

        {/* Status badge top-left */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: '6px',
          background: ss.bg, color: ss.color,
        }}>
          {ss.label}
        </div>

        {/* Type badge top-right */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px', padding: '3px 8px',
          color: 'white', fontSize: 11, fontWeight: 600,
        }}>
          {TYPE_LABELS[creative.type]}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '16px 20px 20px' }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 6,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>
          {creative.title}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {creative.channel && CHANNEL_STYLES[creative.channel] && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: CHANNEL_STYLES[creative.channel].bg, color: CHANNEL_STYLES[creative.channel].color }}>
              {creative.channel}
            </span>
          )}
          {creative.cpl != null && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#8a8c9e' }}>
              CPL: ${creative.cpl}
            </span>
          )}
          {creative.ctr != null && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#8a8c9e' }}>
              CTR: {creative.ctr}%
            </span>
          )}
        </div>

        {creative.notes && creative.type !== 'copy' && (
          <div style={{
            fontSize: 12, color: '#555669', lineHeight: 1.5, marginBottom: 12,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          } as React.CSSProperties}>
            {creative.notes}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{ color: '#e5182b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onClick={() => window.open(creative.url, '_blank')}
          >
            Ver creativo →
          </span>
          <span style={{ color: '#555669', fontSize: 11 }}>
            {formatDate(creative.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

type TypeFilter   = 'all' | 'image' | 'video' | 'copy'
type StatusFilter = 'all' | 'active' | 'paused' | 'archived'
type ChannelFilter = 'all' | 'Meta Ads' | 'LinkedIn'

export function CreativosPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [creatives, setCreatives] = useState<ClientCreative[]>([])
  const [filterType, setFilterType]       = useState<TypeFilter>('all')
  const [filterStatus, setFilterStatus]   = useState<StatusFilter>('all')
  const [filterChannel, setFilterChannel] = useState<ChannelFilter>('all')

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data: clientData } = await supabase.from('clients').select('*').eq('profile_id', user!.id).single()
        if (!clientData) return
        const client = clientData as Client
        const { data: creativesData } = await supabase
          .from('client_creatives').select('*')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
        setCreatives((creativesData ?? []) as ClientCreative[])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const filtered = creatives.filter((c) => {
    if (filterType !== 'all' && c.type !== filterType) return false
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterChannel !== 'all' && c.channel !== filterChannel) return false
    return true
  })

  function toggleStatus(s: StatusFilter) {
    setFilterStatus((prev) => prev === s ? 'all' : s)
  }

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
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e5182b', background: 'rgba(229,24,43,0.10)', border: '1px solid rgba(229,24,43,0.22)', borderRadius: 99, padding: '5px 14px', marginBottom: 16 }}>
              CREATIVOS
            </div>
            <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: '#f0f1f7', margin: '0 0 8px' }}>
              Biblioteca de creativos
            </h1>
            <p style={{ color: '#8a8c9e', fontSize: 16, margin: 0 }}>
              Todos los creativos de tu campaña en un solo lugar.
            </p>
          </div>

          {creatives.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin: '0 auto 20px', display: 'block' }}>
                <rect x="8" y="16" width="48" height="36" rx="4" stroke="#333" strokeWidth="2" />
                <path d="M8 28h48" stroke="#333" strokeWidth="2" />
                <rect x="20" y="8" width="6" height="10" rx="2" fill="#333" />
                <rect x="38" y="8" width="6" height="10" rx="2" fill="#333" />
              </svg>
              <p style={{ color: '#8a8c9e', fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
                Aún no hay creativos disponibles.
              </p>
              <p style={{ color: '#555669', fontSize: 14, margin: 0 }}>
                El equipo de Torii irá agregando los creativos de tu campaña aquí.
              </p>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32, alignItems: 'center' }}>
                {/* Type */}
                {([['all', 'Todos'], ['image', 'Imagen'], ['video', 'Video'], ['copy', 'Copy']] as [TypeFilter, string][]).map(([v, label]) => (
                  <FilterPill key={v} label={label} active={filterType === v} onClick={() => setFilterType(v)} />
                ))}

                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

                {/* Status */}
                {([['active', 'Activos'], ['paused', 'Pausados'], ['archived', 'Archivados']] as [StatusFilter, string][]).map(([v, label]) => (
                  <FilterPill key={v} label={label} active={filterStatus === v} onClick={() => toggleStatus(v)} />
                ))}

                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

                {/* Channel */}
                {([['all', 'Todos'], ['Meta Ads', 'Meta Ads'], ['LinkedIn', 'LinkedIn']] as [ChannelFilter, string][]).map(([v, label]) => (
                  <FilterPill key={v} label={label} active={filterChannel === v} onClick={() => setFilterChannel(v)} />
                ))}
              </div>

              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
                    <rect x="6" y="6" width="36" height="36" rx="4" stroke="#333" strokeWidth="2" />
                    <line x1="14" y1="24" x2="34" y2="24" stroke="#333" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <p style={{ color: '#8a8c9e', fontSize: 16, margin: 0 }}>
                    No hay creativos en esta categoría.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="creativos-grid">
                  {filtered.map((c) => <CreativeCard key={c.id} creative={c} />)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .creativos-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .creativos-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
