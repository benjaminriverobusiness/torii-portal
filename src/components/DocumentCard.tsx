import type { Document } from '../types'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function FileIcon({ type }: { type: string | null }) {
  if (type === 'pdf') {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="6" fill="rgba(229,24,43,0.15)" />
        <path d="M8 7h8l5 5v9a1 1 0 01-1 1H8a1 1 0 01-1-1V8a1 1 0 011-1z" stroke="#e5182b" strokeWidth="1.5" fill="none" />
        <path d="M16 7v5h5" stroke="#e5182b" strokeWidth="1.5" />
        <text x="7" y="20" fontSize="6" fill="#e5182b" fontWeight="700">PDF</text>
      </svg>
    )
  }
  if (type === 'google_doc' || type === 'doc') {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="6" fill="rgba(96,165,250,0.15)" />
        <path d="M8 7h8l5 5v9a1 1 0 01-1 1H8a1 1 0 01-1-1V8a1 1 0 011-1z" stroke="#60a5fa" strokeWidth="1.5" fill="none" />
        <path d="M16 7v5h5" stroke="#60a5fa" strokeWidth="1.5" />
        <path d="M10 15h8M10 18h5" stroke="#60a5fa" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="rgba(255,255,255,0.05)" />
      <path d="M8 7h8l5 5v9a1 1 0 01-1 1H8a1 1 0 01-1-1V8a1 1 0 011-1z" stroke="#555669" strokeWidth="1.5" fill="none" />
      <path d="M16 7v5h5" stroke="#555669" strokeWidth="1.5" />
    </svg>
  )
}

interface DocumentCardProps {
  document: Document
}

export function DocumentCard({ document: doc }: DocumentCardProps) {
  function openDoc() {
    window.open(doc.file_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(229,24,43,0.22)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
      onClick={openDoc}
    >
      <FileIcon type={doc.file_type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 700 }}>{doc.name}</div>
        {doc.description && (
          <div style={{ color: '#8a8c9e', fontSize: 13, marginTop: 2 }}>{doc.description}</div>
        )}
        {doc.upload_date && (
          <div style={{ color: '#555669', fontSize: 12, marginTop: 4 }}>
            {formatDate(doc.upload_date)}
          </div>
        )}
      </div>
      <span style={{ color: '#e5182b', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
        Abrir →
      </span>
    </div>
  )
}
