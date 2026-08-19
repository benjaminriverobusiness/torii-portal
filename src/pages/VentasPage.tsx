import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import type { Client, ClientCloser } from '../types'
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ─── Local types ─────────────────────────────────────────────

interface CrmLead {
  id: string
  client_id: string
  lead_nombre: string
  lead_email?: string
  lead_telefono?: string
  lead_linkedin?: string
  canal?: string
  etapa: string
  fecha_agenda?: string
  fecha_llamada?: string
  asistio?: boolean
  calificado?: boolean
  cerrado?: boolean
  monto?: number
  objeciones?: string
  notas?: string
  next_followup_date?: string
  followup_count?: number
  recording_url?: string
  created_at: string
  updated_at: string
  closer?: string
  calificacion?: 'Calificado' | 'Calificado tipo B' | 'Semicalificado'
  segunda_reunion?: boolean
  fecha_segunda_reunion?: string
  resultado_segunda_reunion?: string
  producto?: string
  comision_estimada?: number
  motivo_no_cierre?: string
  situacion_laboral?: string
  nivel_ingresos?: string
  capacidad_ahorro?: string
  preocupacion_actual?: string
  edad?: number
  ad_id?: string
  calificaba?: boolean
  situacion_resultado?: string
  hijos_casado?: string
}

interface SalesMaterial {
  id: string
  client_id: string
  title: string
  description?: string
  type: string
  url: string
  order_index: number
  created_at: string
}

// Situación 1ra/2da cita ya NO son arrays hardcodeados — vienen de
// client_situacion_options (editable desde el modal "Gestionar listas"),
// ver SituacionOption más abajo y el fetch en el componente principal.
interface SituacionOption {
  id: string
  tipo: 'primera_cita' | 'segunda_cita'
  valor: string
  orden: number
}

// Opciones de los <select> — se usan directo en las columnas editables de
// ALL_COLUMNS (ya no hay un form de modal separado).
const SITUACION_LABORAL_OPTIONS = [
  'Empleado',
  'Persona física con actividad empresarial',
  'Empresario',
]

const NIVEL_INGRESOS_OPTIONS = [
  '-40.000MXN/Mes',
  'Entre 40.000 y 50.000 MXN/Mes',
  'Entre 50.000 y 80.000 MXN/Mes',
  '>80,000 MXN/mes',
  'No especificó',
]

const CAPACIDAD_AHORRO_OPTIONS = [
  'Alta (>1000 USD/mes)',
  'Media (500-1000 USD/mes)',
  'Baja (<500 USD/mes)',
  'No especificó',
]

// Reemplaza los 2 booleanos separados calificaba/califico — quedan en la
// tabla sin usarse acá, ver migración migrate_calificacion_to_3_valores.
const CALIFICACION_OPTIONS = [
  'Calificado',
  'Calificado tipo B',
  'Semicalificado',
]

const CRM_LEAD_SELECT = `
  id, client_id,
  lead_nombre:lead_name, lead_email, lead_telefono:lead_phone, lead_linkedin,
  etapa, fecha_agenda, fecha_llamada,
  asistio:se_presento, calificado:califico, cerrado:cerro,
  monto:precio, objeciones:objections, notas:notes,
  next_followup_date, followup_count, recording_url,
  created_at, updated_at, closer, calificacion,
  segunda_reunion, fecha_segunda_reunion:segunda_llamada_fecha,
  resultado_segunda_reunion:segunda_llamada_status,
  producto, comision_estimada, motivo_no_cierre:loss_reason, situacion_laboral,
  nivel_ingresos, capacidad_ahorro, preocupacion_actual, edad,
  ad_id, calificaba, situacion_resultado, hijos_casado
`

// ─── Helpers ─────────────────────────────────────────────────

function shortEtapa(etapa: string): string {
  const map: Record<string, string> = {
    'Llamada realizada': 'Realizada',
    'Llamada Realizada': 'Realizada',
    'Seguimiento': 'Seguim.',
    'No calificado': 'No cal.',
  }
  return map[etapa] || etapa
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbedded)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)
  return m ? m[1] : null
}

function getDriveEmbedUrl(url: string): string {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url
}

function getEmbedUrl(url: string): string {
  const ytId = getYoutubeId(url)
  if (ytId) return `https://www.youtube.com/embed/${ytId}`
  const loom = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
  if (loom) return `https://www.loom.com/embed/${loom[1]}`
  return url
}

// ─── Column config ─────────────────────────────────────────────
// Todas las columnas están siempre visibles (nada de selector) y cada celda
// se edita in-place — ver EditableCell más abajo.

interface RowCtx {
  closers: ClientCloser[]
  situacionPrimera: string[]
  situacionSegunda: string[]
  savingCell: string | null
  errorCell: string | null
  saveField: (lead: CrmLead, uiPatch: Partial<CrmLead>, dbPatch: Record<string, unknown>) => void
  newLeadId: string | null
  onAutoFocusHandled: () => void
}

interface ColumnDef {
  key: string
  label: string
  minPx: number
  render: (lead: CrmLead, ctx: RowCtx) => React.ReactNode
}

// ─── Tiny shared pieces ───────────────────────────────────────

function SectionPill({ text }: { text: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: '#e5182b',
      background: 'rgba(229,24,43,0.10)', border: '1px solid rgba(229,24,43,0.22)',
      borderRadius: 99, padding: '5px 14px',
    }}>
      {text}
    </div>
  )
}

function StageBadge({ etapa }: { etapa: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    'Agendado':           { bg: '#071228', color: '#60a5fa' },
    'Llamada realizada':  { bg: '#0f0720', color: '#c084fc' },
    'Seguimiento':        { bg: '#1a1500', color: '#fcd34d' },
    'Cerrado':            { bg: '#071a0f', color: '#4ade80' },
    'No calificado':      { bg: '#1a0707', color: '#f87171' },
  }
  const s = map[etapa] ?? { bg: '#111', color: '#8a8c9e' }
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: s.bg, color: s.color }}>
      {shortEtapa(etapa)}
    </span>
  )
}

function BoolIcon({ value }: { value: boolean | null | undefined }) {
  if (value === true)  return <span style={{ color: '#4ade80', fontWeight: 700 }}>✓</span>
  if (value === false) return <span style={{ color: '#f87171', fontWeight: 700 }}>✗</span>
  return <span style={{ color: '#555669' }}>—</span>
}

// ─── EditableCell — el único componente que sabe editar una celda ─────────
// 5 tipos: bool (click alterna Sí/No), tristate (click cicla Sí→No→Sin
// definir), select/date (control nativo siempre presente, el navegador se
// encarga del picker), text/number (input siempre presente).
// Todos comparten: guardado optimista directo (sin confirmar aparte), mini
// spinner mientras guarda, flash de error + revert si falla.

interface EditableCellProps {
  value: string | number | boolean | null | undefined
  type: 'text' | 'number' | 'date' | 'select' | 'bool' | 'tristate'
  options?: string[]
  editable?: boolean
  disabledTitle?: string
  saving: boolean
  errored: boolean
  onSave: (next: string) => void
  placeholder?: string
  emptyOptionLabel?: string
  validate?: (next: string) => boolean
  autoFocus?: boolean
  onAutoFocusHandled?: () => void
}

function EditableCell({
  value, type, options, editable = true, disabledTitle, saving, errored, onSave,
  placeholder, emptyOptionLabel = '—', validate, autoFocus, onAutoFocusHandled,
}: EditableCellProps) {
  const original = value === null || value === undefined ? '' : String(value)
  const [draft, setDraft] = useState(original)
  useEffect(() => { setDraft(original) }, [original])

  const feedback = (
    <>
      {saving && <Spinner size={11} color="#8a8c9e" />}
      {errored && <span style={{ color: '#f87171', fontSize: 11 }} title="No se pudo guardar, probá de nuevo">!</span>}
    </>
  )

  if (type === 'bool') {
    const boolValue = value as boolean | null | undefined
    if (!editable) {
      return <div title={disabledTitle}><BoolIcon value={boolValue} /></div>
    }
    return (
      <div
        onClick={() => !saving && onSave(String(!boolValue))}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: saving ? 'default' : 'pointer', fontSize: 18 }}
      >
        <BoolIcon value={boolValue} />
        {feedback}
      </div>
    )
  }

  if (type === 'tristate') {
    const boolValue = value as boolean | null | undefined
    if (!editable) {
      return <div title={disabledTitle}><BoolIcon value={boolValue} /></div>
    }
    // Cicla Sí → No → Sin definir → Sí... (a diferencia de 'bool', que solo
    // alterna entre Sí/No y nunca puede volver a quedar sin marcar).
    const nextValue = boolValue === true ? 'false' : boolValue === false ? 'null' : 'true'
    return (
      <div
        onClick={() => !saving && onSave(nextValue)}
        title="Click para cambiar: Sí → No → Sin definir"
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: saving ? 'default' : 'pointer', fontSize: 18 }}
      >
        <BoolIcon value={boolValue} />
        {feedback}
      </div>
    )
  }

  if (type === 'select') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <select
          className="ec-input"
          value={draft}
          disabled={saving || !editable}
          onChange={(e) => { setDraft(e.target.value); onSave(e.target.value) }}
        >
          <option value="">{emptyOptionLabel}</option>
          {options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {feedback}
      </div>
    )
  }

  if (type === 'date') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          className="ec-input"
          type="date"
          value={draft}
          disabled={saving || !editable}
          onChange={(e) => { setDraft(e.target.value); onSave(e.target.value) }}
          style={{ colorScheme: 'dark' }}
        />
        {feedback}
      </div>
    )
  }

  // text / number
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        className="ec-input"
        type={type === 'number' ? 'number' : 'text'}
        value={draft}
        placeholder={placeholder}
        disabled={saving || !editable}
        autoFocus={autoFocus}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { setDraft(original); (e.target as HTMLInputElement).blur() }
        }}
        onBlur={() => {
          if (autoFocus) onAutoFocusHandled?.()
          if (draft === original) return
          if (validate && !validate(draft)) { setDraft(original); return }
          onSave(draft)
        }}
      />
      {feedback}
    </div>
  )
}

// ─── Factories de columnas — declarativo, para no repetir la mecánica de
// EditableCell en cada una de las ~20 columnas "simples" (1 campo = 1 celda) ──

function textColumn(
  key: string, label: string, minPx: number, field: keyof CrmLead, dbField: string,
  opts?: { numeric?: boolean; placeholder?: string; validate?: (v: string) => boolean; autoFocusOnCreate?: boolean },
): ColumnDef {
  return {
    key, label, minPx,
    render: (l, ctx) => {
      const cellKey = `${l.id}:${dbField}`
      const isNewRow = !!opts?.autoFocusOnCreate && ctx.newLeadId === l.id
      return (
        <EditableCell
          type={opts?.numeric ? 'number' : 'text'}
          value={l[field] as string | number | undefined}
          saving={ctx.savingCell === cellKey}
          errored={ctx.errorCell === cellKey}
          placeholder={opts?.placeholder}
          validate={opts?.validate}
          autoFocus={isNewRow}
          onAutoFocusHandled={ctx.onAutoFocusHandled}
          onSave={(v) => {
            const trimmed = v.trim()
            const uiVal: unknown = opts?.numeric ? (trimmed === '' ? undefined : Number(trimmed)) : (trimmed || undefined)
            const dbVal = opts?.numeric ? (trimmed === '' ? null : Number(trimmed)) : (trimmed || null)
            ctx.saveField(l, { [field]: uiVal } as Partial<CrmLead>, { [dbField]: dbVal })
          }}
        />
      )
    },
  }
}

function dateColumn(key: string, label: string, minPx: number, field: keyof CrmLead, dbField: string): ColumnDef {
  return {
    key, label, minPx,
    render: (l, ctx) => {
      const cellKey = `${l.id}:${dbField}`
      return (
        <EditableCell
          type="date"
          value={l[field] as string | undefined}
          saving={ctx.savingCell === cellKey}
          errored={ctx.errorCell === cellKey}
          onSave={(v) => ctx.saveField(l, { [field]: v || undefined } as Partial<CrmLead>, { [dbField]: v || null })}
        />
      )
    },
  }
}

function selectColumn(
  key: string, label: string, minPx: number, field: keyof CrmLead, dbField: string, options: string[],
): ColumnDef {
  return {
    key, label, minPx,
    render: (l, ctx) => {
      const cellKey = `${l.id}:${dbField}`
      return (
        <EditableCell
          type="select"
          options={options}
          value={l[field] as string | undefined}
          saving={ctx.savingCell === cellKey}
          errored={ctx.errorCell === cellKey}
          onSave={(v) => ctx.saveField(l, { [field]: v || undefined } as Partial<CrmLead>, { [dbField]: v || null })}
        />
      )
    },
  }
}

// Permite volver a "sin definir" (null), a diferencia de un toggle binario —
// tipo 'tristate' en EditableCell. onSave recibe 'true'/'false'/'null'.
function triStateColumn(key: string, label: string, minPx: number, field: keyof CrmLead, dbField: string): ColumnDef {
  return {
    key, label, minPx,
    render: (l, ctx) => {
      const cellKey = `${l.id}:${dbField}`
      return (
        <EditableCell
          type="tristate"
          value={l[field] as boolean | null | undefined}
          saving={ctx.savingCell === cellKey}
          errored={ctx.errorCell === cellKey}
          onSave={(v) => {
            const parsed = v === 'true' ? true : v === 'false' ? false : undefined
            ctx.saveField(l, { [field]: parsed } as Partial<CrmLead>, { [dbField]: parsed === undefined ? null : parsed })
          }}
        />
      )
    },
  }
}

const ALL_COLUMNS: ColumnDef[] = [
  // ── Orden acordado (Closer al final, después de Notas closer) ──
  textColumn('nombre', 'Nombre del lead', 220, 'lead_nombre', 'lead_name', { validate: (v) => v.trim().length > 0, autoFocusOnCreate: true }),
  textColumn('telefono', 'Teléfono', 130, 'lead_telefono', 'lead_phone'),
  textColumn('correo', 'Correo', 180, 'lead_email', 'lead_email'),
  // Editable — el auto-completado desde ghl-appointment-webhook sigue
  // existiendo si corre, pero hoy nunca trae dato (Workflow de GHL sin
  // configurar la atribución de anuncio) así que tiene que poder cargarse
  // a mano. Mismo criterio que el Hub: texto libre, no dropdown.
  textColumn('ad', 'Ad', 110, 'ad_id', 'ad_id'),
  triStateColumn('asistio', 'Se presentó', 100, 'asistio', 'se_presento'),
  // Reemplaza calificaba/califico (booleanos viejos, ver migración) — quedan
  // en la tabla sin usarse en el frontend.
  selectColumn('calificacion', 'Calificación', 170, 'calificacion', 'calificacion', CALIFICACION_OPTIONS),
  {
    // Opciones dinámicas (client_situacion_options, editables desde
    // "Gestionar listas") — no puede ser selectColumn(), que solo acepta
    // un array fijo definido a nivel de módulo.
    key: 'situacion_resultado', label: 'Situación 1ra cita', minPx: 170,
    render: (l, ctx) => {
      const cellKey = `${l.id}:situacion_resultado`
      return (
        <EditableCell
          type="select"
          options={ctx.situacionPrimera}
          value={l.situacion_resultado}
          saving={ctx.savingCell === cellKey}
          errored={ctx.errorCell === cellKey}
          onSave={(v) => ctx.saveField(l, { situacion_resultado: v || undefined }, { situacion_resultado: v || null })}
        />
      )
    },
  },
  {
    key: 'segunda_reunion', label: 'Fecha 2da cita', minPx: 130,
    // Mental model simple para Raúl: si hay fecha, hay 2da cita. Poner una
    // fecha prende segunda_reunion; vaciarla lo apaga (y libera "Cerró?").
    render: (l, ctx) => {
      const cellKey = `${l.id}:segunda_llamada_fecha`
      return (
        <EditableCell
          type="date"
          value={l.fecha_segunda_reunion}
          saving={ctx.savingCell === cellKey}
          errored={ctx.errorCell === cellKey}
          onSave={(v) => ctx.saveField(
            l,
            { fecha_segunda_reunion: v || undefined, segunda_reunion: !!v },
            { segunda_llamada_fecha: v || null, segunda_reunion: !!v },
          )}
        />
      )
    },
  },
  {
    key: 'resultado', label: 'Situación 2da cita', minPx: 150,
    render: (l, ctx) => {
      const cellKey = `${l.id}:segunda_llamada_status`
      return (
        <EditableCell
          type="select"
          options={ctx.situacionSegunda}
          value={l.resultado_segunda_reunion}
          saving={ctx.savingCell === cellKey}
          errored={ctx.errorCell === cellKey}
          onSave={(v) => ctx.saveField(
            l,
            { resultado_segunda_reunion: v || undefined, segunda_reunion: v ? true : l.segunda_reunion },
            { segunda_llamada_status: v || null, segunda_reunion: v ? true : l.segunda_reunion },
          )}
        />
      )
    },
  },
  {
    key: 'cerrado', label: 'Cerró?', minPx: 90,
    render: (l, ctx) => {
      const cellKey = `${l.id}:cerro`
      return (
        <EditableCell
          type="bool"
          value={l.cerrado}
          editable={!l.segunda_reunion}
          disabledTitle={l.segunda_reunion ? 'Se define por el resultado de la 2da reunión' : undefined}
          saving={ctx.savingCell === cellKey}
          errored={ctx.errorCell === cellKey}
          onSave={(v) => ctx.saveField(l, { cerrado: v === 'true' }, { cerro: v === 'true' })}
        />
      )
    },
  },
  textColumn('producto', 'Producto', 140, 'producto', 'producto'),
  textColumn('comision_estimada', 'Comisión estimada', 160, 'comision_estimada', 'comision_estimada', { numeric: true }),
  textColumn('motivo_no_cierre', 'Motivo no cierre', 170, 'motivo_no_cierre', 'loss_reason'),
  selectColumn('situacion_laboral', 'Situación laboral', 210, 'situacion_laboral', 'situacion_laboral', SITUACION_LABORAL_OPTIONS),
  selectColumn('nivel_ingresos', 'Nivel de ingresos', 230, 'nivel_ingresos', 'nivel_ingresos', NIVEL_INGRESOS_OPTIONS),
  selectColumn('capacidad_ahorro', 'Capacidad de ahorro', 210, 'capacidad_ahorro', 'capacidad_ahorro', CAPACIDAD_AHORRO_OPTIONS),
  textColumn('preocupacion_actual', 'Preocupación actual', 210, 'preocupacion_actual', 'preocupacion_actual'),
  textColumn('edad', 'Edad', 80, 'edad', 'edad', { numeric: true }),
  textColumn('hijos_casado', 'Hijos/Casado', 150, 'hijos_casado', 'hijos_casado'),
  textColumn('notas', 'Notas closer', 220, 'notas', 'notes'),
  // fecha_agenda (Fecha cita agendada) se eliminó de la grilla — era el
  // mismo concepto duplicado de fecha_llamada, que ya se llena sola desde
  // ghl-appointment-webhook. Este es el campo real, renombrado para que
  // quede claro que es la fecha de la cita, no un log de una llamada pasada.
  dateColumn('llamada', 'Fecha llamada agendada', 160, 'fecha_llamada', 'fecha_llamada'),
  // ── Closer se movió del puesto 12 del Sheet a acá, al final ──
  {
    key: 'closer', label: 'Closer', minPx: 120,
    render: (l, ctx) => {
      const cellKey = `${l.id}:closer`
      return (
        <EditableCell
          type="select"
          options={ctx.closers.map((c) => c.name)}
          value={l.closer}
          emptyOptionLabel="Sin asignar"
          saving={ctx.savingCell === cellKey}
          errored={ctx.errorCell === cellKey}
          onSave={(v) => ctx.saveField(l, { closer: v || undefined }, { closer: v || null })}
        />
      )
    },
  },
  // ── Campos que antes solo vivían en el modal — ahora columnas como el resto ──
  textColumn('objeciones', 'Objeciones', 200, 'objeciones', 'objections'),
  textColumn('recording_url', 'Link Fathom', 200, 'recording_url', 'recording_url', { placeholder: 'https://fathom.video/...' }),
  dateColumn('next_followup_date', 'Próximo follow-up', 150, 'next_followup_date', 'next_followup_date'),
]

// Ancho de la columna de numeración (# de fila, puramente visual) y de la
// columna de borrar (ícono chico, sticky a la derecha).
const ROWNUM_MIN_PX = 44
const DELETE_COL_MIN_PX = 50

// Derivado de ALL_COLUMNS en vez de sumado a mano — evita que quede
// desincronizado cada vez que se agrega/saca una columna.
const TABLE_MIN_WIDTH_PX = ROWNUM_MIN_PX + ALL_COLUMNS.reduce((sum, c) => sum + c.minPx, 0) + DELETE_COL_MIN_PX

// ─── Material sub-components ──────────────────────────────────

function MaterialVideoCard({ m }: { m: SalesMaterial }) {
  const [hov, setHov] = useState(false)
  const ytId = getYoutubeId(m.url)
  const isLoom = m.url.includes('loom.com')
  return (
    <div
      style={{ background: 'rgba(255,255,255,0.02)', border: hov ? '1px solid rgba(229,24,43,0.35)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', transform: hov ? 'translateY(-4px)' : 'translateY(0)', boxShadow: hov ? '0 12px 40px rgba(229,24,43,0.12)' : 'none', transition: 'all 0.25s ease', cursor: 'pointer' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => window.open(m.url, '_blank')}
    >
      <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#0d0e17', overflow: 'hidden' }}>
        {ytId ? (
          <img src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
            onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s', transform: hov ? 'scale(1.05)' : 'scale(1)' }} alt={m.title} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#111220', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="#555669" strokeWidth="1.5"/><polygon points="10,8 17,12 10,16" fill="#555669"/></svg>
            <span style={{ color: '#555669', fontSize: 13 }}>{isLoom ? 'Ver en Loom' : 'Ver video'}</span>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hov ? 1 : 0, transition: 'opacity 0.25s' }}>
          <div style={{ width: 56, height: 56, background: '#e5182b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 32px rgba(229,24,43,0.6)', transform: hov ? 'scale(1)' : 'scale(0.8)', transition: 'transform 0.25s' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><polygon points="7,4 17,10 7,16" fill="white"/></svg>
          </div>
        </div>
      </div>
      <div style={{ padding: '18px 20px 22px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 6 }}>{m.title}</div>
        {m.description && <div style={{ fontSize: 13, color: '#8a8c9e', lineHeight: 1.5, marginBottom: 14 }}>{m.description}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polygon points="2,1 9,5 2,9" fill="#e5182b"/></svg>
          <span style={{ color: '#e5182b', fontSize: 13, fontWeight: 600 }}>Ver material →</span>
        </div>
      </div>
    </div>
  )
}

function MaterialDocCard({ m, onPreview }: { m: SalesMaterial; onPreview: (m: SalesMaterial) => void }) {
  const [hov, setHov] = useState(false)
  const [btnHov, setBtnHov] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: hov ? 'rgba(229,24,43,0.04)' : 'rgba(255,255,255,0.02)', border: hov ? '1px solid rgba(229,24,43,0.3)' : '1px solid rgba(255,255,255,0.07)', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={() => onPreview(m)}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="2" width="18" height="22" rx="2" stroke="#60a5fa" strokeWidth="1.5"/>
        <path d="M18 2v6h6" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round"/>
        <line x1="8" y1="14" x2="22" y2="14" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="8" y1="18" x2="22" y2="18" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 4 }}>{m.title}</div>
        {m.description && <div style={{ fontSize: 13, color: '#8a8c9e' }}>{m.description}</div>}
      </div>
      <button style={{ padding: '6px 14px', background: btnHov ? 'rgba(229,24,43,0.1)' : 'rgba(255,255,255,0.05)', border: btnHov ? '1px solid rgba(229,24,43,0.3)' : '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: btnHov ? '#e5182b' : '#f0f1f7', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'DM Sans, sans-serif' }}
        onMouseEnter={() => setBtnHov(true)} onMouseLeave={() => setBtnHov(false)}
        onClick={(e) => { e.stopPropagation(); onPreview(m) }}>
        Previsualizar
      </button>
    </div>
  )
}

function LinkCard({ m }: { m: SalesMaterial }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: hov ? '1px solid rgba(229,24,43,0.3)' : '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => window.open(m.url, '_blank')}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="#e5182b" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="#e5182b" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7' }}>{m.title}</div>
        {m.description && <div style={{ fontSize: 13, color: '#8a8c9e', marginTop: 2 }}>{m.description}</div>}
      </div>
      <span style={{ color: '#e5182b', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>Abrir →</span>
    </div>
  )
}

function AnalysisVideoCard({ material, onPlay }: { material: SalesMaterial; onPlay: (url: string, title: string) => void }) {
  const [hov, setHov] = useState(false)
  const ytId = getYoutubeId(material.url)
  const isLoom = material.url.includes('loom.com')
  return (
    <div
      style={{ background: 'rgba(255,255,255,0.02)', border: hov ? '1px solid rgba(229,24,43,0.35)' : '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.25s ease' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onPlay(material.url, material.title)}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0d0e17', overflow: 'hidden' }}>
        {ytId ? (
          <img
            src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
            onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s', transform: hov ? 'scale(1.05)' : 'scale(1)' }}
            alt={material.title}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#111220', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="#555669" strokeWidth="1.5"/><polygon points="10,8 17,12 10,16" fill="#555669"/></svg>
            <span style={{ color: '#555669', fontSize: 13 }}>{isLoom ? 'Ver en Loom' : 'Ver video'}</span>
          </div>
        )}
        {/* Play overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hov ? 1 : 0, transition: 'opacity 0.25s' }}>
          <div style={{ width: 52, height: 52, background: '#e5182b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 32px rgba(229,24,43,0.6)', transform: hov ? 'scale(1)' : 'scale(0.8)', transition: 'transform 0.25s' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><polygon points="7,4 17,10 7,16" fill="white"/></svg>
          </div>
        </div>
      </div>
      {/* Content */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f1f7', marginBottom: material.description ? 4 : 0 }}>{material.title}</div>
        {material.description && <div style={{ fontSize: 12, color: '#8a8c9e', lineHeight: 1.5 }}>{material.description}</div>}
      </div>
    </div>
  )
}

function MaterialPreviewModal({ material, onClose }: { material: SalesMaterial; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 900, height: '85vh', background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f1f7' }}>{material.title}</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button style={{ color: '#e5182b', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: 'none', fontFamily: 'DM Sans, sans-serif' }} onClick={() => window.open(material.url, '_blank')}>Abrir en Drive →</button>
            <button style={{ color: '#555669', fontSize: 20, cursor: 'pointer', background: 'transparent', border: 'none', marginLeft: 16, lineHeight: 1 }} onClick={onClose}>✕</button>
          </div>
        </div>
        <iframe src={getDriveEmbedUrl(material.url)} allow="autoplay" title={material.title} style={{ flex: 1, width: '100%', border: 'none' }} />
      </div>
    </div>
  )
}

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '960px', background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e5182b', animation: 'glow-pulse 2s ease-in-out infinite' }} />
            <span style={{ color: '#f0f1f7', fontSize: '15px', fontWeight: 700 }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ color: '#555669', fontSize: '22px', cursor: 'pointer', background: 'transparent', border: 'none', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, background: '#000' }}>
          <iframe
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            src={getEmbedUrl(url)}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  )
}

// ─── Orden de la tabla ──────────────────────────────────────────
// Dropdown genérico: cualquier columna numérica o de fecha. Más 3 accesos
// rápidos (calificación/se presentó/cerró) que no entran en esa lista
// porque no son ni numéricas ni fecha, pero el usuario los pidió igual.

type SortableKey =
  | 'comision_estimada' | 'edad'
  | 'fecha_segunda_reunion' | 'fecha_llamada' | 'next_followup_date'
  | 'calificacion' | 'asistio' | 'cerrado'

const SORT_FIELD_OPTIONS: { key: SortableKey; label: string }[] = [
  { key: 'comision_estimada', label: 'Comisión estimada' },
  { key: 'edad', label: 'Edad' },
  { key: 'fecha_segunda_reunion', label: 'Fecha 2da cita' },
  { key: 'fecha_llamada', label: 'Fecha llamada agendada' },
  { key: 'next_followup_date', label: 'Próximo follow-up' },
]

const QUICK_SORT_OPTIONS: { key: SortableKey; label: string }[] = [
  { key: 'calificacion', label: 'Calificación' },
  { key: 'asistio', label: 'Se presentó' },
  { key: 'cerrado', label: 'Cerró' },
]

// "Vacío" para efectos de orden: false es un valor real en asistio/cerrado
// (no está vacío), a diferencia de calificacion/fechas donde cualquier
// falsy (null/undefined/'') sí lo está.
function isEmptyForSort(v: unknown, field: SortableKey): boolean {
  if (field === 'asistio' || field === 'cerrado') return v !== true && v !== false
  if (field === 'edad' || field === 'comision_estimada') return typeof v !== 'number'
  return !v
}

// Compara solo pares donde NINGUNO de los dos está vacío — la posición de
// los vacíos se resuelve aparte, en el wrapper de sort() de más abajo, para
// que quede fija al final sea cual sea sortDir. Antes esto vivía acá mismo
// devolviendo -1/1, pero el wrapper invertía el resultado entero según
// dirección — incluida esa parte — y los vacíos terminaban primero en modo
// 'asc' en vez de al final.
function compareLeadsBy(a: CrmLead, b: CrmLead, field: SortableKey): number {
  const av = a[field]
  const bv = b[field]

  if (field === 'asistio' || field === 'cerrado') {
    return (av === true ? 1 : 0) - (bv === true ? 1 : 0)
  }
  if (field === 'edad' || field === 'comision_estimada') {
    return (av as number) - (bv as number)
  }
  if (field === 'calificacion') {
    return String(av).localeCompare(String(bv))
  }
  // Campos de fecha (fecha_segunda_reunion, fecha_llamada, next_followup_date)
  return new Date(String(av)).getTime() - new Date(String(bv)).getTime()
}

// ─── Filtros de la tabla ────────────────────────────────────────
// Independientes del orden: ocultan filas (a diferencia de sortField, que
// solo reordena). Se combinan entre sí con AND. Default 'all' en los 3 =
// sin ningún filtro activo, muestra todo como antes.

type CalificacionFilter = 'all' | 'Calificado' | 'Calificado tipo B' | 'Semicalificado' | 'none'
type BoolFilter = 'all' | 'yes' | 'no' | 'none'

const CALIFICACION_FILTER_OPTIONS: { value: CalificacionFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'Calificado', label: 'Calificado' },
  { value: 'Calificado tipo B', label: 'Calificado tipo B' },
  { value: 'Semicalificado', label: 'Semicalificado' },
  { value: 'none', label: 'Sin calificar' },
]

const BOOL_FILTER_OPTIONS: { value: BoolFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'yes', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'none', label: 'Sin dato' },
]

function matchesBoolFilter(v: boolean | null | undefined, filter: BoolFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'none') return v !== true && v !== false
  if (filter === 'yes') return v === true
  return v === false
}

// ─── Modal "Gestionar listas" ───────────────────────────────────
// CRUD de closers (agregar/activar-desactivar/eliminar) + opciones de
// Situación 1ra/2da cita (agregar/eliminar) — todo lo que antes era
// hardcodeado o solo editable por un admin en otro repo.

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState('')
  function submit() {
    if (!value.trim()) return
    onAdd(value)
    setValue('')
  }
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#f0f1f7', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
      />
      <button
        onClick={submit}
        style={{ padding: '8px 16px', background: 'rgba(229,24,43,0.10)', border: '1px solid rgba(229,24,43,0.3)', borderRadius: 8, color: '#e5182b', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
      >
        + Agregar
      </button>
    </div>
  )
}

function ListasModal({
  closers, onAddCloser, onToggleCloserActive, onDeleteCloser,
  situacionPrimera, situacionSegunda, onAddSituacion, onDeleteSituacion,
  onClose,
}: {
  closers: ClientCloser[]
  onAddCloser: (name: string) => void
  onToggleCloserActive: (c: ClientCloser) => void
  onDeleteCloser: (c: ClientCloser) => void
  situacionPrimera: SituacionOption[]
  situacionSegunda: SituacionOption[]
  onAddSituacion: (tipo: SituacionOption['tipo'], valor: string) => void
  onDeleteSituacion: (tipo: SituacionOption['tipo'], opt: SituacionOption) => void
  onClose: () => void
}) {
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 6 }
  const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#8a8c9e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }
  const deleteBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 20, fontWeight: 800, color: '#f0f1f7', margin: 0 }}>
            Gestionar listas
          </h2>
          <button style={{ color: '#555669', fontSize: 20, cursor: 'pointer', background: 'transparent', border: 'none', lineHeight: 1 }} onClick={onClose}>✕</button>
        </div>

        {/* Closers */}
        <div style={{ marginBottom: 32 }}>
          <div style={sectionTitle}>Closers</div>
          {closers.length === 0 && <p style={{ color: '#555669', fontSize: 13 }}>Sin closers cargados.</p>}
          {closers.map((c) => (
            <div key={c.id} style={rowStyle}>
              <span style={{ color: c.active ? '#f0f1f7' : '#555669', fontSize: 13 }}>{c.name}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => onToggleCloserActive(c)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: c.active ? '#4ade80' : '#8a8c9e', cursor: 'pointer', fontSize: 12, padding: '3px 8px', fontFamily: 'DM Sans, sans-serif' }}
                >
                  {c.active ? 'Activo' : 'Inactivo'}
                </button>
                <button onClick={() => onDeleteCloser(c)} style={deleteBtn}>Eliminar</button>
              </div>
            </div>
          ))}
          <AddRow placeholder="Nombre del closer" onAdd={onAddCloser} />
        </div>

        {/* Situación 1ra cita */}
        <div style={{ marginBottom: 32 }}>
          <div style={sectionTitle}>Situación 1ra cita</div>
          {situacionPrimera.length === 0 && <p style={{ color: '#555669', fontSize: 13 }}>Sin opciones cargadas.</p>}
          {situacionPrimera.map((o) => (
            <div key={o.id} style={rowStyle}>
              <span style={{ color: '#f0f1f7', fontSize: 13 }}>{o.valor}</span>
              <button onClick={() => onDeleteSituacion('primera_cita', o)} style={deleteBtn}>Eliminar</button>
            </div>
          ))}
          <AddRow placeholder="Nueva opción" onAdd={(v) => onAddSituacion('primera_cita', v)} />
        </div>

        {/* Situación 2da cita */}
        <div>
          <div style={sectionTitle}>Situación 2da cita</div>
          {situacionSegunda.length === 0 && <p style={{ color: '#555669', fontSize: 13 }}>Sin opciones cargadas.</p>}
          {situacionSegunda.map((o) => (
            <div key={o.id} style={rowStyle}>
              <span style={{ color: '#f0f1f7', fontSize: 13 }}>{o.valor}</span>
              <button onClick={() => onDeleteSituacion('segunda_cita', o)} style={deleteBtn}>Eliminar</button>
            </div>
          ))}
          <AddRow placeholder="Nueva opción" onAdd={(v) => onAddSituacion('segunda_cita', v)} />
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function VentasPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [materials, setMaterials] = useState<SalesMaterial[]>([])

  const [closers, setClosers] = useState<ClientCloser[]>([])
  const [showCloserChart, setShowCloserChart] = useState(false)
  const [situacionPrimera, setSituacionPrimera] = useState<SituacionOption[]>([])
  const [situacionSegunda, setSituacionSegunda] = useState<SituacionOption[]>([])
  const [listasModalOpen, setListasModalOpen] = useState(false)

  const [previewMaterial, setPreviewMaterial] = useState<SalesMaterial | null>(null)
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [savingCell, setSavingCell] = useState<string | null>(null)
  const [errorCell, setErrorCell] = useState<string | null>(null)
  const [newLeadId, setNewLeadId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [addingRow, setAddingRow] = useState(false)
  const [sortField, setSortField] = useState<SortableKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterCalificacion, setFilterCalificacion] = useState<CalificacionFilter>('all')
  const [filterAsistio, setFilterAsistio] = useState<BoolFilter>('all')
  const [filterCerrado, setFilterCerrado] = useState<BoolFilter>('all')

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data: clientData } = await supabase.from('clients').select('*').eq('profile_id', user!.id).single()
        if (!clientData) return
        const c = clientData as Client
        setClient(c)

        const [{ data: leadsData }, { data: matsData }, { data: closersData }, { data: configData }, { data: situacionData }] = await Promise.all([
          supabase.from('client_closer_calls').select(CRM_LEAD_SELECT).eq('client_id', c.id).eq('owner_type', 'client').order('created_at', { ascending: false }),
          supabase.from('sales_materials').select('*').eq('client_id', c.id).order('order_index', { ascending: true }),
          // Sin filtro de active acá — el modal de gestión necesita ver
          // también los inactivos para poder reactivarlos.
          supabase.from('client_closers').select('*').eq('client_id', c.id).order('name'),
          supabase.from('client_metrics_config').select('show_closer_chart').eq('client_id', c.id).maybeSingle(),
          supabase.from('client_situacion_options').select('*').eq('client_id', c.id).order('orden'),
        ])
        setLeads((leadsData ?? []) as CrmLead[])
        setMaterials((matsData ?? []) as SalesMaterial[])
        setClosers((closersData ?? []) as ClientCloser[])
        setShowCloserChart((configData as { show_closer_chart?: boolean } | null)?.show_closer_chart || false)
        const situacionOpts = (situacionData ?? []) as SituacionOption[]
        setSituacionPrimera(situacionOpts.filter((o) => o.tipo === 'primera_cita'))
        setSituacionSegunda(situacionOpts.filter((o) => o.tipo === 'segunda_cita'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])


  async function handleAddRow() {
    if (!client || addingRow) return
    setAddingRow(true)
    try {
      const payload = {
        client_id: client.id,
        owner_type: 'client',
        lead_name: '',
        etapa: 'Agendado',
        se_presento: false,
        califico: false,
        cerro: false,
        segunda_reunion: false,
        calificaba: false,
      }
      const { data, error } = await supabase.from('client_closer_calls').insert(payload).select(CRM_LEAD_SELECT).single()
      if (error || !data) throw error
      const newLead = data as CrmLead
      setLeads((prev) => [newLead, ...prev])
      setNewLeadId(newLead.id)
    } catch (e) {
      console.error(e)
    } finally {
      setAddingRow(false)
    }
  }

  async function saveInlineField(lead: CrmLead, uiPatch: Partial<CrmLead>, dbPatch: Record<string, unknown>) {
    const cellKey = `${lead.id}:${Object.keys(dbPatch)[0]}`
    const prevLeads = leads
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...uiPatch } : l)))
    setErrorCell((c) => (c === cellKey ? null : c))
    setSavingCell(cellKey)
    try {
      const { error } = await supabase.from('client_closer_calls').update(dbPatch).eq('id', lead.id)
      if (error) throw error
    } catch (e) {
      console.error(e)
      setLeads(prevLeads)
      setErrorCell(cellKey)
      setTimeout(() => setErrorCell((c) => (c === cellKey ? null : c)), 1500)
    } finally {
      setSavingCell((c) => (c === cellKey ? null : c))
    }
  }

  async function handleDeleteLead(lead: CrmLead) {
    setConfirmDeleteId(null)
    const prevLeads = leads
    setLeads((prev) => prev.filter((l) => l.id !== lead.id))
    const { error } = await supabase.from('client_closer_calls').delete().eq('id', lead.id)
    if (error) {
      console.error(error)
      setLeads(prevLeads)
    }
  }

  // ── CRUD de closers ──────────────────────────────────────────
  async function handleAddCloser(name: string) {
    const trimmed = name.trim()
    if (!client || !trimmed) return
    const { data, error } = await supabase
      .from('client_closers')
      .insert({ client_id: client.id, name: trimmed, active: true })
      .select()
      .single()
    if (error) { console.error(error); return }
    setClosers((prev) => [...prev, data as ClientCloser].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleToggleCloserActive(closer: ClientCloser) {
    const { error } = await supabase.from('client_closers').update({ active: !closer.active }).eq('id', closer.id)
    if (error) { console.error(error); return }
    setClosers((prev) => prev.map((c) => (c.id === closer.id ? { ...c, active: !c.active } : c)))
  }

  async function handleDeleteCloser(closer: ClientCloser) {
    const { error } = await supabase.from('client_closers').delete().eq('id', closer.id)
    if (error) { console.error(error); return }
    setClosers((prev) => prev.filter((c) => c.id !== closer.id))
  }

  // ── CRUD de opciones de Situación 1ra/2da cita ───────────────
  async function handleAddSituacion(tipo: SituacionOption['tipo'], valor: string) {
    const trimmed = valor.trim()
    if (!client || !trimmed) return
    const list = tipo === 'primera_cita' ? situacionPrimera : situacionSegunda
    const nextOrden = list.length > 0 ? Math.max(...list.map((o) => o.orden)) + 1 : 0
    const { data, error } = await supabase
      .from('client_situacion_options')
      .insert({ client_id: client.id, tipo, valor: trimmed, orden: nextOrden })
      .select()
      .single()
    if (error) { console.error(error); return }
    const setter = tipo === 'primera_cita' ? setSituacionPrimera : setSituacionSegunda
    setter((prev) => [...prev, data as SituacionOption])
  }

  async function handleDeleteSituacion(tipo: SituacionOption['tipo'], opt: SituacionOption) {
    const { error } = await supabase.from('client_situacion_options').delete().eq('id', opt.id)
    if (error) { console.error(error); return }
    const setter = tipo === 'primera_cita' ? setSituacionPrimera : setSituacionSegunda
    setter((prev) => prev.filter((o) => o.id !== opt.id))
  }

  // ── Metrics ────────────────────────────────────────────────
  const isTrue = (v: unknown) => v === true || v === 'true' || String(v) === 'true'

  const totalLeads = leads.length
  const totalAsistieron = leads.filter((l) => isTrue(l.asistio)).length
  const totalCerrados = leads.filter((l) => isTrue(l.cerrado)).length
  const showRate = totalLeads > 0 ? Math.round((totalAsistieron / totalLeads) * 100) : 0
  const closeRate = totalAsistieron > 0 ? Math.round((totalCerrados / totalAsistieron) * 100) : 0
  const totalMonto = leads.filter((l) => isTrue(l.cerrado) && l.monto).reduce((s, l) => s + (l.monto ?? 0), 0)

  const showRateColor = showRate >= 60 ? '#4ade80' : showRate >= 40 ? '#fcd34d' : '#f87171'
  const closeRateColor = closeRate >= 25 ? '#4ade80' : closeRate >= 15 ? '#fcd34d' : '#f87171'

  const leadsConGrabacion = leads.filter((l) => l.recording_url)
  const analysisVideos = materials.filter((m) => m.type === 'analysis_video')

  const sortedLeads = [...leads]
    .filter((l) => l.fecha_llamada || l.created_at)
    .sort((a, b) => {
      const dateA = new Date((a.fecha_llamada || a.created_at || '')).getTime()
      const dateB = new Date((b.fecha_llamada || b.created_at || '')).getTime()
      return dateA - dateB
    })

  const salesChartData = sortedLeads.map((_, index) => {
    const leadsHastaAqui = sortedLeads.slice(0, index + 1)
    const total = leadsHastaAqui.length
    const asistieron = leadsHastaAqui.filter((l) => isTrue(l.asistio)).length
    const calificados = leadsHastaAqui.filter((l) => isTrue(l.calificado)).length
    const cerrados = leadsHastaAqui.filter((l) => isTrue(l.cerrado)).length
    return {
      agenda: index + 1,
      show_rate: total > 0 ? Math.round(asistieron / total * 100) : 0,
      calificacion: total > 0 ? Math.round(calificados / total * 100) : 0,
      close_rate: calificados > 0 ? Math.round(cerrados / calificados * 100) : 0,
    }
  })

  // Primero se filtra (oculta filas), después se ordena lo que queda —
  // nunca al revés, para que el orden no interfiera con qué está visible.
  const filteredLeads = leads.filter((l) =>
    (filterCalificacion === 'all'
      ? true
      : filterCalificacion === 'none'
        ? !l.calificacion
        : l.calificacion === filterCalificacion)
    && matchesBoolFilter(l.asistio, filterAsistio)
    && matchesBoolFilter(l.cerrado, filterCerrado)
  )

  const displayedLeads = sortField
    ? [...filteredLeads].sort((a, b) => {
        // Vacíos siempre al final, sea 'asc' o 'desc' — se resuelve ACÁ,
        // antes de aplicar el signo de dirección, para que ese signo no
        // termine invirtiendo también la posición de los vacíos (ver
        // comentario en compareLeadsBy).
        const aEmpty = isEmptyForSort(a[sortField], sortField)
        const bEmpty = isEmptyForSort(b[sortField], sortField)
        if (aEmpty && bEmpty) return 0
        if (aEmpty) return 1
        if (bEmpty) return -1
        const cmp = compareLeadsBy(a, b, sortField)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filteredLeads

  function handleSortFieldChange(field: SortableKey | '') {
    if (!field) { setSortField(null); return }
    setSortField(field)
    setSortDir('asc')
  }

  function handleQuickSort(field: SortableKey) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const rowCtx: RowCtx = {
    // El dropdown de la columna Closer solo debe ofrecer los activos —
    // `closers` (el state) trae también los inactivos, para el modal de
    // gestión más abajo.
    closers: closers.filter((c) => c.active),
    situacionPrimera: situacionPrimera.map((o) => o.valor),
    situacionSegunda: situacionSegunda.map((o) => o.valor),
    savingCell, errorCell, saveField: saveInlineField,
    newLeadId, onAutoFocusHandled: () => setNewLeadId(null),
  }
  // Fuerza bruta a propósito: cada columna es un track de ancho FIJO en px
  // (nada de minmax()/fr), así no hay ninguna sizing algorithm que pueda
  // comprimirla. Todas las columnas están siempre visibles, así que el grid
  // es fijo — sin selector, sin filtrado.
  const GRID = [`${ROWNUM_MIN_PX}px`, ...ALL_COLUMNS.map((c) => `${c.minPx}px`), `${DELETE_COL_MIN_PX}px`].join(' ')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#08090f', color: '#f0f1f7', fontFamily: 'DM Sans, sans-serif' }}>
      <Navbar showNav />

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 112px)' }}>
          <Spinner size={40} />
        </div>
      ) : (
        <div style={{ maxWidth: '100%', margin: '0 auto', padding: '40px 24px' }}>

          {/* Hero */}
          <div className="fade-in visible" style={{ marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e5182b', background: 'rgba(229,24,43,0.10)', border: '1px solid rgba(229,24,43,0.22)', borderRadius: 99, padding: '5px 14px', marginBottom: 16 }}>
              VENTAS
            </div>
            <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: '#f0f1f7', margin: '0 0 8px', animation: 'fade-up 0.5s ease both' }}>
              Tu pipeline de ventas
            </h1>
            <p style={{ color: '#8a8c9e', fontSize: 16, margin: 0, animation: 'fade-up 0.5s ease 0.1s both' }}>
              Registrá tus llamadas, seguí tus cierres y accedé al material de apoyo.
            </p>
          </div>

          {/* Metrics */}
          <div className="fade-in ventas-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'TOTAL LLAMADAS', value: totalLeads, color: '#f0f1f7', sub: null },
              { label: 'SHOW RATE', value: `${showRate}%`, color: showRateColor, sub: null },
              { label: 'TASA DE CIERRE', value: `${closeRate}%`, color: closeRateColor, sub: null },
              { label: 'INGRESOS GENERADOS', value: `$${totalMonto.toLocaleString()}`, color: '#c9a84c', sub: 'de cierres confirmados' },
            ].map((m) => (
              <div key={m.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px 24px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555669', marginBottom: 8 }}>{m.label}</div>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 36, fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</div>
                {m.sub && <div style={{ fontSize: 13, color: '#555669', marginTop: 6 }}>{m.sub}</div>}
              </div>
            ))}
          </div>

          {/* Section 3 — Gráficos */}
          {leads.length > 0 && (
            <div className="fade-in visible" style={{ marginBottom: 40 }}>
              <div style={{ marginBottom: 20 }}>
                <SectionPill text="GRÁFICOS HISTÓRICOS" />
              </div>

              {/* Gráfico unificado */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700, color: '#f0f1f7', marginBottom: 20 }}>Evolución del pipeline</div>
                {salesChartData.length < 2 ? (
                  <div style={{ color: '#555669', fontSize: '13px', textAlign: 'center', padding: '40px' }}>
                    Agendá más llamadas para ver la evolución de tus tasas de conversión.
                  </div>
                ) : (
                  <>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={salesChartData} margin={{ top: 4, right: 8, bottom: 16, left: -8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="agenda" stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} label={{ value: 'Agenda #', position: 'insideBottom', offset: -5, fill: '#555669', fontSize: 11 }} />
                      <YAxis stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} width={36} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f0f1f7', fontSize: '12px' }}
                        formatter={(value) => `${value}%`}
                      />
                      <Legend wrapperStyle={{ color: '#8a8c9e', fontSize: '12px', paddingTop: '12px' }} />
                      <Line type="linear" dataKey="show_rate" stroke="#a78bfa" strokeWidth={2.5} strokeDasharray="8 4" dot={{ fill: '#a78bfa', r: 3, strokeWidth: 2, stroke: '#08090f' }} activeDot={{ r: 5 }} name="Show rate %" />
                      <Line type="linear" dataKey="calificacion" stroke="#c9a84c" strokeWidth={2.5} dot={{ fill: '#c9a84c', r: 3, strokeWidth: 2, stroke: '#08090f' }} activeDot={{ r: 5 }} name="Calificación %" />
                      <Line type="linear" dataKey="close_rate" stroke="#4ade80" strokeWidth={2.5} dot={{ fill: '#4ade80', r: 3, strokeWidth: 2, stroke: '#08090f' }} activeDot={{ r: 5 }} name="Close rate %" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div style={{ color: '#555669', fontSize: '11px', fontStyle: 'italic', marginTop: '12px' }}>
                    Las tasas se calculan de forma acumulada. Show rate = asistieron / agendas totales. Calificación = calificados / agendas totales.
                  </div>
                  </>
                )}
              </div>

              {/* Gráfico por closer */}
              {showCloserChart && closers.length > 0 && (() => {
                const closerChartData = (() => {
                  const map: Record<string, { closer: string; agendas: number; cerrados: number; close_rate: number }> = {}
                  leads.filter((l) => l.closer).forEach((lead) => {
                    const key = lead.closer!
                    if (!map[key]) map[key] = { closer: key, agendas: 0, cerrados: 0, close_rate: 0 }
                    map[key].agendas++
                    if (lead.cerrado) map[key].cerrados++
                  })
                  return Object.values(map).map((m) => ({
                    ...m,
                    close_rate: m.agendas > 0 ? Math.round(m.cerrados / m.agendas * 100) : 0,
                  }))
                })()
                if (closerChartData.length === 0) return null
                return (
                  <>
                    <div style={{ marginBottom: 20 }}>
                      <SectionPill text="RENDIMIENTO POR CLOSER" />
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px', marginBottom: 16 }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={closerChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="closer" stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} />
                          <YAxis stroke="#555669" fontSize={11} tick={{ fill: '#555669' }} />
                          <Tooltip contentStyle={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f0f1f7', fontSize: '12px' }} />
                          <Legend wrapperStyle={{ color: '#8a8c9e', fontSize: '12px', paddingTop: '12px' }} />
                          <Bar dataKey="agendas" fill="rgba(96,165,250,0.6)" radius={[3, 3, 0, 0]} name="Agendas" />
                          <Bar dataKey="cerrados" fill="rgba(74,222,128,0.8)" radius={[3, 3, 0, 0]} name="Cerrados" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* Pipeline header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <SectionPill text="PIPELINE" />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setListasModalOpen(true)}
                style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f1f7', fontWeight: 600, fontSize: 13, borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                ⚙ Gestionar listas
              </button>
              <button
                style={{ padding: '8px 18px', background: '#e5182b', color: 'white', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: addingRow ? 'not-allowed' : 'pointer', opacity: addingRow ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }}
                onClick={handleAddRow}
                disabled={addingRow}
              >
                + Nueva llamada
              </button>
            </div>
          </div>

          {/* Orden — dropdown genérico (numéricas/fecha) + accesos rápidos */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <span style={{ color: '#555669', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Ordenar por
            </span>
            <select
              value={sortField && SORT_FIELD_OPTIONS.some((o) => o.key === sortField) ? sortField : ''}
              onChange={(e) => handleSortFieldChange(e.target.value as SortableKey | '')}
              style={{
                background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                color: '#f0f1f7', fontSize: 13, padding: '6px 10px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
              }}
            >
              <option value="">Sin ordenar</option>
              {SORT_FIELD_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <button
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              disabled={!sortField}
              title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
              style={{
                padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: sortField ? '#f0f1f7' : '#333', fontSize: 13, cursor: sortField ? 'pointer' : 'not-allowed',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>

            <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

            {QUICK_SORT_OPTIONS.map((o) => {
              const active = sortField === o.key
              return (
                <button
                  key={o.key}
                  onClick={() => handleQuickSort(o.key)}
                  style={{
                    padding: '6px 12px',
                    background: active ? 'rgba(229,24,43,0.12)' : 'rgba(255,255,255,0.04)',
                    border: active ? '1px solid rgba(229,24,43,0.35)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: active ? '#e5182b' : '#8a8c9e',
                    fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {o.label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              )
            })}

            {sortField && (
              <button
                onClick={() => setSortField(null)}
                style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: '#555669', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'DM Sans, sans-serif' }}
              >
                Limpiar orden
              </button>
            )}
          </div>

          {/* Filtros — independientes del orden: ocultan filas en vez de solo reordenarlas */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <span style={{ color: '#555669', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Filtrar por
            </span>
            <select
              value={filterCalificacion}
              onChange={(e) => setFilterCalificacion(e.target.value as CalificacionFilter)}
              style={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0f1f7', fontSize: 13, padding: '6px 10px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
            >
              {CALIFICACION_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>Calificación: {o.label}</option>)}
            </select>
            <select
              value={filterAsistio}
              onChange={(e) => setFilterAsistio(e.target.value as BoolFilter)}
              style={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0f1f7', fontSize: 13, padding: '6px 10px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
            >
              {BOOL_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>Se presentó: {o.label}</option>)}
            </select>
            <select
              value={filterCerrado}
              onChange={(e) => setFilterCerrado(e.target.value as BoolFilter)}
              style={{ background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0f1f7', fontSize: 13, padding: '6px 10px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
            >
              {BOOL_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>Cerró: {o.label}</option>)}
            </select>
            {(filterCalificacion !== 'all' || filterAsistio !== 'all' || filterCerrado !== 'all') && (
              <button
                onClick={() => { setFilterCalificacion('all'); setFilterAsistio('all'); setFilterCerrado('all') }}
                style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: '#555669', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'DM Sans, sans-serif' }}
              >
                Limpiar filtros
              </button>
            )}
            {filteredLeads.length !== leads.length && (
              <span style={{ color: '#555669', fontSize: 12 }}>
                {filteredLeads.length} de {leads.length}
              </span>
            )}
          </div>

          {/* Leads table / cards */}
          {leads.length === 0 ? (
            <div className="fade-in visible" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 12, padding: '60px 20px', textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
                <rect x="6" y="10" width="36" height="32" rx="4" stroke="#333" strokeWidth="2"/>
                <path d="M6 20h36" stroke="#333" strokeWidth="2"/>
                <rect x="14" y="6" width="4" height="8" rx="2" fill="#333"/>
                <rect x="30" y="6" width="4" height="8" rx="2" fill="#333"/>
              </svg>
              <p style={{ color: '#8a8c9e', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Aún no hay llamadas registradas.</p>
              <p style={{ color: '#555669', fontSize: 13, margin: 0 }}>Hacé click en '+ Nueva llamada' para empezar.</p>
            </div>
          ) : displayedLeads.length === 0 ? (
            <div className="fade-in visible" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 12, padding: '60px 20px', textAlign: 'center' }}>
              <p style={{ color: '#8a8c9e', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Ningún resultado con estos filtros.</p>
              <p style={{ color: '#555669', fontSize: 13, margin: 0 }}>Probá cambiarlos o limpiarlos arriba.</p>
            </div>
          ) : isMobile ? (
            <div style={{ marginBottom: 12 }}>
              {displayedLeads.map((lead) => (
                <div key={lead.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 700 }}>{lead.lead_nombre}</div>
                    <StageBadge etapa={lead.etapa} />
                  </div>
                  {lead.closer && (
                    <div style={{ color: '#8a8c9e', fontSize: 13, marginBottom: 6 }}>👤 {lead.closer}</div>
                  )}
                  {lead.fecha_llamada && (
                    <div style={{ color: '#8a8c9e', fontSize: 13, marginBottom: 10 }}>
                      📅 {formatDate(lead.fecha_llamada)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: lead.asistio ? '#4ade80' : '#f87171' }}>
                      {lead.asistio ? '✓' : '✗'} Asistió
                    </span>
                    <span style={{ fontSize: 12, color: lead.calificacion ? '#4ade80' : '#555669' }}>
                      {lead.calificacion ?? 'Sin clasificar'}
                    </span>
                    {lead.cerrado
                      ? <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#071a0f', color: '#4ade80' }}>Cerrado</span>
                      : <span style={{ fontSize: 12, color: '#555669' }}>Pendiente</span>}
                  </div>
                  {lead.recording_url && (
                    <div
                      style={{ fontSize: 13, color: '#c084fc', fontWeight: 600, marginBottom: 10, cursor: 'pointer' }}
                      onClick={() => {
                        if (lead.recording_url!.includes('fathom')) { window.open(lead.recording_url!, '_blank'); return }
                        setPlayingVideo({ url: lead.recording_url!, title: lead.lead_nombre })
                      }}
                    >
                      🎙 Ver grabación →
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="fade-in visible" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
              {/* Fuerza bruta a propósito: contenedor exterior con overflowX:auto + width:100%,
                  contenedor interior con minWidth FIJO derivado (TABLE_MIN_WIDTH_PX, suma de los
                  minPx de ALL_COLUMNS), y cada columna es un track de ancho fijo en px (ver GRID).
                  Nada de fit-content/minmax()/fr acá — cero ambigüedad de sizing. Bordes reales
                  entre celdas/filas (grid-line, no solo espaciado) para que se vea como una hoja
                  de cálculo. La columna de borrar es sticky a la derecha: dentro de este mismo
                  contenedor con overflowX, "right:0" la pega al borde visible del scroll horizontal,
                  no al borde del documento — necesita su propio background (no puede ser
                  transparente) para tapar el contenido que pasa por debajo al scrollear. */}
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <div style={{ minWidth: `${TABLE_MIN_WIDTH_PX}px` }}>
                  <div style={{ background: '#0d0e17', display: 'grid', gridTemplateColumns: GRID, borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#555669', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    <div style={{ flexShrink: 0, minWidth: ROWNUM_MIN_PX, padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>#</div>
                    {ALL_COLUMNS.map((c) => (
                      <div key={c.key} style={{ flexShrink: 0, minWidth: c.minPx, padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.07)' }}>{c.label.toUpperCase()}</div>
                    ))}
                    <div style={{ flexShrink: 0, minWidth: DELETE_COL_MIN_PX, padding: '10px 12px', position: 'sticky', right: 0, background: '#e5182b', borderLeft: '1px solid rgba(255,255,255,0.12)' }} />
                  </div>
                  {displayedLeads.map((lead, i) => {
                    const rowBg = i % 2 === 0 ? '#08090f' : 'rgba(255,255,255,0.01)'
                    return (
                    <div
                      key={lead.id}
                      style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'stretch', borderBottom: '1px solid rgba(255,255,255,0.06)', background: rowBg }}
                    >
                      <div style={{ flexShrink: 0, minWidth: ROWNUM_MIN_PX, padding: '6px 10px', display: 'flex', alignItems: 'center', color: '#555669', fontSize: 13, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                        {i + 1}
                      </div>
                      {ALL_COLUMNS.map((c) => (
                        <div key={c.key} style={{ flexShrink: 0, minWidth: c.minPx, overflow: 'hidden', padding: '6px 10px', display: 'flex', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.07)' }}>{c.render(lead, rowCtx)}</div>
                      ))}
                      <div style={{ flexShrink: 0, minWidth: DELETE_COL_MIN_PX, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', right: 0, background: '#e5182b', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>
                        {confirmDeleteId === lead.id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button title="Confirmar" onClick={() => handleDeleteLead(lead)} style={{ background: 'transparent', border: 'none', color: '#bbf7d0', fontWeight: 800, fontSize: 15, cursor: 'pointer', padding: 0 }}>✓</button>
                            <button title="Cancelar" onClick={() => setConfirmDeleteId(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 15, cursor: 'pointer', padding: 0 }}>✕</button>
                          </div>
                        ) : (
                          <button title="Eliminar llamada" onClick={() => setConfirmDeleteId(lead.id)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 15, cursor: 'pointer', padding: 0 }}>🗑</button>
                        )}
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Section 5 — Análisis de Llamadas */}
          {leadsConGrabacion.length > 0 && (
            <div className="fade-in visible" style={{ marginBottom: 48, marginTop: 16 }}>
              <div style={{ marginBottom: 20 }}>
                <SectionPill text="ANÁLISIS DE LLAMADAS" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }} className="ventas-recordings-grid">
                {leadsConGrabacion.map((lead) => (
                  <div
                    key={lead.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(192,132,252,0.35)'; e.currentTarget.style.background = 'rgba(192,132,252,0.04)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onClick={() => {
                      const url = lead.recording_url!
                      if (url.includes('fathom')) { window.open(url, '_blank'); return }
                      setPlayingVideo({ url, title: lead.lead_nombre })
                    }}
                  >
                    <div style={{ width: 36, height: 36, background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#c084fc" strokeWidth="1.8"/><circle cx="12" cy="12" r="4" fill="#c084fc"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f1f7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.lead_nombre}</div>
                      {lead.fecha_llamada && <div style={{ fontSize: 12, color: '#555669', marginTop: 2 }}>{formatDate(lead.fecha_llamada)}</div>}
                    </div>
                    <span style={{ color: '#c084fc', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>Ver grabación →</span>
                  </div>
                ))}
              </div>

              {analysisVideos.length > 0 && (
                <>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#8a8c9e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', marginTop: '24px' }}>
                    Videos de análisis
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }} className="ventas-analysis-grid">
                    {analysisVideos.map((material) => (
                      <AnalysisVideoCard
                        key={material.id}
                        material={material}
                        onPlay={(url, title) => {
                          if (url.includes('fathom')) { window.open(url, '_blank'); return }
                          setPlayingVideo({ url, title })
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Materials */}
          {materials.length > 0 && (
            <div className="fade-in visible" style={{ marginTop: 48 }}>
              <div style={{ marginBottom: 24 }}>
                <SectionPill text="MATERIAL DE APOYO" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }} className="ventas-mats-grid">
                {materials.map((m) => {
                  if (m.type === 'video') return <MaterialVideoCard key={m.id} m={m} />
                  if (m.type === 'document') return <MaterialDocCard key={m.id} m={m} onPreview={setPreviewMaterial} />
                  return <LinkCard key={m.id} m={m} />
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {previewMaterial && <MaterialPreviewModal material={previewMaterial} onClose={() => setPreviewMaterial(null)} />}
      {playingVideo && <VideoModal url={playingVideo.url} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />}
      {listasModalOpen && (
        <ListasModal
          closers={closers}
          onAddCloser={handleAddCloser}
          onToggleCloserActive={handleToggleCloserActive}
          onDeleteCloser={handleDeleteCloser}
          situacionPrimera={situacionPrimera}
          situacionSegunda={situacionSegunda}
          onAddSituacion={handleAddSituacion}
          onDeleteSituacion={handleDeleteSituacion}
          onClose={() => setListasModalOpen(false)}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .ventas-metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .ventas-mats-grid { grid-template-columns: 1fr !important; }
          .ventas-charts-grid { grid-template-columns: 1fr !important; }
          .ventas-recordings-grid { grid-template-columns: 1fr !important; }
          .ventas-analysis-grid { grid-template-columns: 1fr !important; }
        }
        .ec-input {
          width: 100%; background: transparent; border: 1px solid transparent; border-radius: 6px;
          color: #f0f1f7; font-size: 13px; padding: 4px 6px; font-family: 'DM Sans', sans-serif;
          outline: none; box-sizing: border-box;
        }
        .ec-input:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.02); }
        .ec-input:focus { border-color: #e5182b; background: #080910; }
        .ec-input::placeholder { color: #555669; }
        .ec-input:disabled { opacity: 0.5; cursor: default; }
        select.ec-input { cursor: pointer; }
      `}</style>
    </div>
  )
}
