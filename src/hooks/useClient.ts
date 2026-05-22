import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type {
  Client,
  ClientPortalStatus,
  ClientPhase,
  RegistroSemanal,
  Document,
  HitosCliente,
  ClientVideo,
  ClientMetrics,
} from '../types'

interface ClientData {
  client: Client | null
  status: ClientPortalStatus | null
  phases: ClientPhase[]
  videos: ClientVideo[]
  documents: Document[]
  registros: RegistroSemanal[]
  hitos: HitosCliente | null
  latestMetrics: ClientMetrics | null
  loading: boolean
  error: string | null
}

export function useClient(): ClientData {
  const { user } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [status, setStatus] = useState<ClientPortalStatus | null>(null)
  const [phases, setPhases] = useState<ClientPhase[]>([])
  const [videos, setVideos] = useState<ClientVideo[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [registros, setRegistros] = useState<RegistroSemanal[]>([])
  const [hitos, setHitos] = useState<HitosCliente | null>(null)
  const [latestMetrics, setLatestMetrics] = useState<ClientMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    async function fetchAll() {
      try {
        setLoading(true)
        setError(null)

        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('profile_id', user!.id)
          .single()
        if (clientError) throw clientError
        setClient(clientData as Client)

        const cid = clientData.id

        const [statusRes, phasesRes, videosRes, docsRes, registrosRes, hitosRes, latestMetricsRes] =
          await Promise.all([
            supabase
              .from('client_portal_status')
              .select('*')
              .eq('client_id', cid)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('client_phases')
              .select('*')
              .eq('client_id', cid)
              .order('phase_order', { ascending: true }),
            supabase
              .from('client_videos')
              .select('*')
              .eq('client_id', cid)
              .order('sent_at', { ascending: false }),
            supabase
              .from('documents')
              .select('*')
              .eq('client_id', cid)
              .order('upload_date', { ascending: false }),
            supabase
              .from('registro_semanal_fullfillment')
              .select('*')
              .eq('client_id', cid)
              .order('fecha_inicio', { ascending: false })
              .limit(4),
            supabase
              .from('hitos_cliente')
              .select('*')
              .eq('client_id', cid)
              .maybeSingle(),
            supabase
              .from('client_metrics')
              .select('*')
              .eq('client_id', cid)
              .order('week_start', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ])

        setStatus(statusRes.data as ClientPortalStatus | null)
        setPhases((phasesRes.data ?? []) as ClientPhase[])
        setVideos((videosRes.data ?? []) as ClientVideo[])
        setDocuments((docsRes.data ?? []) as Document[])
        setRegistros((registrosRes.data ?? []) as RegistroSemanal[])
        setHitos(hitosRes.data as HitosCliente | null)
        setLatestMetrics(latestMetricsRes.data as ClientMetrics | null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando datos')
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [user])

  return { client, status, phases, videos, documents, registros, hitos, latestMetrics, loading, error }
}
