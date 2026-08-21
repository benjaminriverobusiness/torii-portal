import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ─── Local types ─────────────────────────────────────────────

interface ChatMessageRow {
  id: string
  client_id: string
  sender_type: 'staff' | 'client' | 'system'
  sender_name: string
  sender_user_id: string | null
  texto: string
  related_call_id: string | null
  created_at: string
}

interface CloserCallRow {
  id: string
  lead_name: string | null
  fecha_llamada: string | null
  hora_llamada: string | null
  estado_cita: string | null
  cancelada: boolean
}

// ─── Helpers ─────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Solo estos dos valores de estado_cita mapean a "Confirmada" — el resto
// (new/null/cualquier otro) cae en "Pendiente". cancelada=true siempre gana
// y muestra "Cancelada" sin importar estado_cita. Mismo criterio que
// pillEstado() en torii-hub/TabChatCliente.tsx — replicado acá porque son 2
// repos separados, sin un paquete compartido.
const ESTADO_CONFIRMADO = new Set(['confirmed', 'showed'])

function pillEstado(call: CloserCallRow): { label: string; bg: string; color: string } {
  if (call.cancelada) return { label: 'Cancelada', bg: 'rgba(var(--danger-rgb),0.12)', color: 'var(--danger)' }
  if (call.estado_cita && ESTADO_CONFIRMADO.has(call.estado_cita)) {
    return { label: 'Confirmada', bg: 'rgba(var(--success-rgb),0.12)', color: 'var(--success)' }
  }
  return { label: 'Pendiente', bg: 'rgba(var(--warning-rgb),0.12)', color: 'var(--warning)' }
}

function formatCallDate(call: CloserCallRow): string {
  if (!call.fecha_llamada) return 'Sin fecha'
  const d = new Date(call.fecha_llamada + 'T12:00:00')
  const fecha = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  return call.hora_llamada ? `${fecha} · ${call.hora_llamada}` : fecha
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Hoy'
  if (sameDay(d, yesterday)) return 'Ayer'
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

// ─── Chat bubble ──────────────────────────────────────────────

function ChatBubble({
  msg, isOwn, onDelete,
}: {
  msg: ChatMessageRow
  isOwn: boolean
  onDelete: () => void
}) {
  const isSystem = msg.sender_type === 'system'
  const [hov, setHov] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        flexDirection: isOwn && !isSystem ? 'row-reverse' : 'row',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700,
          backgroundColor: isSystem ? 'rgba(var(--warning-rgb),0.15)' : isOwn ? 'rgba(var(--accent-rgb),0.15)' : 'rgba(var(--overlay-rgb),0.06)',
          color: isSystem ? 'var(--warning)' : isOwn ? 'var(--accent)' : 'var(--text-secondary)',
        }}
      >
        {isSystem ? '🤖' : initials(msg.sender_name)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '75%', alignItems: isOwn && !isSystem ? 'flex-end' : 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{msg.sender_name}</span>
          {isSystem && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: 'rgba(var(--warning-rgb),0.15)', color: 'var(--warning)' }}>
              IA
            </span>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(msg.created_at)}</span>
        </div>

        <div style={{ position: 'relative' }}>
          <div
            style={{
              borderRadius: 16,
              padding: '9px 14px',
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: isSystem
                ? 'rgba(var(--warning-rgb),0.08)'
                : isOwn
                  ? 'linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb),0.8))'
                  : 'rgba(var(--overlay-rgb),0.05)',
              border: isSystem ? '1px solid rgba(var(--warning-rgb),0.25)' : '1px solid transparent',
              color: isSystem ? 'var(--text-primary)' : isOwn ? 'white' : 'var(--text-primary)',
            }}
          >
            {msg.texto}
          </div>

          {isOwn && !isSystem && hov && (
            <button
              onClick={onDelete}
              title="Borrar mensaje"
              style={{
                position: 'absolute', top: '50%', left: -28, transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 14, padding: 4, lineHeight: 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              🗑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function ChatPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [calls, setCalls] = useState<CloserCallRow[]>([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadCalls = useCallback(async (cid: string) => {
    const { data } = await supabase
      .from('client_closer_calls')
      .select('id, lead_name, fecha_llamada, hora_llamada, estado_cita, cancelada')
      .eq('client_id', cid)
      .order('fecha_llamada', { ascending: false, nullsFirst: false })
      .order('hora_llamada', { ascending: false, nullsFirst: false })
      .limit(8)
    setCalls((data ?? []) as CloserCallRow[])
  }, [])

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('profile_id', user!.id)
          .single()
        if (!clientData) return
        const cid = clientData.id as string
        setClientId(cid)

        const [{ data: msgsData }] = await Promise.all([
          supabase
            .from('chat_messages')
            .select('*')
            .eq('client_id', cid)
            .order('created_at', { ascending: true }),
          loadCalls(cid),
        ])
        setMessages((msgsData ?? []) as ChatMessageRow[])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, loadCalls])

  // Realtime: INSERT/DELETE de chat_messages de este cliente. El filtro
  // client_id=eq.<id> scopea la suscripción — aunque RLS ya limita a sus
  // propios mensajes, filtrar acá evita traer eventos de más. El insert
  // propio ya está en pantalla por el optimista de handleSend, así que acá
  // se dedupe por id cuando llegue el evento real.
  useEffect(() => {
    if (!clientId) return

    let channel: RealtimeChannel | null = null
    channel = supabase
      .channel(`chat_messages:${clientId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          const row = payload.new as ChatMessageRow
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
          if (row.sender_type === 'system' && row.related_call_id) {
            loadCalls(clientId)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `client_id=eq.${clientId}` },
        (payload) => {
          const oldRow = payload.old as { id: string }
          setMessages((prev) => prev.filter((m) => m.id !== oldRow.id))
        },
      )
      .subscribe()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [clientId, loadCalls])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const groupedByDay = useMemo(() => {
    const groups: { day: string; items: ChatMessageRow[] }[] = []
    for (const msg of messages) {
      const dayKey = msg.created_at.slice(0, 10)
      const last = groups[groups.length - 1]
      if (last && last.day === dayKey) last.items.push(msg)
      else groups.push({ day: dayKey, items: [msg] })
    }
    return groups
  }, [messages])

  const proximas7dias = useMemo(() => {
    const now = new Date()
    const limite = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return calls.filter((c) => {
      if (!c.fecha_llamada || c.cancelada) return false
      const d = new Date(c.fecha_llamada + 'T12:00:00')
      return d >= now && d <= limite
    }).length
  }, [calls])

  async function handleSend() {
    const trimmed = texto.trim()
    if (!trimmed || !user || !clientId || sending) return
    setSending(true)
    const senderName = profile?.name || user.email || 'Cliente'
    const optimistic: ChatMessageRow = {
      id: `optimistic-${Date.now()}`,
      client_id: clientId,
      sender_type: 'client',
      sender_name: senderName,
      sender_user_id: user.id,
      texto: trimmed,
      related_call_id: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setTexto('')
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({ client_id: clientId, sender_type: 'client', sender_name: senderName, sender_user_id: user.id, texto: trimmed })
        .select('*')
        .single()
      if (error) throw error
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? (data as ChatMessageRow) : m)))
    } catch (e) {
      console.error(e)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(id: string) {
    const prev = messages
    setMessages((cur) => cur.filter((m) => m.id !== id))
    const { error } = await supabase.from('chat_messages').delete().eq('id', id)
    if (error) {
      console.error(error)
      setMessages(prev)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar showNav />

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 112px)' }}>
          <Spinner size={40} />
        </div>
      ) : (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

          {/* Hero */}
          <div className="fade-in visible" style={{ marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', background: 'rgba(var(--accent-rgb),0.10)', border: '1px solid rgba(var(--accent-rgb),0.22)', borderRadius: 99, padding: '5px 14px', marginBottom: 16 }}>
              CHAT
            </div>
            <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Hablá con tu equipo
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, margin: 0 }}>
              Mensajes en tiempo real con el equipo de Torii y tus próximas citas agendadas.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 20, alignItems: 'start' }} className="chat-grid">

            {/* Columna izquierda — chat */}
            <div style={{ height: 640, display: 'flex', flexDirection: 'column', background: 'rgba(var(--overlay-rgb),0.02)', border: '1px solid rgba(var(--overlay-rgb),0.07)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid rgba(var(--overlay-rgb),0.07)', flexShrink: 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                  TO
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Equipo Torii</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                    En tiempo real
                  </div>
                </div>
              </div>

              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {groupedByDay.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', margin: 'auto 0' }}>
                    Todavía no hay mensajes en este chat.
                  </p>
                ) : (
                  groupedByDay.map((group) => (
                    <div key={group.day} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', background: 'rgba(var(--overlay-rgb),0.05)', borderRadius: 99, padding: '2px 12px' }}>
                          {dayLabel(group.day)}
                        </span>
                      </div>
                      {group.items.map((msg) => (
                        <ChatBubble
                          key={msg.id}
                          msg={msg}
                          isOwn={msg.sender_user_id === user?.id}
                          onDelete={() => handleDelete(msg.id)}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: 14, borderTop: '1px solid rgba(var(--overlay-rgb),0.07)', flexShrink: 0 }}>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Escribí un mensaje…"
                  rows={1}
                  style={{
                    flex: 1, resize: 'none', minHeight: 40, maxHeight: 120,
                    background: 'rgba(var(--overlay-rgb),0.04)', border: '1px solid rgba(var(--overlay-rgb),0.1)',
                    borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 14,
                    fontFamily: 'DM Sans, sans-serif', outline: 'none',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!texto.trim() || sending}
                  style={{
                    flexShrink: 0, width: 40, height: 40, borderRadius: 10, border: 'none',
                    background: !texto.trim() || sending ? 'rgba(var(--accent-rgb),0.3)' : 'var(--accent)',
                    color: 'white', cursor: !texto.trim() || sending ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                    <path d="M2 10l15-7-6 15-2.5-6L2 10z" fill="white" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Columna derecha — agenda automática */}
            <div style={{ height: 640, display: 'flex', flexDirection: 'column', background: 'rgba(var(--overlay-rgb),0.02)', border: '1px solid rgba(var(--overlay-rgb),0.07)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(var(--overlay-rgb),0.07)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="var(--text-secondary)" strokeWidth="1.5" /><path d="M3 9h18M8 3v4M16 3v4" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Agenda automática</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', background: 'rgba(var(--overlay-rgb),0.05)', borderRadius: 99, padding: '3px 10px' }}>
                  {proximas7dias} próx. 7 días
                </span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {calls.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', margin: 'auto 0' }}>
                    Sin citas registradas todavía.
                  </p>
                ) : (
                  calls.map((call) => {
                    const pill = pillEstado(call)
                    return (
                      <div
                        key={call.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          borderRadius: 12, border: '1px solid rgba(var(--overlay-rgb),0.07)',
                          background: 'rgba(var(--overlay-rgb),0.02)', padding: 12,
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ marginTop: 2, flexShrink: 0 }}><rect x="3" y="5" width="18" height="16" rx="2" stroke="var(--text-secondary)" strokeWidth="1.5" /><path d="M3 9h18M8 3v4M16 3v4" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {call.lead_name || 'Sin nombre'}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{formatCallDate(call)}</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: pill.bg, color: pill.color, flexShrink: 0 }}>
                          {pill.label}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <style>{`
            @media (max-width: 900px) {
              .chat-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
