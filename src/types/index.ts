export interface Profile {
  id: string
  email: string
  name: string
  avatar_url: string | null
  role: 'admin' | 'client' | 'usuario'
}

export interface Client {
  id: string
  name: string
  email: string
  start_date: string
  end_date: string | null
  status: string
  country: string | null
  platform: string | null
  fase: string | null
  profile_id: string
  installment_amount: number | null
}

export interface ClientPortalStatus {
  id: string
  client_id: string
  updated_at: string
  active_phase_id: string | null
  days_in_phase: number | null
  cpbc_objective: number | null
  cpbc_current: number | null
  current_win: string | null
  next_step: string | null
  last_call_date: string | null
}

export interface ClientPhase {
  id: string
  client_id: string
  phase_order: number
  phase_name: string
  phase_description: string | null
  video_url?: string
}

export interface RegistroSemanal {
  id: string
  client_id: string
  semana: number | null
  año: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  agendas_generadas: number | null
  calificados: number | null
  cerrados: number | null
  show_rate: number | null
  tasa_cierre: number | null
}

export interface Document {
  id: string
  name: string
  description: string | null
  client_id: string
  file_type: string | null
  file_url: string
  upload_date: string | null
}

export interface HitosCliente {
  id: string
  client_id: string
  primera_agenda_fecha: string | null
  primer_cierre_fecha: string | null
  ps1_completado: boolean | null
  ps2_completado: boolean | null
  ps3_completado: boolean | null
}

export interface ClientVideo {
  id: string
  client_id: string
  title: string
  video_url: string
  description: string | null
  sent_at: string | null
}
