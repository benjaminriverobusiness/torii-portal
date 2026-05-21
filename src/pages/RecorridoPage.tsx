/*
  NOTA: Ejecutar en Supabase SQL Editor:
  ALTER TABLE client_phases
  ADD COLUMN IF NOT EXISTS video_url text;
*/

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import { JourneyMap } from '../components/JourneyMap'
import { useScrollFade } from '../hooks/useScrollFade'
import type { Client, ClientPhase, ClientPortalStatus } from '../types'

// ─── Helpers ────────────────────────────────────────────────

function getEmbedUrl(url: string): string {
  if (url.includes('youtu')) {
    const match = url.match(
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbedded)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
    )
    if (match) return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`
  }
  if (url.includes('loom.com/share')) {
    return url.replace('/share/', '/embed/')
  }
  return url
}

// ─── PhaseCard ───────────────────────────────────────────────

function PhaseCard({
  phase,
  index,
  isCompleted,
  isActive,
  isFuture,
  days_in_phase,
}: {
  phase: ClientPhase
  index: number
  isCompleted: boolean
  isActive: boolean
  isFuture: boolean
  days_in_phase: number | null | undefined
}) {
  const borderColor = isActive
    ? 'rgba(229,24,43,0.4)'
    : isCompleted
    ? 'rgba(74,222,128,0.2)'
    : 'rgba(255,255,255,0.06)'

  const bgColor = isActive
    ? 'rgba(229,24,43,0.04)'
    : isCompleted
    ? 'rgba(74,222,128,0.03)'
    : 'rgba(255,255,255,0.01)'

  const labelColor = isActive ? '#e5182b' : isCompleted ? '#4ade80' : '#555669'
  const nameColor = isActive || isCompleted ? '#f0f1f7' : '#8a8c9e'
  const descColor = isFuture ? '#555669' : '#8a8c9e'

  return (
    <div
      style={{
        display: 'flex',
        gap: 24,
        padding: '28px 32px',
        borderRadius: 16,
        marginBottom: 12,
        border: `1px solid ${borderColor}`,
        background: bgColor,
        transition: 'all 0.3s ease',
        animation: `fade-up 0.5s ease ${index * 0.08}s both`,
      }}
    >
      {/* Left column — indicator */}
      <div style={{ width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {/* Circle */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            ...(isCompleted
              ? { background: 'rgba(74,222,128,0.15)', border: '2px solid rgba(74,222,128,0.4)' }
              : isActive
              ? {
                  background: '#e5182b',
                  border: 'none',
                  boxShadow: '0 0 24px rgba(229,24,43,0.4)',
                  animation: 'glow-pulse 2s ease-in-out infinite',
                }
              : { background: 'transparent', border: '2px solid rgba(255,255,255,0.1)' }),
          }}
        >
          {isCompleted ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10l4.5 4.5L16 6" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span
              style={{
                color: isActive ? '#08090f' : '#555669',
                fontWeight: 800,
                fontSize: 18,
                fontFamily: 'Bricolage Grotesque, sans-serif',
              }}
            >
              {phase.phase_order}
            </span>
          )}
        </div>

        {/* Status badge */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 99,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            ...(isCompleted
              ? { color: '#4ade80', background: 'rgba(74,222,128,0.1)' }
              : isActive
              ? { color: '#e5182b', background: 'rgba(229,24,43,0.1)' }
              : { color: '#555669', background: 'rgba(255,255,255,0.04)' }),
          }}
        >
          {isCompleted ? 'Completada' : isActive ? 'Activa' : 'Pendiente'}
        </div>
      </div>

      {/* Right column — content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: labelColor, marginBottom: 4 }}>
              Etapa {phase.phase_order}
            </div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 20, fontWeight: 700, color: nameColor }}>
              {phase.phase_name}
            </div>
          </div>

          {isActive && days_in_phase != null && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#e5182b',
                background: 'rgba(229,24,43,0.1)',
                border: '1px solid rgba(229,24,43,0.2)',
                borderRadius: 99,
                padding: '4px 12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                marginLeft: 12,
              }}
            >
              DÍA {days_in_phase} EN ESTA ETAPA
            </div>
          )}
        </div>

        {/* Description */}
        {phase.phase_description && (
          <p style={{ fontSize: 15, color: descColor, lineHeight: 1.7, margin: '0 0 20px', whiteSpace: 'pre-line' }}>
            {phase.phase_description}
          </p>
        )}

        {/* Video embed */}
        {phase.video_url ? (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', marginTop: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px',
              background: 'rgba(229,24,43,0.08)',
              borderBottom: '1px solid rgba(229,24,43,0.15)',
            }}>
              <div className="glow-dot" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#e5182b', boxShadow: '0 0 8px #e5182b' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e5182b' }}>
                VIDEO DE ESTA ETAPA
              </span>
            </div>
            <iframe
              src={getEmbedUrl(phase.video_url)}
              title={`Video: ${phase.phase_name}`}
              allow="autoplay; fullscreen"
              style={{ width: '100%', aspectRatio: '16/9', border: 'none', display: 'block' }}
            />
          </div>
        ) : isActive ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            marginTop: 16,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="3" width="16" height="14" rx="2" stroke="#333" strokeWidth="1.5" />
              <polygon points="8,7 14,10 8,13" fill="#333" />
            </svg>
            <span style={{ color: '#555669', fontSize: 13 }}>
              El video explicativo de esta etapa estará disponible pronto.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────

export function RecorridoPage() {
  const { user } = useAuth()
  useScrollFade()
  const [loading, setLoading] = useState(true)
  const [phases, setPhases] = useState<ClientPhase[]>([])
  const [status, setStatus] = useState<ClientPortalStatus | null>(null)

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

        const [{ data: phasesData }, { data: statusData }] = await Promise.all([
          supabase
            .from('client_phases')
            .select('*')
            .eq('client_id', client.id)
            .order('phase_order', { ascending: true }),
          supabase
            .from('client_portal_status')
            .select('*')
            .eq('client_id', client.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        setPhases((phasesData ?? []) as ClientPhase[])
        setStatus(statusData as ClientPortalStatus | null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  const activeIndex = phases.findIndex((p) => p.id === status?.active_phase_id)

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
          <div className="fade-in" style={{ marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#e5182b',
              background: 'rgba(229,24,43,0.10)',
              border: '1px solid rgba(229,24,43,0.22)',
              borderRadius: 99, padding: '5px 14px', marginBottom: 16,
            }}>
              TU RECORRIDO
            </div>
            <h1 style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800, color: '#f0f1f7',
              margin: '0 0 8px',
              animation: 'fade-up 0.5s ease both',
            }}>
              El camino de tu sistema
            </h1>
            <p style={{
              color: '#8a8c9e', fontSize: 16, margin: 0,
              animation: 'fade-up 0.5s ease 0.1s both',
            }}>
              Cada etapa tiene un objetivo claro. Entendé en qué momento estás y qué viene después.
            </p>
          </div>

          {phases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <p style={{ color: '#8a8c9e', fontSize: 16, margin: 0 }}>
                Las etapas de tu recorrido serán configuradas pronto por el equipo de Torii.
              </p>
            </div>
          ) : (
            <>
              {/* Journey Map overview */}
              <div className="fade-in" style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20,
                padding: '40px 48px 56px',
                marginBottom: 48,
                overflow: 'visible',
              }}>
                <JourneyMap
                  phases={phases}
                  active_phase_id={status?.active_phase_id ?? ''}
                  days_in_phase={status?.days_in_phase ?? 0}
                />
              </div>

              {/* Phase cards */}
              <div style={{ marginBottom: 48 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: '#e5182b',
                  background: 'rgba(229,24,43,0.10)',
                  border: '1px solid rgba(229,24,43,0.22)',
                  borderRadius: 99, padding: '5px 14px', marginBottom: 24,
                }}>
                  DETALLE DE CADA ETAPA
                </div>

                {phases.map((phase, index) => (
                  <div
                    key={phase.id}
                    className="fade-in"
                    style={{ transitionDelay: `${index * 0.08}s` }}
                  >
                    <PhaseCard
                      phase={phase}
                      index={index}
                      isCompleted={activeIndex !== -1 && index < activeIndex}
                      isActive={index === activeIndex}
                      isFuture={activeIndex === -1 ? index > 0 : index > activeIndex}
                      days_in_phase={status?.days_in_phase}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
