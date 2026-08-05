import { useState, useEffect, useMemo } from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from '../../components/Navbar'
import { Spinner } from '../../components/Spinner'
import { useClient } from '../../hooks/useClient'
import { supabase } from '../../lib/supabase'
import { AcademiaContext } from '../../context/AcademiaContext'
import type { AcademyTeamMember } from './academiaTypes'

function storageKey(clientId: string) {
  return `academia_active_team_member_${clientId}`
}

export function AcademiaLayout() {
  const { client, loading: clientLoading } = useClient()
  const [teamMembers, setTeamMembers] = useState<AcademyTeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [activeTeamMemberId, setActiveTeamMemberIdState] = useState<string | null>(null)

  async function reloadTeamMembers() {
    if (!client) return
    const { data } = await supabase
      .schema('academy')
      .from('team_members')
      .select('*')
      .eq('client_id', client.id)
      .eq('active', true)
      .order('full_name')
    setTeamMembers((data ?? []) as AcademyTeamMember[])
  }

  useEffect(() => {
    if (!client) return
    async function load() {
      await reloadTeamMembers()
      setLoadingTeam(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id])

  // Restaura la selección guardada para este cliente, o auto-selecciona si
  // hay un solo team_member (caso más común: el cliente sin equipo real).
  useEffect(() => {
    if (!client || teamMembers.length === 0) return
    setActiveTeamMemberIdState((prev) => {
      if (prev && teamMembers.some((tm) => tm.id === prev)) return prev
      const saved = localStorage.getItem(storageKey(client.id))
      if (saved && teamMembers.some((tm) => tm.id === saved)) return saved
      return teamMembers[0].id
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, teamMembers])

  function setActiveTeamMemberId(id: string) {
    setActiveTeamMemberIdState(id)
    if (client) localStorage.setItem(storageKey(client.id), id)
  }

  const activeTeamMember = useMemo(
    () => teamMembers.find((tm) => tm.id === activeTeamMemberId) ?? null,
    [teamMembers, activeTeamMemberId],
  )

  if (clientLoading || loadingTeam || !client) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#08090f' }}>
        <Navbar showNav />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 112px)' }}>
          <Spinner size={40} />
        </div>
      </div>
    )
  }

  return (
    <AcademiaContext.Provider
      value={{ client, teamMembers, activeTeamMemberId, setActiveTeamMemberId, activeTeamMember, reloadTeamMembers }}
    >
      <div style={{ minHeight: '100vh', backgroundColor: '#08090f', color: '#f0f1f7', fontFamily: 'DM Sans, sans-serif' }}>
        <Navbar showNav clientName={client.name} />

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 0' }}>
          {/* Selector de vendedor activo — visible en toda la sección Academia */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
              marginBottom: 24, padding: '14px 20px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#8a8c9e', fontSize: 13, fontWeight: 600 }}>Estoy cargando por:</span>
              {teamMembers.length === 0 ? (
                <span style={{ color: '#555669', fontSize: 13 }}>Sin miembros de equipo activos</span>
              ) : (
                <select
                  value={activeTeamMemberId ?? ''}
                  onChange={(e) => setActiveTeamMemberId(e.target.value)}
                  style={{
                    background: '#080910', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                    color: '#f0f1f7', fontSize: 14, fontWeight: 700, padding: '7px 12px',
                    fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                  }}
                >
                  {teamMembers.map((tm) => (
                    <option key={tm.id} value={tm.id}>{tm.full_name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <Outlet />
        </div>
      </div>
    </AcademiaContext.Provider>
  )
}
