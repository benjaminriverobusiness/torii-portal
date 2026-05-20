import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import type { Client, ClientVideo, Document } from '../types'

// ─── Helpers ────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function getYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbedded)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  )
  return match ? match[1] : null
}

function getDriveEmbedUrl(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  return url
}

// ─── Sub-components ─────────────────────────────────────────

function SectionPill({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: '#e5182b',
        background: 'rgba(229,24,43,0.10)',
        border: '1px solid rgba(229,24,43,0.22)',
        borderRadius: 99,
        padding: '5px 14px',
        marginBottom: 24,
      }}
    >
      {text}
    </div>
  )
}

function VideoCard({ video }: { video: ClientVideo }) {
  const [hovered, setHovered] = useState(false)
  const ytId = getYoutubeId(video.video_url)
  const isLoom = video.video_url.includes('loom.com')

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: hovered ? '1px solid rgba(229,24,43,0.35)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        overflow: 'hidden',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? '0 12px 40px rgba(229,24,43,0.12)' : 'none',
        transition: 'all 0.25s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => window.open(video.video_url, '_blank')}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#0d0e17', overflow: 'hidden' }}>
        {ytId ? (
          <img
            src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
            onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'cover',
              transition: 'transform 0.3s ease',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
            }}
            alt={video.title}
          />
        ) : isLoom ? (
          <div style={{
            position: 'absolute', inset: 0,
            background: '#111220',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="4" stroke="#555669" strokeWidth="1.5" />
              <polygon points="10,8 17,12 10,16" fill="#555669" />
            </svg>
            <span style={{ color: '#555669', fontSize: 13 }}>Ver en Loom</span>
          </div>
        ) : (
          <div style={{
            position: 'absolute', inset: 0, background: '#0d0e17',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <polygon points="5,3 19,12 5,21" fill="#555669" />
            </svg>
          </div>
        )}

        {/* Play overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}>
          <div style={{
            width: 56, height: 56,
            background: '#e5182b',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 32px rgba(229,24,43,0.6)',
            transform: hovered ? 'scale(1)' : 'scale(0.8)',
            transition: 'transform 0.25s ease',
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <polygon points="7,4 17,10 7,16" fill="white" />
            </svg>
          </div>
        </div>

        {/* Date badge */}
        {video.sent_at && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '4px 10px',
            color: 'white', fontSize: 11, fontWeight: 600,
          }}>
            {formatDate(video.sent_at)}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '18px 20px 22px' }}>
        <div style={{
          fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 6,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>
          {video.title}
        </div>
        {video.description && (
          <div style={{
            fontSize: 13, color: '#8a8c9e', lineHeight: 1.5, marginBottom: 14,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          } as React.CSSProperties}>
            {video.description}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <polygon points="2,1 9,5 2,9" fill="#e5182b" />
            </svg>
            <span style={{ color: '#e5182b', fontSize: 13, fontWeight: 600 }}>Ver informe →</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function DocIcon({ fileType }: { fileType: string | null }) {
  if (fileType === 'pdf') {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="2" width="18" height="22" rx="2" stroke="#e5182b" strokeWidth="1.5" />
        <path d="M18 2v6h6" stroke="#e5182b" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="2" y="18" width="20" height="10" rx="2" fill="#e5182b" />
        <text x="12" y="26" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial">PDF</text>
      </svg>
    )
  }
  if (fileType === 'google_doc') {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="2" width="18" height="22" rx="2" stroke="#60a5fa" strokeWidth="1.5" />
        <path d="M18 2v6h6" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="8" y1="14" x2="22" y2="14" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="18" x2="22" y2="18" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="22" x2="16" y2="22" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="2" width="18" height="22" rx="2" stroke="#8a8c9e" strokeWidth="1.5" />
      <path d="M18 2v6h6" stroke="#8a8c9e" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="8" y1="14" x2="22" y2="14" stroke="#8a8c9e" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="18" x2="22" y2="18" stroke="#8a8c9e" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function DocCard({ doc, onPreview }: { doc: Document; onPreview: (d: Document) => void }) {
  const [hovered, setHovered] = useState(false)
  const [btnHovered, setBtnHovered] = useState(false)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.02)',
        border: hovered ? '1px solid rgba(229,24,43,0.3)' : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, marginBottom: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backgroundColor: hovered ? 'rgba(229,24,43,0.04)' : 'rgba(255,255,255,0.02)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPreview(doc)}
    >
      <DocIcon fileType={doc.file_type} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 4 }}>
          {doc.name}
        </div>
        {doc.description && (
          <div style={{ fontSize: 13, color: '#8a8c9e' }}>{doc.description}</div>
        )}
        <div style={{ fontSize: 12, color: '#555669', marginTop: 4 }}>
          {formatDate(doc.upload_date)}
        </div>
      </div>

      <button
        style={{
          padding: '6px 14px',
          background: btnHovered ? 'rgba(229,24,43,0.1)' : 'rgba(255,255,255,0.05)',
          border: btnHovered ? '1px solid rgba(229,24,43,0.3)' : '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          color: btnHovered ? '#e5182b' : '#f0f1f7',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: 'DM Sans, sans-serif',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        onClick={(e) => { e.stopPropagation(); onPreview(doc) }}
      >
        Previsualizar
      </button>
    </div>
  )
}

function PreviewModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 900,
          height: '85vh',
          background: '#0d0e17',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7' }}>{doc.name}</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              style={{
                color: '#e5182b', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', background: 'transparent', border: 'none',
                fontFamily: 'DM Sans, sans-serif',
              }}
              onClick={() => window.open(doc.file_url, '_blank')}
            >
              Abrir en Drive →
            </button>
            <button
              style={{
                color: '#555669', fontSize: 20,
                cursor: 'pointer', background: 'transparent', border: 'none',
                marginLeft: 16, lineHeight: 1,
              }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>
        {/* iframe */}
        <iframe
          src={getDriveEmbedUrl(doc.file_url)}
          allow="autoplay"
          title={doc.name}
          style={{ flex: 1, width: '100%', border: 'none' }}
        />
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────

export function ReportesPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [videos, setVideos] = useState<ClientVideo[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('profile_id', user!.id)
          .single()

        if (!clientData) return

        const client = clientData as Client

        const [{ data: videosData }, { data: docsData }] = await Promise.all([
          supabase
            .from('client_videos')
            .select('*')
            .eq('client_id', client.id)
            .order('sent_at', { ascending: false }),
          supabase
            .from('documents')
            .select('*')
            .eq('client_id', client.id)
            .order('upload_date', { ascending: false }),
        ])

        setVideos((videosData ?? []) as ClientVideo[])
        setDocuments((docsData ?? []) as Document[])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  const hasContent = videos.length > 0 || documents.length > 0

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
          <div style={{ marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#e5182b',
              background: 'rgba(229,24,43,0.10)',
              border: '1px solid rgba(229,24,43,0.22)',
              borderRadius: 99, padding: '5px 14px', marginBottom: 16,
            }}>
              INFORMES Y RECURSOS
            </div>
            <h1 style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800, color: '#f0f1f7',
              margin: '0 0 8px',
              animation: 'fade-up 0.5s ease both',
            }}>
              Tus informes
            </h1>
            <p style={{
              color: '#8a8c9e', fontSize: 16, margin: 0,
              animation: 'fade-up 0.5s ease 0.1s both',
            }}>
              Accedé a todos los informes semanales y documentos de tu programa.
            </p>
          </div>

          {/* Empty state */}
          {!hasContent && (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin: '0 auto 20px', display: 'block' }}>
                <rect x="8" y="16" width="40" height="36" rx="4" stroke="#333" strokeWidth="2" />
                <path d="M8 28h40" stroke="#333" strokeWidth="2" />
                <circle cx="48" cy="48" r="12" fill="#0d0e17" stroke="#333" strokeWidth="2" />
                <path d="M44 48h8M48 44v8" stroke="#333" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p style={{ color: '#8a8c9e', fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
                Aún no hay informes disponibles.
              </p>
              <p style={{ color: '#555669', fontSize: 14, margin: 0 }}>
                El equipo de Torii actualizará esta sección con tus informes semanales.
              </p>
            </div>
          )}

          {/* Videos section */}
          {videos.length > 0 && (
            <div style={{ marginBottom: 48 }}>
              <SectionPill text="INFORMES EN VIDEO" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }} className="reports-video-grid">
                {videos.map((v) => <VideoCard key={v.id} video={v} />)}
              </div>
            </div>
          )}

          {/* Documents section */}
          {documents.length > 0 && (
            <div>
              <SectionPill text="DOCUMENTOS E INFORMES" />
              <div>
                {documents.map((d) => (
                  <DocCard key={d.id} doc={d} onPreview={setPreviewDoc} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview modal */}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      <style>{`
        @media (max-width: 900px) {
          .reports-video-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .reports-video-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
