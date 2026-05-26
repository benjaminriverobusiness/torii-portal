import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import { JourneyMap } from '../components/JourneyMap'
import { KpiCard } from '../components/KpiCard'
import { VideoCard } from '../components/VideoCard'
import { DocumentCard } from '../components/DocumentCard'
import type {
  Client,
  ClientPortalStatus,
  ClientPhase,
  ClientVideo,
  Document,
  RegistroSemanal,
  ClientMetrics,
  ClientMetricsConfig,
  MetricsTemplate,
  ClientCreative,
  LiAccountMetric,
} from '../types'

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatWeekRange(start?: string, end?: string): string {
  if (!start) return '—'
  const s = new Date(start + 'T12:00:00')
  const sStr = `${s.getDate().toString().padStart(2, '0')}/${(s.getMonth() + 1).toString().padStart(2, '0')}`
  if (!end) return sStr
  const e = new Date(end + 'T12:00:00')
  const eStr = `${e.getDate().toString().padStart(2, '0')}/${(e.getMonth() + 1).toString().padStart(2, '0')}`
  return `${sStr} — ${eStr}`
}

function pct(val: number | null | undefined) {
  if (!val) return 0
  return val > 1 ? val : val * 100
}

interface SalesMaterialLocal {
  id: string
  client_id: string
  title: string
  description?: string | null
  type: string
  url: string
  order_index: number
}

type Tab = 'preview' | 'phases' | 'update'

export function AdminClient() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('update')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [client, setClient] = useState<Client | null>(null)
  const [status, setStatus] = useState<ClientPortalStatus | null>(null)
  const [phases, setPhases] = useState<ClientPhase[]>([])
  const [videos, setVideos] = useState<ClientVideo[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [registros, setRegistros] = useState<RegistroSemanal[]>([])
  const [history, setHistory] = useState<ClientPortalStatus[]>([])

  // Copy phases state
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyTargetClientId, setCopyTargetClientId] = useState('')
  const [allClients, setAllClients] = useState<{ id: string; name: string }[]>([])
  const [copying, setCopying] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  // Metrics state
  const [templates, setTemplates] = useState<MetricsTemplate[]>([])
  const [metricsConfig, setMetricsConfig] = useState<ClientMetricsConfig>({
    id: '',
    client_id: '',
    show_ads_section: false,
    show_li_section: false,
    show_ads_investment: false,
    show_ads_leads: false,
    show_ads_cpl: false,
    show_ads_qualified: false,
    show_ads_cpbc: false,
    show_ads_show_rate: false,
    show_ads_close_rate: false,
    show_li_accept_rate: false,
    show_li_reply_rate: false,
    show_li_offer_rate: false,
    show_li_calendly_rate: false,
    show_li_booking_rate: false,
    show_li_bookings: false,
  })
  const [metricsHistory, setMetricsHistory] = useState<ClientMetrics[]>([])
  const [weekForm, setWeekForm] = useState({
    week_number: 1,
    year: new Date().getFullYear(),
    week_start: new Date().toISOString().split('T')[0],
    week_end: '',
    ads_investment: '',
    ads_leads: '',
    ads_cpl: '',
    ads_qualified_leads: '',
    ads_bookings: '',
    ads_cpbc: '',
    ads_show_rate: '',
    ads_close_rate: '',
    li_connections_sent: '',
    li_connections_accepted: '',
    li_accept_rate: '',
    li_messages_sent: '',
    li_replies: '',
    li_reply_rate: '',
    li_offer_rate: '',
    li_calendly_rate: '',
    li_booking_rate: '',
    li_bookings: '',
  })
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false)
  const [weekSaveSuccess, setWeekSaveSuccess] = useState(false)
  const [confirmDeleteHistoryId, setConfirmDeleteHistoryId] = useState<string | null>(null)

  // LinkedIn multi-account state
  const [liAccounts, setLiAccounts] = useState<LiAccountMetric[]>([])
  const [newLiAccount, setNewLiAccount] = useState({ account_name: '', accept_rate: '', reply_rate: '', offer_rate: '', calendly_rate: '', booking_rate: '', bookings: '' })
  const [addingLiAccount, setAddingLiAccount] = useState(false)
  const [editingLiAccountId, setEditingLiAccountId] = useState<string | null>(null)
  const [editingLiAccountForm, setEditingLiAccountForm] = useState<Partial<LiAccountMetric>>({})

  // Creatives state
  const [creatives, setCreatives] = useState<ClientCreative[]>([])
  const [addingCreative, setAddingCreative] = useState(false)
  const [creativeForm, setCreativeForm] = useState({
    title: '',
    type: 'image' as ClientCreative['type'],
    channel: '',
    status: 'active' as ClientCreative['status'],
    url: '',
    cpl: '',
    ctr: '',
    notes: '',
  })

  // Analysis videos (sales_materials type='video')
  const [salesMaterials, setSalesMaterials] = useState<SalesMaterialLocal[]>([])
  const [addingAnalysisVideo, setAddingAnalysisVideo] = useState(false)
  const [analysisForm, setAnalysisForm] = useState({ title: '', url: '', description: '' })

  // Client leads (for notes)
  const [clientLeads, setClientLeads] = useState<Array<{ id: string; lead_nombre: string; fecha_llamada?: string | null; notas?: string | null }>>([])
  const [expandedLead, setExpandedLead] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const [notesSaved, setNotesSaved] = useState<Record<string, boolean>>({})

  // Form state
  const [activePhaseId, setActivePhaseId] = useState('')
  const [daysInPhase, setDaysInPhase] = useState('')
  const [cpbcObj, setCpbcObj] = useState('')
  const [cpbcCurrent, setCpbcCurrent] = useState('')
  const [currentWin, setCurrentWin] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [lastCallDate, setLastCallDate] = useState('')
  const [contractDays, setContractDays] = useState<number>(90)
  const [clientForm, setClientForm] = useState({ name: '', email: '', country: '', canal: '', start_date: '', contract_days: 90 })
  const [savingClient, setSavingClient] = useState(false)
  const [clientSaveSuccess, setClientSaveSuccess] = useState(false)

  // New video form
  const [newVideos, setNewVideos] = useState<Partial<ClientVideo>[]>([])
  // New doc form
  const [newDocs, setNewDocs] = useState<Partial<Document>[]>([])

  // Phase editing
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [editPhaseName, setEditPhaseName] = useState('')
  const [editPhaseDesc, setEditPhaseDesc] = useState('')
  const [editPhaseVideoUrl, setEditPhaseVideoUrl] = useState('')
  const [addingPhase, setAddingPhase] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [newPhaseDesc, setNewPhaseDesc] = useState('')

  useEffect(() => {
    if (!id) return
    loadAll()
  }, [id])

  useEffect(() => {
    if (!id) return
    async function reloadLiAccounts() {
      const { data } = await supabase
        .from('li_account_metrics')
        .select('*')
        .eq('client_id', id)
        .eq('week_number', weekForm.week_number)
        .eq('year', weekForm.year)
        .order('account_name')
      setLiAccounts((data ?? []) as LiAccountMetric[])
    }
    reloadLiAccounts()
  }, [id, weekForm.week_number, weekForm.year])

  async function loadAll() {
    setLoading(true)
    try {
      const [
        clientRes,
        statusRes,
        phasesRes,
        videosRes,
        docsRes,
        registrosRes,
        historyRes,
        templatesRes,
        metricsConfigRes,
        metricsHistoryRes,
        creativesRes,
        salesMatsRes,
        leadsRes,
        liAccountsRes,
        allClientsRes,
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase
          .from('client_portal_status')
          .select('*')
          .eq('client_id', id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('client_phases').select('*').eq('client_id', id).order('phase_order'),
        supabase.from('client_videos').select('*').eq('client_id', id).order('sent_at', { ascending: false }),
        supabase.from('documents').select('*').eq('client_id', id).order('upload_date', { ascending: false }),
        supabase.from('registro_semanal_fullfillment').select('*').eq('client_id', id).order('fecha_inicio', { ascending: false }).limit(4),
        supabase.from('client_portal_status').select('*').eq('client_id', id).order('updated_at', { ascending: false }).limit(8),
        supabase.from('metrics_templates').select('*').order('name'),
        supabase.from('client_metrics_config').select('*').eq('client_id', id).maybeSingle(),
        supabase.from('client_metrics').select('*').eq('client_id', id).order('week_start', { ascending: false }).limit(8),
        supabase.from('client_creatives').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('sales_materials').select('*').eq('client_id', id).order('order_index', { ascending: true }),
        supabase.from('crm_clientes').select('id, lead_nombre, fecha_llamada, notas').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('li_account_metrics').select('*').eq('client_id', id).eq('week_number', weekForm.week_number).eq('year', weekForm.year).order('account_name'),
        supabase.from('clients').select('id, name').neq('id', id).order('name'),
      ])

      const clientData = clientRes.data as Client
      setClient(clientData)
      setContractDays(clientData.contract_days || 90)
      setClientForm({
        name: clientData.name || '',
        email: clientData.email || '',
        country: clientData.country || '',
        canal: clientData.canal || '',
        start_date: clientData.start_date || '',
        contract_days: clientData.contract_days || 90,
      })
      setPhases((phasesRes.data ?? []) as ClientPhase[])
      setVideos((videosRes.data ?? []) as ClientVideo[])
      setDocuments((docsRes.data ?? []) as Document[])
      setRegistros((registrosRes.data ?? []) as RegistroSemanal[])
      setHistory((historyRes.data ?? []) as ClientPortalStatus[])
      setTemplates((templatesRes.data ?? []) as MetricsTemplate[])
      setMetricsHistory((metricsHistoryRes.data ?? []) as ClientMetrics[])
      setCreatives((creativesRes.data ?? []) as ClientCreative[])
      setSalesMaterials((salesMatsRes.data ?? []) as SalesMaterialLocal[])
      setClientLeads((leadsRes.data ?? []) as Array<{ id: string; lead_nombre: string; fecha_llamada?: string | null; notas?: string | null }>)
      setLiAccounts((liAccountsRes.data ?? []) as LiAccountMetric[])
      setAllClients((allClientsRes.data ?? []) as { id: string; name: string }[])
      if (metricsConfigRes.data) {
        setMetricsConfig(metricsConfigRes.data as ClientMetricsConfig)
      } else {
        setMetricsConfig((prev) => ({ ...prev, client_id: id ?? '' }))
      }

      const st = statusRes.data as ClientPortalStatus | null
      setStatus(st)
      if (st) {
        setActivePhaseId(st.active_phase_id ?? '')
        setDaysInPhase(st.days_in_phase?.toString() ?? '')
        setCpbcObj(st.cpbc_objective?.toString() ?? '')
        setCpbcCurrent(st.cpbc_current?.toString() ?? '')
        setCurrentWin(st.current_win ?? '')
        setNextStep(st.next_step ?? '')
        setLastCallDate(st.last_call_date ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!id) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        client_id: id,
        active_phase_id: activePhaseId || null,
        days_in_phase: daysInPhase ? parseInt(daysInPhase) : null,
        cpbc_objective: cpbcObj ? parseFloat(cpbcObj) : null,
        cpbc_current: cpbcCurrent ? parseFloat(cpbcCurrent) : null,
        current_win: currentWin || null,
        next_step: nextStep || null,
        last_call_date: lastCallDate || null,
        updated_at: new Date().toISOString(),
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: existingToday } = await supabase
        .from('client_portal_status')
        .select('id')
        .eq('client_id', id)
        .gte('updated_at', today + 'T00:00:00')
        .lte('updated_at', today + 'T23:59:59')
        .maybeSingle()

      if (existingToday) {
        await supabase.from('client_portal_status').update(payload).eq('id', existingToday.id)
      } else {
        await supabase.from('client_portal_status').insert(payload)
      }

      // Save new videos
      const validVideos = newVideos.filter((v) => v.title && v.video_url)
      if (validVideos.length > 0) {
        await supabase.from('client_videos').insert(
          validVideos.map((v) => ({ ...v, client_id: id }))
        )
      }

      // Save new docs
      const validDocs = newDocs.filter((d) => d.name && d.file_url)
      if (validDocs.length > 0) {
        await supabase.from('documents').insert(
          validDocs.map((d) => ({ ...d, client_id: id }))
        )
      }

      const { error: contractDaysError } = await supabase
        .from('clients')
        .update({ contract_days: contractDays })
        .eq('id', id)
      if (contractDaysError) {
        console.log('contract_days error completo:', JSON.stringify(contractDaysError))
      }

      setNewVideos([])
      setNewDocs([])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  async function deleteVideo(vid: string) {
    await supabase.from('client_videos').delete().eq('id', vid)
    setVideos((prev) => prev.filter((v) => v.id !== vid))
  }

  async function deleteDocument(docId: string) {
    await supabase.from('documents').delete().eq('id', docId)
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
  }

  async function savePhaseEdit(phase: ClientPhase) {
    await supabase
      .from('client_phases')
      .update({ phase_name: editPhaseName, phase_description: editPhaseDesc, video_url: editPhaseVideoUrl || null })
      .eq('id', phase.id)
    setPhases((prev) =>
      prev.map((p) =>
        p.id === phase.id ? { ...p, phase_name: editPhaseName, phase_description: editPhaseDesc, video_url: editPhaseVideoUrl || undefined } : p
      )
    )
    setEditingPhaseId(null)
  }

  async function reloadAndRenumberPhases() {
    const { data: remainingPhases } = await supabase
      .from('client_phases')
      .select('*')
      .eq('client_id', id)
      .order('phase_order', { ascending: true })
    if (remainingPhases && remainingPhases.length > 0) {
      for (const [index, phase] of remainingPhases.entries()) {
        await supabase
          .from('client_phases')
          .update({ phase_order: index + 1 })
          .eq('id', phase.id)
      }
      setPhases(remainingPhases.map((phase, index) => ({ ...phase, phase_order: index + 1 })) as ClientPhase[])
    } else {
      setPhases([])
    }
  }

  async function deletePhase(phase: ClientPhase) {
    await supabase
      .from('client_portal_status')
      .update({ active_phase_id: null })
      .eq('active_phase_id', phase.id)
    await supabase.from('client_phases').delete().eq('id', phase.id)
    await reloadAndRenumberPhases()
  }

  async function reorderPhase(phase: ClientPhase, dir: 'up' | 'down') {
    const idx = phases.findIndex((p) => p.id === phase.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= phases.length) return
    const other = phases[swapIdx]
    await Promise.all([
      supabase.from('client_phases').update({ phase_order: other.phase_order }).eq('id', phase.id),
      supabase.from('client_phases').update({ phase_order: phase.phase_order }).eq('id', other.id),
    ])
    await reloadAndRenumberPhases()
  }

  async function addPhase() {
    if (!newPhaseName) return
    const maxOrder = phases.length > 0 ? Math.max(...phases.map((p) => p.phase_order)) + 1 : 1
    const { data } = await supabase
      .from('client_phases')
      .insert({ client_id: id, phase_order: maxOrder, phase_name: newPhaseName, phase_description: newPhaseDesc })
      .select()
      .single()
    if (data) setPhases((prev) => [...prev, data as ClientPhase])
    setAddingPhase(false)
    setNewPhaseName('')
    setNewPhaseDesc('')
  }

  async function handleSaveMetricsConfig() {
    if (!id) return
    console.log('Saving config:', { clientId: id, metricsConfig })
    try {
      if (metricsConfig.id && metricsConfig.id !== '') {
        const { data, error } = await supabase
          .from('client_metrics_config')
          .update({ ...metricsConfig, updated_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('id', metricsConfig.id)
        console.log('Supabase result:', { data, error })
      } else {
        const { id: _configId, ...configWithoutId } = metricsConfig
        const { data, error } = await supabase
          .from('client_metrics_config')
          .insert({ ...configWithoutId, client_id: id })
          .select()
          .single()
        console.log('Supabase result:', { data, error })
        if (data) setMetricsConfig(data as ClientMetricsConfig)
      }
      setConfigSaveSuccess(true)
      setTimeout(() => setConfigSaveSuccess(false), 2000)
    } catch (err) {
      console.error('Error guardando config de métricas:', err)
    }
  }

  async function handleSaveWeek() {
    if (!id) return
    console.log('Saving week:', { clientId: id, weekForm })
    try {
      const n = (v: string) => (v !== '' ? parseFloat(v) : null)
      const payload = {
        client_id: id,
        week_number: weekForm.week_number,
        year: weekForm.year,
        week_start: weekForm.week_start || new Date().toISOString().split('T')[0],
        week_end: weekForm.week_end || null,
        ads_investment: n(weekForm.ads_investment),
        ads_leads: n(weekForm.ads_leads),
        ads_cpl: n(weekForm.ads_cpl),
        ads_qualified_leads: n(weekForm.ads_qualified_leads),
        ads_bookings: n(weekForm.ads_bookings),
        ads_cpbc: n(weekForm.ads_cpbc),
        ads_show_rate: n(weekForm.ads_show_rate),
        ads_close_rate: n(weekForm.ads_close_rate),
        li_connections_sent: n(weekForm.li_connections_sent),
        li_connections_accepted: n(weekForm.li_connections_accepted),
        li_accept_rate: n(weekForm.li_accept_rate),
        li_messages_sent: n(weekForm.li_messages_sent),
        li_replies: n(weekForm.li_replies),
        li_reply_rate: n(weekForm.li_reply_rate),
        li_offer_rate: n(weekForm.li_offer_rate),
        li_calendly_rate: n(weekForm.li_calendly_rate),
        li_booking_rate: n(weekForm.li_booking_rate),
        li_bookings: n(weekForm.li_bookings),
      }

      const { data: existing, error: existingError } = await supabase
        .from('client_metrics')
        .select('id')
        .eq('client_id', id)
        .eq('week_number', weekForm.week_number)
        .eq('year', weekForm.year)
        .maybeSingle()
      console.log('Supabase result:', { data: existing, error: existingError })

      if (existing) {
        const { data, error } = await supabase
          .from('client_metrics')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        console.log('Supabase result:', { data, error })
      } else {
        const { data, error } = await supabase.from('client_metrics').insert(payload)
        console.log('Supabase result:', { data, error })
      }

      setWeekSaveSuccess(true)
      setTimeout(() => setWeekSaveSuccess(false), 2000)

      const { data: refreshed } = await supabase
        .from('client_metrics')
        .select('*')
        .eq('client_id', id)
        .order('week_start', { ascending: false })
        .limit(8)
      setMetricsHistory((refreshed ?? []) as ClientMetrics[])
    } catch (err) {
      console.error('Error guardando métricas:', err)
    }
  }

  function editWeek(m: ClientMetrics) {
    setWeekForm({
      week_number: m.week_number,
      year: m.year,
      week_start: m.week_start ?? '',
      week_end: (m as ClientMetrics & { week_end?: string }).week_end ?? '',
      ads_investment: m.ads_investment?.toString() ?? '',
      ads_leads: m.ads_leads?.toString() ?? '',
      ads_cpl: m.ads_cpl?.toString() ?? '',
      ads_qualified_leads: m.ads_qualified_leads?.toString() ?? '',
      ads_bookings: m.ads_bookings?.toString() ?? '',
      ads_cpbc: m.ads_cpbc?.toString() ?? '',
      ads_show_rate: m.ads_show_rate?.toString() ?? '',
      ads_close_rate: m.ads_close_rate?.toString() ?? '',
      li_connections_sent: m.li_connections_sent?.toString() ?? '',
      li_connections_accepted: m.li_connections_accepted?.toString() ?? '',
      li_accept_rate: m.li_accept_rate?.toString() ?? '',
      li_messages_sent: m.li_messages_sent?.toString() ?? '',
      li_replies: m.li_replies?.toString() ?? '',
      li_reply_rate: m.li_reply_rate?.toString() ?? '',
      li_offer_rate: m.li_offer_rate?.toString() ?? '',
      li_calendly_rate: m.li_calendly_rate?.toString() ?? '',
      li_booking_rate: m.li_booking_rate?.toString() ?? '',
      li_bookings: m.li_bookings?.toString() ?? '',
    })
  }

  async function deleteHistoryEntry(entryId: string) {
    await supabase.from('client_portal_status').delete().eq('id', entryId)
    setHistory((prev) => prev.filter((h) => h.id !== entryId))
    setConfirmDeleteHistoryId(null)
  }

  async function deleteCreative(creativeId: string) {
    if (!window.confirm('¿Eliminar este creativo?')) return
    await supabase.from('client_creatives').delete().eq('id', creativeId)
    setCreatives((prev) => prev.filter((c) => c.id !== creativeId))
  }

  async function handleAddCreative() {
    if (!id || !creativeForm.title || !creativeForm.url) return
    const { data } = await supabase
      .from('client_creatives')
      .insert({
        client_id: id,
        title: creativeForm.title,
        type: creativeForm.type,
        channel: creativeForm.channel || null,
        status: creativeForm.status,
        url: creativeForm.url,
        cpl: creativeForm.cpl ? parseFloat(creativeForm.cpl) : null,
        ctr: creativeForm.ctr ? parseFloat(creativeForm.ctr) : null,
        notes: creativeForm.notes || null,
      })
      .select()
      .single()
    if (data) {
      setCreatives((prev) => [data as ClientCreative, ...prev])
      setCreativeForm({ title: '', type: 'image', channel: '', status: 'active', url: '', cpl: '', ctr: '', notes: '' })
      setAddingCreative(false)
    }
  }

  async function deleteAnalysisVideo(materialId: string) {
    if (!window.confirm('¿Eliminar este video?')) return
    await supabase.from('sales_materials').delete().eq('id', materialId)
    setSalesMaterials((prev) => prev.filter((m) => m.id !== materialId))
  }

  async function handleAddAnalysisVideo() {
    if (!id || !analysisForm.title || !analysisForm.url) return
    const videoCount = salesMaterials.filter((m) => m.type === 'analysis_video').length
    const { data } = await supabase
      .from('sales_materials')
      .insert({
        client_id: id,
        title: analysisForm.title,
        type: 'analysis_video',
        url: analysisForm.url,
        description: analysisForm.description || null,
        order_index: videoCount,
      })
      .select()
      .single()
    if (data) {
      setSalesMaterials((prev) => [...prev, data as SalesMaterialLocal])
      setAnalysisForm({ title: '', url: '', description: '' })
      setAddingAnalysisVideo(false)
    }
  }

  async function handleAddLiAccount() {
    if (!id || !newLiAccount.account_name) return
    await supabase.from('li_account_metrics').insert({
      client_id: id,
      week_number: weekForm.week_number,
      year: weekForm.year,
      week_start: weekForm.week_start,
      account_name: newLiAccount.account_name,
      accept_rate: newLiAccount.accept_rate ? parseFloat(newLiAccount.accept_rate) : null,
      reply_rate: newLiAccount.reply_rate ? parseFloat(newLiAccount.reply_rate) : null,
      offer_rate: newLiAccount.offer_rate ? parseFloat(newLiAccount.offer_rate) : null,
      calendly_rate: newLiAccount.calendly_rate ? parseFloat(newLiAccount.calendly_rate) : null,
      booking_rate: newLiAccount.booking_rate ? parseFloat(newLiAccount.booking_rate) : null,
      bookings: newLiAccount.bookings ? parseInt(newLiAccount.bookings) : null,
    })
    const { data } = await supabase
      .from('li_account_metrics')
      .select('*')
      .eq('client_id', id)
      .eq('week_number', weekForm.week_number)
      .eq('year', weekForm.year)
      .order('account_name')
    setLiAccounts((data ?? []) as LiAccountMetric[])
    setNewLiAccount({ account_name: '', accept_rate: '', reply_rate: '', offer_rate: '', calendly_rate: '', booking_rate: '', bookings: '' })
    setAddingLiAccount(false)
  }

  async function handleDeleteLiAccount(accountId: string) {
    await supabase.from('li_account_metrics').delete().eq('id', accountId)
    setLiAccounts((prev) => prev.filter((a) => a.id !== accountId))
  }

  async function handleCopyPhases() {
    if (!copyTargetClientId) return
    setCopying(true)
    try {
      await supabase.from('client_phases').delete().eq('client_id', copyTargetClientId)
      const newPhases = phases.map(phase => ({
        client_id: copyTargetClientId,
        phase_order: phase.phase_order,
        phase_name: phase.phase_name,
        phase_description: phase.phase_description || null,
        video_url: phase.video_url || null,
      }))
      await supabase.from('client_phases').insert(newPhases)
      setCopySuccess(true)
      setTimeout(() => {
        setCopySuccess(false)
        setShowCopyModal(false)
        setCopyTargetClientId('')
      }, 2000)
    } catch (err) {
      console.error('Error copiando fases:', err)
    } finally {
      setCopying(false)
    }
  }

  async function handleSaveLiAccountEdit(accountId: string) {
    await supabase.from('li_account_metrics').update({
      account_name: editingLiAccountForm.account_name,
      accept_rate: editingLiAccountForm.accept_rate || null,
      reply_rate: editingLiAccountForm.reply_rate || null,
      offer_rate: editingLiAccountForm.offer_rate || null,
      calendly_rate: editingLiAccountForm.calendly_rate || null,
      booking_rate: editingLiAccountForm.booking_rate || null,
      bookings: editingLiAccountForm.bookings || null,
    }).eq('id', accountId)
    setEditingLiAccountId(null)
    const { data } = await supabase
      .from('li_account_metrics')
      .select('*')
      .eq('client_id', id)
      .eq('week_number', weekForm.week_number)
      .eq('year', weekForm.year)
      .order('account_name')
    setLiAccounts((data ?? []) as LiAccountMetric[])
  }

  async function handleSaveNotes(leadId: string) {
    const notes = editingNotes[leadId] ?? ''
    await supabase.from('crm_clientes').update({ notas: notes }).eq('id', leadId)
    setClientLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, notas: notes } : l))
    setNotesSaved((prev) => ({ ...prev, [leadId]: true }))
    setTimeout(() => setNotesSaved((prev) => ({ ...prev, [leadId]: false })), 2000)
  }

  async function handleClearNotes(leadId: string) {
    await supabase.from('crm_clientes').update({ notas: null }).eq('id', leadId)
    setClientLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, notas: null } : l))
    setEditingNotes((prev) => ({ ...prev, [leadId]: '' }))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 8,
    padding: '11px 14px',
    color: '#f0f1f7',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: '#8a8c9e',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: 500,
  }

  const sectionTitle: React.CSSProperties = {
    color: '#f0f1f7',
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#08090f' }}>
        <Navbar isAdmin showNav={false} />
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <Spinner size={36} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#08090f' }}>
      <Navbar isAdmin />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
        <Link to="/admin" style={{ color: '#8a8c9e', fontSize: 14, textDecoration: 'none', display: 'block', marginBottom: 24 }}>
          ← Volver
        </Link>

        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontFamily: 'Bricolage Grotesque, sans-serif',
              fontSize: 28,
              color: '#f0f1f7',
              margin: '0 0 4px',
            }}
          >
            {client?.name}
          </h1>
          <p style={{ color: '#555669', fontSize: 14, margin: 0 }}>{client?.email}</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 32 }}>
          {(['preview', 'phases', 'update'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #e5182b' : '2px solid transparent',
                padding: '12px 20px',
                color: tab === t ? '#f0f1f7' : '#555669',
                fontSize: 14,
                fontWeight: tab === t ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                marginBottom: -1,
                transition: 'color 0.2s',
              }}
            >
              {t === 'preview' ? 'Vista previa' : t === 'phases' ? 'Etapas' : 'Actualizar'}
            </button>
          ))}
        </div>

        {/* TAB: PREVIEW */}
        {tab === 'preview' && (
          <div>
            <div
              style={{
                backgroundColor: 'rgba(229,24,43,0.08)',
                borderBottom: '1px solid rgba(229,24,43,0.22)',
                padding: '10px 20px',
                marginBottom: 24,
                borderRadius: 8,
              }}
            >
              <span style={{ color: '#e5182b', fontSize: 13 }}>👁 Vista previa del cliente</span>
            </div>

            {!status ? (
              <p style={{ color: '#555669', textAlign: 'center', padding: 40 }}>
                Sin datos de portal todavía. Ve a "Actualizar" para configurarlo.
              </p>
            ) : (
              <div>
                {/* Hero */}
                <div
                  style={{
                    background: 'radial-gradient(ellipse at 50% 0%, rgba(229,24,43,0.06) 0%, transparent 65%), rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16,
                    padding: 36,
                    marginBottom: 32,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40 }}>
                    <div>
                      <div
                        style={{
                          display: 'inline-flex',
                          textTransform: 'uppercase',
                          fontSize: 11,
                          letterSpacing: '0.1em',
                          color: '#e5182b',
                          backgroundColor: 'rgba(229,24,43,0.10)',
                          border: '1px solid rgba(229,24,43,0.22)',
                          borderRadius: 99,
                          padding: '5px 14px',
                          marginBottom: 16,
                        }}
                      >
                        ETAPA ACTUAL
                      </div>
                      <h2
                        style={{
                          fontFamily: 'Bricolage Grotesque, sans-serif',
                          fontSize: 28,
                          color: '#f0f1f7',
                          margin: '0 0 12px',
                        }}
                      >
                        {phases.find((p) => p.id === status.active_phase_id)?.phase_name ?? 'Sin etapa'}
                      </h2>
                      <p style={{ color: '#8a8c9e', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
                        {phases.find((p) => p.id === status.active_phase_id)?.phase_description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Journey Map */}
                <div
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16,
                    padding: '48px 40px',
                    marginBottom: 32,
                    overflow: 'visible',
                  }}
                >
                  <JourneyMap
                    phases={phases}
                    active_phase_id={status.active_phase_id}
                    days_in_phase={status.days_in_phase}
                  />
                </div>

                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
                  <KpiCard label="AGENDAS" value={registros[0]?.agendas_generadas ?? null} colorLogic="neutral" />
                  <KpiCard label="SHOW RATE" value={pct(registros[0]?.show_rate)} suffix="%" objective={60} colorLogic="showRate" />
                  <KpiCard label="TASA CIERRE" value={pct(registros[0]?.tasa_cierre)} suffix="%" objective={25} colorLogic="closingRate" />
                  <KpiCard label="CPBC" value={status.cpbc_current} prefix="$" objective={status.cpbc_objective} colorLogic="cpbc" />
                </div>

                {/* Win + Next step */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
                  <div style={{ borderLeft: '3px solid #e5182b', borderTop: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', borderRadius: '0 16px 16px 0', backgroundColor: 'rgba(255,255,255,0.03)', padding: 24 }}>
                    <div style={{ color: '#e5182b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>ÚLTIMO RESULTADO</div>
                    <p style={{ color: '#f0f1f7', fontSize: 15, lineHeight: 1.7, margin: 0 }}>{status.current_win ?? '—'}</p>
                  </div>
                  <div style={{ borderLeft: '3px solid #60a5fa', borderTop: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', borderRadius: '0 16px 16px 0', backgroundColor: 'rgba(255,255,255,0.03)', padding: 24 }}>
                    <div style={{ color: '#60a5fa', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>PRÓXIMOS 7 DÍAS</div>
                    <p style={{ color: '#f0f1f7', fontSize: 15, lineHeight: 1.7, margin: 0 }}>{status.next_step ?? '—'}</p>
                  </div>
                </div>

                {/* Videos */}
                {videos.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
                      {videos.map((v) => <VideoCard key={v.id} video={v} />)}
                    </div>
                  </div>
                )}

                {/* Docs */}
                {documents.length > 0 && (
                  <div>
                    {documents.map((d) => <DocumentCard key={d.id} document={d} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: PHASES */}
        {tab === 'phases' && (
          <div>
            {error && (
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 16, backgroundColor: 'rgba(248,113,113,0.1)', padding: '10px 16px', borderRadius: 8 }}>
                {error}
              </div>
            )}

            {/* Botón copiar etapas */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                onClick={() => setShowCopyModal(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#8a8c9e',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#f0f1f7' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#8a8c9e' }}
              >
                Copiar etapas a otro cliente
              </button>
            </div>

            {/* Modal copiar etapas */}
            {showCopyModal && (
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
                onClick={() => setShowCopyModal(false)}
              >
                <div
                  style={{ width: '100%', maxWidth: '480px', background: '#0d0e17', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '32px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {copySuccess ? (
                    <div style={{ color: '#4ade80', fontSize: '16px', fontWeight: 700, textAlign: 'center', padding: '24px 0' }}>
                      ✓ Etapas copiadas exitosamente
                    </div>
                  ) : (
                    <>
                      <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: '20px', fontWeight: 800, color: '#f0f1f7', margin: '0 0 8px' }}>
                        Copiar etapas a otro cliente
                      </h2>
                      <p style={{ color: '#f87171', fontSize: '13px', margin: '0 0 24px' }}>
                        Las etapas actuales del cliente destino serán reemplazadas.
                      </p>

                      <p style={{ color: '#8a8c9e', fontSize: '13px', margin: '0 0 12px' }}>
                        Se copiarán estas {phases.length} etapas:
                      </p>
                      <div style={{ marginBottom: '8px' }}>
                        {phases.map((phase) => (
                          <div key={phase.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#e5182b', color: 'white', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {phase.phase_order}
                            </div>
                            <span style={{ color: '#f0f1f7', fontSize: '14px' }}>{phase.phase_name}</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />

                      <label style={{ display: 'block', color: '#8a8c9e', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                        Copiar a:
                      </label>
                      <select
                        value={copyTargetClientId}
                        onChange={(e) => setCopyTargetClientId(e.target.value)}
                        style={{ width: '100%', background: '#080910', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: '#f0f1f7', fontSize: '14px', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        <option value="">Seleccionar cliente...</option>
                        {allClients.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>

                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                        <button
                          onClick={() => setShowCopyModal(false)}
                          style={{ padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#f0f1f7', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleCopyPhases}
                          disabled={!copyTargetClientId || copying}
                          style={{ padding: '10px 20px', backgroundColor: '#e5182b', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: !copyTargetClientId || copying ? 'not-allowed' : 'pointer', opacity: copying ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }}
                        >
                          {copying ? 'Copiando...' : 'Copiar etapas →'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {phases.map((phase, i) => (
              <div
                key={phase.id}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                {editingPhaseId === phase.id ? (
                  <div style={{ overflow: 'visible', height: 'auto' }}>
                    <input
                      value={editPhaseName}
                      onChange={(e) => setEditPhaseName(e.target.value)}
                      style={{ ...inputStyle, marginBottom: 10 }}
                    />
                    <textarea
                      value={editPhaseDesc}
                      onChange={(e) => setEditPhaseDesc(e.target.value)}
                      style={{ ...inputStyle, resize: 'vertical', height: '80px', marginBottom: 12 }}
                    />
                    <div style={{ marginTop: 12, marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#8a8c9e', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        URL del video explicativo (YouTube o Loom) — opcional
                      </label>
                      <input
                        type="text"
                        placeholder="https://youtube.com/watch?v=... o https://loom.com/share/..."
                        value={editPhaseVideoUrl}
                        onChange={(e) => setEditPhaseVideoUrl(e.target.value)}
                        style={{ ...inputStyle }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => savePhaseEdit(phase)}
                        style={{ backgroundColor: '#e5182b', border: 'none', borderRadius: 6, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingPhaseId(null)}
                        style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 16px', color: '#f0f1f7', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(201,168,76,0.15)',
                        border: '1px solid rgba(201,168,76,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#c9a84c',
                        fontWeight: 700,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {phase.phase_order}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{phase.phase_name}</div>
                      <div style={{ color: '#8a8c9e', fontSize: 13, lineHeight: 1.5 }}>{phase.phase_description}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => reorderPhase(phase, 'up')}
                        disabled={i === 0}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6, padding: '4px 8px', color: i === 0 ? '#333' : '#8a8c9e', cursor: i === 0 ? 'default' : 'pointer', fontSize: 12 }}
                      >↑</button>
                      <button
                        onClick={() => reorderPhase(phase, 'down')}
                        disabled={i === phases.length - 1}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6, padding: '4px 8px', color: i === phases.length - 1 ? '#333' : '#8a8c9e', cursor: i === phases.length - 1 ? 'default' : 'pointer', fontSize: 12 }}
                      >↓</button>
                      <button
                        onClick={() => { setEditingPhaseId(phase.id); setEditPhaseName(phase.phase_name); setEditPhaseDesc(phase.phase_description ?? ''); setEditPhaseVideoUrl(phase.video_url ?? '') }}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6, padding: '4px 10px', color: '#8a8c9e', cursor: 'pointer', fontSize: 12 }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deletePhase(phase)}
                        style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '4px 10px', color: '#f87171', cursor: 'pointer', fontSize: 12 }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addingPhase ? (
              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 12,
                }}
              >
                <input
                  placeholder="Nombre de la etapa"
                  value={newPhaseName}
                  onChange={(e) => setNewPhaseName(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 10 }}
                />
                <textarea
                  placeholder="Descripción"
                  value={newPhaseDesc}
                  onChange={(e) => setNewPhaseDesc(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={addPhase}
                    style={{ backgroundColor: '#e5182b', border: 'none', borderRadius: 6, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    Guardar etapa
                  </button>
                  <button
                    onClick={() => setAddingPhase(false)}
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 16px', color: '#f0f1f7', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingPhase(true)}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: '2px dashed rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  padding: 16,
                  color: '#555669',
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(229,24,43,0.3)'; e.currentTarget.style.color = '#e5182b' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#555669' }}
              >
                + Agregar etapa
              </button>
            )}
          </div>
        )}

        {/* TAB: UPDATE */}
        {tab === 'update' && (
          <div>
            {/* DATOS DEL CLIENTE */}
            <div style={{ marginBottom: 32, padding: '20px 24px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#8a8c9e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px', marginTop: 0 }}>
                DATOS DEL CLIENTE
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nombre</label>
                  <input type="text" value={clientForm.name} onChange={(e) => setClientForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={clientForm.email} onChange={(e) => setClientForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>País</label>
                  <input type="text" value={clientForm.country} onChange={(e) => setClientForm(p => ({ ...p, country: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Canal</label>
                  <select value={clientForm.canal} onChange={(e) => setClientForm(p => ({ ...p, canal: e.target.value }))} style={{ ...inputStyle, backgroundColor: '#0d0e17' }}>
                    <option value="">Sin canal</option>
                    <option value="Meta Ads">Meta Ads</option>
                    <option value="LinkedIn Outbound">LinkedIn Outbound</option>
                    <option value="Híbrido">Híbrido</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Fecha de inicio del servicio</label>
                  <input type="date" value={clientForm.start_date} onChange={(e) => setClientForm(p => ({ ...p, start_date: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={labelStyle}>Duración (días)</label>
                  <input type="number" value={clientForm.contract_days} onChange={(e) => setClientForm(p => ({ ...p, contract_days: parseInt(e.target.value) || 90 }))} style={inputStyle} min="1" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                <button
                  onClick={async () => {
                    setSavingClient(true)
                    const { error: clientErr } = await supabase.from('clients').update({
                      name: clientForm.name,
                      email: clientForm.email,
                      country: clientForm.country,
                      canal: clientForm.canal || null,
                      start_date: clientForm.start_date || null,
                      contract_days: clientForm.contract_days,
                    }).eq('id', id)
                    if (!clientErr) {
                      setClientSaveSuccess(true)
                      setTimeout(() => setClientSaveSuccess(false), 2000)
                    }
                    setSavingClient(false)
                  }}
                  disabled={savingClient}
                  style={{ padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#f0f1f7', fontSize: 14, fontWeight: 600, cursor: savingClient ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', opacity: savingClient ? 0.7 : 1 }}
                >
                  Guardar datos del cliente
                </button>
                {clientSaveSuccess && <span style={{ color: '#4ade80', fontSize: 13 }}>✓ Datos guardados</span>}
              </div>
            </div>

            {/* CONFIGURACIÓN DE MÉTRICAS */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>CONFIGURACIÓN DE MÉTRICAS</p>

              {/* Selector de plantilla */}
              {templates.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: '#8a8c9e', fontSize: '12px', marginBottom: '8px' }}>
                    Aplicar plantilla:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() =>
                          setMetricsConfig((prev) => ({
                            ...prev,
                            show_ads_section: t.show_ads_section,
                            show_li_section: t.show_li_section,
                            show_ads_investment: t.show_ads_investment,
                            show_ads_leads: t.show_ads_leads,
                            show_ads_cpl: t.show_ads_cpl,
                            show_ads_qualified: t.show_ads_qualified,
                            show_ads_cpbc: t.show_ads_cpbc,
                            show_ads_show_rate: t.show_ads_show_rate,
                            show_ads_close_rate: t.show_ads_close_rate,
                            show_li_accept_rate: t.show_li_accept_rate,
                            show_li_reply_rate: t.show_li_reply_rate,
                            show_li_offer_rate: t.show_li_offer_rate,
                            show_li_calendly_rate: t.show_li_calendly_rate,
                            show_li_booking_rate: t.show_li_booking_rate,
                            show_li_bookings: t.show_li_bookings,
                            template_name: t.name,
                          }))
                        }
                        style={{
                          padding: '6px 14px',
                          borderRadius: '99px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: 'none',
                          fontFamily: 'DM Sans, sans-serif',
                          ...(t.name === metricsConfig.template_name
                            ? {
                                background: 'rgba(229,24,43,0.15)',
                                outline: '1px solid rgba(229,24,43,0.4)',
                                color: '#e5182b',
                              }
                            : {
                                background: 'rgba(255,255,255,0.04)',
                                outline: '1px solid rgba(255,255,255,0.1)',
                                color: '#8a8c9e',
                              }),
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Toggles de secciones */}
              {[
                { key: 'show_ads_section' as const, label: 'Mostrar sección Meta Ads' },
                { key: 'show_li_section' as const, label: 'Mostrar sección LinkedIn' },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '10px',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ color: '#f0f1f7', fontSize: 14 }}>{label}</span>
                  <div
                    onClick={() => setMetricsConfig((p) => ({ ...p, [key]: !p[key] }))}
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: metricsConfig[key] ? '#e5182b' : 'rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        position: 'absolute',
                        top: 2,
                        left: metricsConfig[key] ? 20 : 2,
                        transition: 'left 0.2s',
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Toggles métricas Ads */}
              {metricsConfig.show_ads_section && (
                <div style={{ marginTop: 16, marginBottom: 8 }}>
                  <div style={{ color: '#8a8c9e', fontSize: '12px', marginBottom: '10px' }}>
                    Métricas de Ads a mostrar:
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0 24px',
                    }}
                  >
                    {([
                      ['show_ads_investment', 'Inversión'],
                      ['show_ads_leads', 'Leads'],
                      ['show_ads_cpl', 'CPL'],
                      ['show_ads_qualified', 'Leads cal.'],
                      ['show_ads_cpbc', 'CPBC'],
                      ['show_ads_show_rate', 'Show rate'],
                      ['show_ads_close_rate', 'Close rate'],
                    ] as [keyof ClientMetricsConfig, string][]).map(([key, label]) => (
                      <div
                        key={key}
                        onClick={() =>
                          setMetricsConfig((p) => ({ ...p, [key]: !p[key] }))
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 0',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 3,
                            backgroundColor: metricsConfig[key] ? '#e5182b' : 'transparent',
                            border: metricsConfig[key]
                              ? '1px solid #e5182b'
                              : '1px solid rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {metricsConfig[key] && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path
                                d="M1 4l3 3 5-5"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        <span style={{ color: '#8a8c9e', fontSize: 13 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Toggles métricas LinkedIn */}
              {metricsConfig.show_li_section && (
                <div style={{ marginTop: 16, marginBottom: 8 }}>
                  <div style={{ color: '#8a8c9e', fontSize: '12px', marginBottom: '10px' }}>
                    Métricas de LinkedIn a mostrar:
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0 24px',
                    }}
                  >
                    {([
                      ['show_li_accept_rate', 'Accept rate'],
                      ['show_li_reply_rate', 'Reply rate'],
                      ['show_li_offer_rate', 'Offer rate'],
                      ['show_li_calendly_rate', 'Calendly rate'],
                      ['show_li_booking_rate', 'Booking rate'],
                      ['show_li_bookings', 'Agendas'],
                    ] as [keyof ClientMetricsConfig, string][]).map(([key, label]) => (
                      <div
                        key={key}
                        onClick={() =>
                          setMetricsConfig((p) => ({ ...p, [key]: !p[key] }))
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 0',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 3,
                            backgroundColor: metricsConfig[key] ? '#e5182b' : 'transparent',
                            border: metricsConfig[key]
                              ? '1px solid #e5182b'
                              : '1px solid rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {metricsConfig[key] && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path
                                d="M1 4l3 3 5-5"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        <span style={{ color: '#8a8c9e', fontSize: 13 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón guardar config */}
              {configSaveSuccess && (
                <div style={{ color: '#4ade80', fontSize: 13, marginTop: 12 }}>
                  ✓ Configuración guardada
                </div>
              )}
              <button
                onClick={handleSaveMetricsConfig}
                style={{
                  width: '100%',
                  marginTop: 16,
                  marginBottom: 32,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '12px',
                  color: '#f0f1f7',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Guardar configuración de métricas
              </button>

              {/* Carga de métricas semanales */}
              <p style={sectionTitle}>MÉTRICAS DE ESTA SEMANA</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Semana número</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={weekForm.week_number}
                    onChange={(e) =>
                      setWeekForm((p) => ({ ...p, week_number: parseInt(e.target.value) || 1 }))
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Año</label>
                  <input
                    type="number"
                    value={weekForm.year}
                    onChange={(e) =>
                      setWeekForm((p) => ({ ...p, year: parseInt(e.target.value) || new Date().getFullYear() }))
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Fecha inicio semana</label>
                  <input
                    type="date"
                    value={weekForm.week_start}
                    onChange={(e) => setWeekForm((p) => ({ ...p, week_start: e.target.value }))}
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Fecha fin de semana</label>
                  <input
                    type="date"
                    value={weekForm.week_end}
                    onChange={(e) => setWeekForm((p) => ({ ...p, week_end: e.target.value }))}
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                  />
                </div>
              </div>

              {metricsConfig.show_ads_section && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: '#8a8c9e', fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Meta Ads
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {([
                      ['ads_investment', 'Inversión ($)'],
                      ['ads_leads', 'Leads generados'],
                      ['ads_cpl', 'CPL ($)'],
                      ['ads_qualified_leads', 'Leads calificados'],
                      ['ads_bookings', 'Agendas'],
                      ['ads_cpbc', 'CPBC ($)'],
                      ['ads_show_rate', 'Show rate (%)'],
                      ['ads_close_rate', 'Close rate (%)'],
                    ] as [keyof typeof weekForm, string][]).map(([key, label]) => (
                      <div key={key}>
                        <label style={labelStyle}>{label}</label>
                        <input
                          type="number"
                          value={weekForm[key] as string}
                          onChange={(e) => setWeekForm((p) => ({ ...p, [key]: e.target.value }))}
                          style={inputStyle}
                          step="any"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {metricsConfig.show_li_section && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 600, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    CUENTAS DE LINKEDIN
                  </div>

                  {/* Resumen automático */}
                  {liAccounts.length > 0 && (() => {
                    const avgField = (field: keyof LiAccountMetric) => {
                      const vals = liAccounts.map(a => a[field] as number).filter(v => v != null && v > 0)
                      return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null
                    }
                    const totalBookings = liAccounts.reduce((sum, a) => sum + (a.bookings || 0), 0)
                    return (
                      <div style={{ backgroundColor: 'rgba(192,132,252,0.06)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>PROMEDIOS CALCULADOS</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          {(['accept_rate', 'reply_rate', 'offer_rate', 'calendly_rate', 'booking_rate'] as (keyof LiAccountMetric)[]).map(field => {
                            const val = avgField(field)
                            return (
                              <div key={field} style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 12px' }}>
                                <div style={{ fontSize: 10, color: '#555669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{String(field).replace('_rate', ' rate').replace('_', ' ')}</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: val != null ? '#c084fc' : '#333' }}>{val != null ? `${val}%` : '—'}</div>
                              </div>
                            )
                          })}
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 12px' }}>
                            <div style={{ fontSize: 10, color: '#555669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>agendas total</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#c084fc' }}>{totalBookings}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Lista de cuentas */}
                  {liAccounts.map(account => (
                    <div key={account.id} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }}>
                      {editingLiAccountId === account.id ? (
                        <div>
                          <div style={{ marginBottom: 10 }}>
                            <label style={labelStyle}>Nombre de cuenta *</label>
                            <input
                              type="text"
                              value={editingLiAccountForm.account_name ?? ''}
                              onChange={(e) => setEditingLiAccountForm(p => ({ ...p, account_name: e.target.value }))}
                              style={inputStyle}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                            {([
                              ['accept_rate', 'Accept rate (%)'],
                              ['reply_rate', 'Reply rate (%)'],
                              ['offer_rate', 'Offer rate (%)'],
                              ['calendly_rate', 'Calendly rate (%)'],
                              ['booking_rate', 'Booking rate (%)'],
                              ['bookings', 'Agendas'],
                            ] as [keyof LiAccountMetric, string][]).map(([field, label]) => (
                              <div key={field}>
                                <label style={labelStyle}>{label}</label>
                                <input
                                  type="number"
                                  value={(editingLiAccountForm[field] as number | undefined) ?? ''}
                                  onChange={(e) => setEditingLiAccountForm(p => ({ ...p, [field]: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                                  style={inputStyle}
                                  step="any"
                                />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => handleSaveLiAccountEdit(account.id)}
                              style={{ backgroundColor: '#e5182b', border: 'none', borderRadius: 6, padding: '7px 14px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingLiAccountId(null)}
                              style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '7px 14px', color: '#f0f1f7', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 700 }}>{account.account_name}</span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => { setEditingLiAccountId(account.id); setEditingLiAccountForm({ account_name: account.account_name, accept_rate: account.accept_rate, reply_rate: account.reply_rate, offer_rate: account.offer_rate, calendly_rate: account.calendly_rate, booking_rate: account.booking_rate, bookings: account.bookings }) }}
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6, padding: '3px 10px', color: '#8a8c9e', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                              >
                                Editar
                              </button>
                              <button onClick={() => handleDeleteLiAccount(account.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}>✕</button>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            {[
                              { label: 'Accept rate', value: account.accept_rate },
                              { label: 'Reply rate', value: account.reply_rate },
                              { label: 'Offer rate', value: account.offer_rate },
                              { label: 'Calendly rate', value: account.calendly_rate },
                              { label: 'Booking rate', value: account.booking_rate },
                              { label: 'Agendas', value: account.bookings, noSuffix: true },
                            ].map(({ label, value, noSuffix }) => (
                              <div key={label}>
                                <div style={{ fontSize: 10, color: '#555669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
                                <div style={{ fontSize: 14, color: value != null ? '#8a8c9e' : '#555669' }}>{value != null ? `${value}${noSuffix ? '' : '%'}` : '—'}</div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Form nueva cuenta */}
                  {addingLiAccount ? (
                    <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 16, marginBottom: 8 }}>
                      <div style={{ marginBottom: 12 }}>
                        <label style={labelStyle}>Nombre de cuenta *</label>
                        <input
                          type="text"
                          placeholder="Ej: Cuenta Daniela"
                          value={newLiAccount.account_name}
                          onChange={(e) => setNewLiAccount(p => ({ ...p, account_name: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        {([
                          ['accept_rate', 'Accept rate (%)'],
                          ['reply_rate', 'Reply rate (%)'],
                          ['offer_rate', 'Offer rate (%)'],
                          ['calendly_rate', 'Calendly rate (%)'],
                          ['booking_rate', 'Booking rate (%)'],
                          ['bookings', 'Agendas'],
                        ] as [keyof typeof newLiAccount, string][]).map(([key, label]) => (
                          <div key={key}>
                            <label style={labelStyle}>{label}</label>
                            <input
                              type="number"
                              value={newLiAccount[key]}
                              onChange={(e) => setNewLiAccount(p => ({ ...p, [key]: e.target.value }))}
                              style={inputStyle}
                              step="any"
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={handleAddLiAccount}
                          style={{ backgroundColor: '#e5182b', border: 'none', borderRadius: 6, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                        >
                          Agregar cuenta
                        </button>
                        <button
                          onClick={() => { setAddingLiAccount(false); setNewLiAccount({ account_name: '', accept_rate: '', reply_rate: '', offer_rate: '', calendly_rate: '', booking_rate: '', bookings: '' }) }}
                          style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 16px', color: '#f0f1f7', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingLiAccount(true)}
                      style={{ width: '100%', backgroundColor: 'transparent', border: '2px dashed rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 16px', color: '#555669', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      + Agregar cuenta
                    </button>
                  )}
                </div>
              )}

              {weekSaveSuccess && (
                <div style={{ color: '#4ade80', fontSize: 13, marginBottom: 8 }}>
                  ✓ Métricas guardadas
                </div>
              )}
              <button
                onClick={handleSaveWeek}
                style={{
                  width: '100%',
                  backgroundColor: '#e5182b',
                  border: 'none',
                  borderRadius: 8,
                  padding: '14px',
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  marginBottom: 24,
                }}
              >
                Guardar métricas de la semana
              </button>

              {/* Historial semanas */}
              {metricsHistory.length > 0 && (
                <div>
                  <div style={{ color: '#8a8c9e', fontSize: 12, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Semanas cargadas
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Semana', 'Agendas', 'CPBC', 'Fecha', ''].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: 'left',
                              color: '#555669',
                              fontWeight: 600,
                              padding: '8px 12px',
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metricsHistory.map((m) => (
                        <tr key={m.id}>
                          <td style={{ padding: '10px 12px', color: '#f0f1f7' }}>
                            S{m.week_number} / {m.year}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#8a8c9e' }}>
                            {m.ads_bookings ?? m.li_bookings ?? '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#8a8c9e' }}>
                            {m.ads_cpbc ? `$${m.ads_cpbc}` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#555669' }}>
                            {formatWeekRange(m.week_start, (m as ClientMetrics & { week_end?: string }).week_end)}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <button
                              onClick={() => editWeek(m)}
                              style={{
                                background: 'none',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 6,
                                padding: '4px 10px',
                                color: '#8a8c9e',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontFamily: 'DM Sans, sans-serif',
                              }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('¿Eliminar métricas de esta semana?')) {
                                  await supabase.from('client_metrics').delete().eq('id', m.id)
                                  const { data } = await supabase
                                    .from('client_metrics')
                                    .select('*')
                                    .eq('client_id', id)
                                    .order('week_start', { ascending: false })
                                    .limit(8)
                                  setMetricsHistory((data ?? []) as ClientMetrics[])
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                fontSize: 14,
                                marginLeft: 8,
                              }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {success && (
              <div style={{ backgroundColor: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, padding: '12px 20px', color: '#4ade80', fontSize: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                Dashboard actualizado ✓
              </div>
            )}
            {error && (
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 16, backgroundColor: 'rgba(248,113,113,0.1)', padding: '10px 16px', borderRadius: 8 }}>
                {error}
              </div>
            )}

            {/* PROGRESO */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>PROGRESO</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Etapa activa</label>
                  <select
                    value={activePhaseId}
                    onChange={(e) => setActivePhaseId(e.target.value)}
                    style={{ ...inputStyle, backgroundColor: '#0d0e17' }}
                  >
                    <option value="">Sin etapa activa</option>
                    {phases.map((p) => (
                      <option key={p.id} value={p.id}>{p.phase_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Días en esta etapa</label>
                  <input type="number" value={daysInPhase} onChange={(e) => setDaysInPhase(e.target.value)} style={inputStyle} min="0" />
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>KPIs</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>CPBC objetivo (USD)</label>
                  <input type="number" value={cpbcObj} onChange={(e) => setCpbcObj(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>CPBC actual (USD)</label>
                  <input type="number" value={cpbcCurrent} onChange={(e) => setCpbcCurrent(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>

            {/* MENSAJE AL CLIENTE */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>MENSAJE AL CLIENTE</p>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Último resultado</label>
                <textarea
                  value={currentWin}
                  onChange={(e) => setCurrentWin(e.target.value)}
                  rows={4}
                  placeholder="¿Cuál fue el mejor resultado de las últimas 2 semanas?"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Próximos 7 días</label>
                <textarea
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  rows={3}
                  placeholder="Una sola promesa concreta."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </div>

            {/* COMUNICACIÓN */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>COMUNICACIÓN</p>
              <div>
                <label style={labelStyle}>Fecha última call</label>
                <input type="date" value={lastCallDate} onChange={(e) => setLastCallDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            {/* VIDEOS */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>VIDEOS</p>
              {videos.map((v) => (
                <div
                  key={v.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 8 }}
                >
                  <div>
                    <div style={{ color: '#f0f1f7', fontSize: 13, fontWeight: 600 }}>{v.title}</div>
                    <div style={{ color: '#555669', fontSize: 12 }}>{v.video_url}</div>
                  </div>
                  <button
                    onClick={() => deleteVideo(v.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              {newVideos.map((v, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16, marginBottom: 12 }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>Título</label>
                      <input
                        value={v.title ?? ''}
                        onChange={(e) => {
                          const updated = [...newVideos]
                          updated[i] = { ...updated[i], title: e.target.value }
                          setNewVideos(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>URL</label>
                      <input
                        value={v.video_url ?? ''}
                        onChange={(e) => {
                          const updated = [...newVideos]
                          updated[i] = { ...updated[i], video_url: e.target.value }
                          setNewVideos(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Descripción</label>
                      <input
                        value={v.description ?? ''}
                        onChange={(e) => {
                          const updated = [...newVideos]
                          updated[i] = { ...updated[i], description: e.target.value }
                          setNewVideos(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Fecha enviado</label>
                      <input
                        type="date"
                        value={v.sent_at ?? ''}
                        onChange={(e) => {
                          const updated = [...newVideos]
                          updated[i] = { ...updated[i], sent_at: e.target.value }
                          setNewVideos(updated)
                        }}
                        style={{ ...inputStyle, colorScheme: 'dark' }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setNewVideos(newVideos.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12 }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                onClick={() => setNewVideos([...newVideos, {}])}
                style={{
                  backgroundColor: 'transparent',
                  border: '2px dashed rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '10px 16px',
                  color: '#555669',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                + Agregar video
              </button>
            </div>

            {/* DOCUMENTOS */}
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>DOCUMENTOS</p>
              {documents.map((d) => (
                <div
                  key={d.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, marginBottom: 8 }}
                >
                  <div>
                    <div style={{ color: '#f0f1f7', fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ color: '#555669', fontSize: 12 }}>{d.file_url}</div>
                  </div>
                  <button
                    onClick={() => deleteDocument(d.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
              {newDocs.map((d, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16, marginBottom: 12 }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>Nombre</label>
                      <input
                        value={d.name ?? ''}
                        onChange={(e) => {
                          const updated = [...newDocs]
                          updated[i] = { ...updated[i], name: e.target.value }
                          setNewDocs(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>URL</label>
                      <input
                        value={d.file_url ?? ''}
                        onChange={(e) => {
                          const updated = [...newDocs]
                          updated[i] = { ...updated[i], file_url: e.target.value }
                          setNewDocs(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Descripción</label>
                      <input
                        value={d.description ?? ''}
                        onChange={(e) => {
                          const updated = [...newDocs]
                          updated[i] = { ...updated[i], description: e.target.value }
                          setNewDocs(updated)
                        }}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Tipo</label>
                      <select
                        value={d.file_type ?? 'pdf'}
                        onChange={(e) => {
                          const updated = [...newDocs]
                          updated[i] = { ...updated[i], file_type: e.target.value }
                          setNewDocs(updated)
                        }}
                        style={{ ...inputStyle, backgroundColor: '#0d0e17' }}
                      >
                        <option value="pdf">PDF</option>
                        <option value="google_doc">Google Doc</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Fecha</label>
                      <input
                        type="date"
                        value={d.upload_date ?? ''}
                        onChange={(e) => {
                          const updated = [...newDocs]
                          updated[i] = { ...updated[i], upload_date: e.target.value }
                          setNewDocs(updated)
                        }}
                        style={{ ...inputStyle, colorScheme: 'dark' }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setNewDocs(newDocs.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12 }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                onClick={() => setNewDocs([...newDocs, {}])}
                style={{
                  backgroundColor: 'transparent',
                  border: '2px dashed rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '10px 16px',
                  color: '#555669',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                + Agregar documento
              </button>
            </div>

            {/* CREATIVOS — temporalmente oculto */}
            {(false as boolean) && (
            <div style={{ marginBottom: 32 }}>
              <p style={sectionTitle}>CREATIVOS</p>

              {creatives.map((c) => (
                <div
                  key={c.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', marginBottom: '8px' }}
                >
                  {/* Type badge */}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                    ...(c.type === 'image' ? { background: '#1a0807', color: '#fb923c' }
                      : c.type === 'video' ? { background: '#071228', color: '#60a5fa' }
                      : { background: '#0f0720', color: '#c084fc' }),
                  }}>
                    {c.type === 'image' ? 'Imagen' : c.type === 'video' ? 'Video' : 'Copy'}
                  </span>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#f0f1f7', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{c.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase',
                        ...(c.status === 'active' ? { background: 'rgba(74,222,128,0.15)', color: '#4ade80' }
                          : c.status === 'paused' ? { background: 'rgba(252,211,77,0.15)', color: '#fcd34d' }
                          : { background: 'rgba(255,255,255,0.06)', color: '#555669' }),
                      }}>
                        {c.status === 'active' ? 'Activo' : c.status === 'paused' ? 'Pausado' : 'Archivado'}
                      </span>
                      <span style={{ color: '#555669', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.url}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteCreative(c.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16, padding: '2px 6px', flexShrink: 0, lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {addingCreative ? (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 16, marginTop: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>Título *</label>
                      <input
                        value={creativeForm.title}
                        onChange={(e) => setCreativeForm((p) => ({ ...p, title: e.target.value }))}
                        style={inputStyle}
                        placeholder="Nombre del creativo"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Tipo *</label>
                      <select
                        value={creativeForm.type}
                        onChange={(e) => setCreativeForm((p) => ({ ...p, type: e.target.value as ClientCreative['type'] }))}
                        style={{ ...inputStyle, backgroundColor: '#0d0e17' }}
                      >
                        <option value="image">Imagen</option>
                        <option value="video">Video</option>
                        <option value="copy">Copy</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Canal</label>
                      <select
                        value={creativeForm.channel}
                        onChange={(e) => setCreativeForm((p) => ({ ...p, channel: e.target.value }))}
                        style={{ ...inputStyle, backgroundColor: '#0d0e17' }}
                      >
                        <option value="">Sin canal</option>
                        <option value="Meta Ads">Meta Ads</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Ambos">Ambos</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Estado</label>
                      <select
                        value={creativeForm.status}
                        onChange={(e) => setCreativeForm((p) => ({ ...p, status: e.target.value as ClientCreative['status'] }))}
                        style={{ ...inputStyle, backgroundColor: '#0d0e17' }}
                      >
                        <option value="active">Activo</option>
                        <option value="paused">Pausado</option>
                        <option value="archived">Archivado</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>
                      URL *{' '}
                      <span style={{ color: '#555669', fontWeight: 400 }}>
                        {creativeForm.type === 'image' ? '— https://drive.google.com/... o URL directa'
                          : creativeForm.type === 'video' ? '— https://youtube.com/... o https://loom.com/...'
                          : '— Pegá el copy aquí o link a Google Doc'}
                      </span>
                    </label>
                    <input
                      value={creativeForm.url}
                      onChange={(e) => setCreativeForm((p) => ({ ...p, url: e.target.value }))}
                      style={inputStyle}
                      placeholder={
                        creativeForm.type === 'image' ? 'https://drive.google.com/... o URL directa'
                          : creativeForm.type === 'video' ? 'https://youtube.com/... o https://loom.com/...'
                          : 'Pegá el copy aquí o link a Google Doc'
                      }
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>CPL (opcional)</label>
                      <input
                        type="number"
                        value={creativeForm.cpl}
                        onChange={(e) => setCreativeForm((p) => ({ ...p, cpl: e.target.value }))}
                        style={inputStyle}
                        placeholder="$0"
                        step="any"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>CTR (opcional)</label>
                      <input
                        type="number"
                        value={creativeForm.ctr}
                        onChange={(e) => setCreativeForm((p) => ({ ...p, ctr: e.target.value }))}
                        style={inputStyle}
                        placeholder="0%"
                        step="any"
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Notas (opcional)</label>
                    <textarea
                      value={creativeForm.notes}
                      onChange={(e) => setCreativeForm((p) => ({ ...p, notes: e.target.value }))}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleAddCreative}
                      style={{ backgroundColor: '#e5182b', border: 'none', borderRadius: 6, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      Agregar
                    </button>
                    <button
                      onClick={() => setAddingCreative(false)}
                      style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 16px', color: '#f0f1f7', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingCreative(true)}
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    border: '2px dashed rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    padding: '10px 16px',
                    color: '#555669',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                    marginTop: creatives.length > 0 ? 8 : 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(229,24,43,0.3)'; e.currentTarget.style.color = '#e5182b' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#555669' }}
                >
                  + Agregar creativo
                </button>
              )}
            </div>
            )}

            {/* ANÁLISIS DE LLAMADAS */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#8a8c9e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', marginTop: '32px' }}>
                ANÁLISIS DE LLAMADAS
              </p>

              {salesMaterials.filter((m) => m.type === 'analysis_video').map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', marginBottom: '8px' }}>
                  <span style={{ background: '#071228', color: '#60a5fa', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: '4px', flexShrink: 0 }}>Video</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#f0f1f7', fontSize: 13, fontWeight: 700 }}>{m.title}</div>
                    {m.description && <div style={{ color: '#555669', fontSize: 11, marginTop: 2 }}>{m.description}</div>}
                    <div style={{ color: '#555669', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{m.url}</div>
                  </div>
                  <button
                    onClick={() => deleteAnalysisVideo(m.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16, padding: '2px 6px', flexShrink: 0, lineHeight: 1 }}
                  >✕</button>
                </div>
              ))}

              {addingAnalysisVideo ? (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '16px', marginTop: '8px' }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Título del video *</label>
                    <input
                      value={analysisForm.title}
                      onChange={(e) => setAnalysisForm((p) => ({ ...p, title: e.target.value }))}
                      style={inputStyle}
                      placeholder="Ej: Análisis llamada semana 3"
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>URL del video (YouTube o Loom) *</label>
                    <input
                      value={analysisForm.url}
                      onChange={(e) => setAnalysisForm((p) => ({ ...p, url: e.target.value }))}
                      style={inputStyle}
                      placeholder="https://youtube.com/... o https://loom.com/share/..."
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Descripción (opcional)</label>
                    <textarea
                      value={analysisForm.description}
                      onChange={(e) => setAnalysisForm((p) => ({ ...p, description: e.target.value }))}
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                      placeholder="Puntos clave analizados en este video..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleAddAnalysisVideo}
                      style={{ backgroundColor: '#e5182b', border: 'none', borderRadius: 6, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      Agregar
                    </button>
                    <button
                      onClick={() => { setAddingAnalysisVideo(false); setAnalysisForm({ title: '', url: '', description: '' }) }}
                      style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '8px 16px', color: '#f0f1f7', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingAnalysisVideo(true)}
                  style={{ width: '100%', backgroundColor: 'transparent', border: '2px dashed rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 16px', color: '#555669', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(229,24,43,0.3)'; e.currentTarget.style.color = '#e5182b' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#555669' }}
                >
                  + Agregar video de análisis
                </button>
              )}

              <p style={{ fontSize: '13px', fontWeight: 700, color: '#8a8c9e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', marginTop: '24px' }}>
                NOTAS DE LLAMADAS
              </p>
              <p style={{ color: '#555669', fontSize: '12px', marginBottom: '12px', marginTop: 0 }}>
                Agregá notas de feedback para cada llamada del pipeline del cliente.
              </p>

              {clientLeads.length === 0 ? (
                <div style={{ color: '#555669', fontSize: 13 }}>No hay llamadas registradas todavía.</div>
              ) : (
                clientLeads.map((lead) => {
                  const isExpanded = expandedLead === lead.id
                  return (
                    <div key={lead.id}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: isExpanded ? '10px 10px 0 0' : '10px', cursor: 'pointer', marginBottom: isExpanded ? 0 : '8px' }}
                        onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#f0f1f7', fontSize: 14, fontWeight: 700 }}>{lead.lead_nombre}</div>
                          {lead.fecha_llamada && <div style={{ color: '#555669', fontSize: 12 }}>{formatDate(lead.fecha_llamada)}</div>}
                        </div>
                        <span style={{ color: '#555669', fontSize: 16 }}>{isExpanded ? '↑' : '↓'}</span>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none', borderRadius: '0 0 10px 10px', marginBottom: '8px' }}>
                          <textarea
                            value={editingNotes[lead.id] ?? lead.notas ?? ''}
                            onChange={(e) => setEditingNotes((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                            rows={4}
                            style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }}
                            placeholder="Notas de feedback para esta llamada..."
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button
                              onClick={() => handleSaveNotes(lead.id)}
                              style={{ backgroundColor: '#e5182b', border: 'none', borderRadius: 6, padding: '8px 16px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                            >
                              Guardar notas
                            </button>
                            <button
                              onClick={() => handleClearNotes(lead.id)}
                              style={{ color: '#f87171', background: 'transparent', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                            >
                              Borrar nota
                            </button>
                            {notesSaved[lead.id] && (
                              <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ Guardado</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                backgroundColor: saving ? 'rgba(229,24,43,0.5)' : '#e5182b',
                border: 'none',
                borderRadius: 8,
                padding: '14px',
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: 'DM Sans, sans-serif',
                marginBottom: 40,
              }}
            >
              {saving && <Spinner size={18} color="white" />}
              Guardar todo →
            </button>

            {/* History log */}
            {history.length > 0 && (
              <div>
                <p style={sectionTitle}>HISTORIAL</p>
                {history.map((h) => (
                  <div key={h.id}>
                    <div
                      style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: confirmDeleteHistoryId === h.id ? 'none' : '1px solid rgba(255,255,255,0.05)', alignItems: 'flex-start' }}
                    >
                      <span style={{ color: '#555669', fontSize: 12, whiteSpace: 'nowrap', minWidth: 80 }}>
                        {formatDate(h.updated_at)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: '#8a8c9e', fontSize: 12 }}>
                          CPBC: ${h.cpbc_current ?? '—'} · Fase: {phases.find((p) => p.id === h.active_phase_id)?.phase_name ?? '—'}
                        </span>
                        {h.current_win && (
                          <p style={{ color: '#555669', fontSize: 12, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {h.current_win.slice(0, 80)}{h.current_win.length > 80 ? '...' : ''}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setConfirmDeleteHistoryId(confirmDeleteHistoryId === h.id ? null : h.id)}
                        style={{ background: 'none', border: 'none', color: '#555669', cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </div>
                    {confirmDeleteHistoryId === h.id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#8a8c9e', fontSize: 12 }}>¿Eliminar esta entrada?</span>
                        <button
                          onClick={() => deleteHistoryEntry(h.id)}
                          style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '3px 10px', color: '#f87171', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => setConfirmDeleteHistoryId(null)}
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '3px 10px', color: '#8a8c9e', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
