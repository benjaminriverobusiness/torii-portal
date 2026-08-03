// ─── Tipos locales del schema academy.* ─────────────────────────────────
// Sin login individual: todo cuelga de team_member_id (academy.team_members),
// no de auth.users. Ver supabase/migrations/20260801000000_academy_roster_model.sql.

export interface AcademyTeamMember {
  id: string
  client_id: string
  full_name: string
  role: 'admin' | 'setter' | 'closer' | 'manager' | null
  status: 'capacitacion' | 'fase_de_prueba' | 'setter_oficial' | 'activo' | 'inactivo'
  active: boolean
  created_at: string
  updated_at: string
}

export interface Formacion {
  id: string
  title: string
  description: string | null
  order_index: number
  created_at: string
}

export interface AcademyModule {
  id: string
  formacion_id: string | null
  title: string
  description: string | null
  order_index: number
  badge_text: string | null
  cover_image_url: string | null
  created_at: string
}

export interface AcademyVideo {
  id: string
  module_id: string
  title: string
  video_url: string
  order_index: number
  created_at: string
}

export interface ModuleMaterial {
  id: string
  module_id: string | null
  video_id: string | null
  title: string
  file_url: string
  file_name: string
  order_index: number
  is_downloadable: boolean
  created_at: string
}

export interface AcademyExam {
  id: string
  video_id: string
  title: string
  description: string | null
  order_index: number
  created_at: string
}

export interface ExamQuestion {
  id: string
  exam_id: string
  question_text: string
  question_type: 'multiple_choice' | 'open_answer'
  options: string[] | null
  correct_answer: string | null
  order_index: number
  created_at: string
}

export interface ExamSubmission {
  id: string
  exam_id: string
  team_member_id: string
  answers: Record<string, string>
  score: number | null
  total_questions: number
  is_graded: boolean
  submitted_at: string
}

export interface FormacionAccess {
  id: string
  team_member_id: string
  formacion_id: string
  is_unlocked: boolean
  unlocked_at: string | null
}

export interface ModuleAccessRow {
  id: string
  team_member_id: string
  module_id: string
  is_unlocked: boolean
  unlocked_at: string | null
}

export interface VideoProgressRow {
  id: string
  team_member_id: string
  video_id: string
  completed: boolean
  completed_at: string | null
}

export interface ReflectionTask {
  id: string
  team_member_id: string
  module_id: string
  content: string
  is_reviewed: boolean
  submitted_at: string
}

export const ROLE_LABELS: Record<string, string> = {
  setter: 'Setter', closer: 'Closer', manager: 'Manager', admin: 'Admin',
}

export const STATUS_LABELS: Record<string, string> = {
  capacitacion: 'Capacitación', fase_de_prueba: 'Fase de prueba',
  setter_oficial: 'Oficial', activo: 'Activo', inactivo: 'Inactivo',
}
