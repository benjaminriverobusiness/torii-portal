import type { ClientVideo } from '../types'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

interface VideoCardProps {
  video: ClientVideo
  onPlay?: (url: string, title: string) => void
}

export function VideoCard({ video, onPlay }: VideoCardProps) {
  const isYouTube = video.video_url.includes('youtube.com') || video.video_url.includes('youtu.be')
  const isLoom = video.video_url.includes('loom.com')
  const ytId = isYouTube ? getYouTubeId(video.video_url) : null

  function openVideo() {
    if (onPlay) {
      onPlay(video.video_url, video.title)
    } else {
      window.open(video.video_url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(229,24,43,0.22)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative' }}>
        {ytId ? (
          <img
            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
            alt={video.title}
            style={{
              width: '100%',
              aspectRatio: '16/9',
              objectFit: 'cover',
              display: 'block',
            }}
            onClick={openVideo}
          />
        ) : (
          <div
            style={{
              width: '100%',
              aspectRatio: '16/9',
              backgroundColor: '#0d0e17',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onClick={openVideo}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="20" fill="rgba(229,24,43,0.15)" />
              <path d="M16 13l12 7-12 7V13z" fill="#e5182b" />
            </svg>
            <span style={{ color: '#8a8c9e', fontSize: 13 }}>
              {isLoom ? 'Ver en Loom' : 'Ver video'}
            </span>
          </div>
        )}

        {/* Date badge */}
        {video.sent_at && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 6,
              padding: '3px 8px',
              color: 'white',
              fontSize: 11,
            }}
          >
            {formatDate(video.sent_at)}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px' }}>
        <div
          style={{
            color: '#f0f1f7',
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {video.title}
        </div>
        {video.description && (
          <div
            style={{
              color: '#8a8c9e',
              fontSize: 13,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              marginBottom: 12,
            }}
          >
            {video.description}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
          }}
          onClick={openVideo}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2l8 5-8 5V2z" fill="#e5182b" />
          </svg>
          <span
            style={{
              color: '#e5182b',
              fontSize: 13,
              fontWeight: 600,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Ver video →
          </span>
        </div>
      </div>
    </div>
  )
}
