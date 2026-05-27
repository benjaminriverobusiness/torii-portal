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
  canal?: string
  fase: string | null
  profile_id: string
  installment_amount: number | null
  contract_days?: number
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

export interface ClientMetrics {
  id: string
  client_id: string
  week_number: number
  year: number
  week_start: string
  ads_investment?: number
  ads_leads?: number
  ads_cpl?: number
  ads_qualified_leads?: number
  ads_bookings?: number
  ads_cpbc?: number
  ads_show_rate?: number
  ads_close_rate?: number
  // Legacy - no mostrar en UI
  li_connections_sent?: number
  // Legacy - no mostrar en UI
  li_connections_accepted?: number
  li_accept_rate?: number
  // Legacy - no mostrar en UI
  li_messages_sent?: number
  // Legacy - no mostrar en UI
  li_replies?: number
  li_reply_rate?: number
  li_offer_rate?: number
  li_calendly_rate?: number
  li_booking_rate?: number
  li_bookings?: number
  created_at: string
  updated_at: string
}

export interface ClientMetricsConfig {
  id: string
  client_id: string
  show_ads_section: boolean
  show_li_section: boolean
  show_ads_investment: boolean
  show_ads_leads: boolean
  show_ads_cpl: boolean
  show_ads_qualified: boolean
  show_ads_cpbc: boolean
  show_ads_show_rate: boolean
  show_ads_close_rate: boolean
  show_li_accept_rate: boolean
  show_li_reply_rate: boolean
  show_li_offer_rate: boolean
  show_li_calendly_rate: boolean
  show_li_booking_rate: boolean
  show_li_bookings: boolean
  show_closer_chart?: boolean
  template_name?: string
}

export interface ClientCreative {
  id: string
  client_id: string
  title: string
  type: 'image' | 'video' | 'copy'
  channel?: string
  status: 'active' | 'paused' | 'archived'
  url: string
  thumbnail_url?: string
  notes?: string
  cpl?: number
  ctr?: number
  created_at: string
  updated_at: string
}

export interface LiAccountMetric {
  id: string
  client_id: string
  week_number: number
  year: number
  week_start: string
  account_name: string
  accept_rate?: number
  reply_rate?: number
  offer_rate?: number
  calendly_rate?: number
  booking_rate?: number
  bookings?: number
  created_at: string
  updated_at: string
}

export interface MetricsTemplate {
  id: string
  name: string
  description?: string
  show_ads_section: boolean
  show_li_section: boolean
  show_ads_investment: boolean
  show_ads_leads: boolean
  show_ads_cpl: boolean
  show_ads_qualified: boolean
  show_ads_cpbc: boolean
  show_ads_show_rate: boolean
  show_ads_close_rate: boolean
  show_li_accept_rate: boolean
  show_li_reply_rate: boolean
  show_li_offer_rate: boolean
  show_li_calendly_rate: boolean
  show_li_booking_rate: boolean
  show_li_bookings: boolean
}

export interface ClientCloser {
  id: string
  client_id: string
  name: string
  active: boolean
  created_at: string
}
