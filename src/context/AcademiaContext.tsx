import { createContext, useContext } from 'react'
import type { Client } from '../types'
import type { AcademyTeamMember } from '../pages/academia/academiaTypes'

export interface AcademiaContextValue {
  client: Client
  teamMembers: AcademyTeamMember[]
  activeTeamMemberId: string | null
  setActiveTeamMemberId: (id: string) => void
  activeTeamMember: AcademyTeamMember | null
  reloadTeamMembers: () => Promise<void>
}

export const AcademiaContext = createContext<AcademiaContextValue | null>(null)

export function useAcademia(): AcademiaContextValue {
  const ctx = useContext(AcademiaContext)
  if (!ctx) throw new Error('useAcademia debe usarse dentro de <AcademiaLayout>')
  return ctx
}
