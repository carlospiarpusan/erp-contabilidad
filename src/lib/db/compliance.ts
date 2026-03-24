import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient, maybeCreateServiceClient } from '@/lib/supabase/service'
import { logServerEvent } from '@/lib/observability/logger'
import type { UserSession } from '@/lib/auth/session'
import type { CsvCell } from '@/lib/utils/csv'

type RelationType = 'documento' | 'asiento' | 'recibo' | 'pago_proveedor' | 'documento_soporte'
type AdjuntoUploadParams = {
  empresaId: string
  userId?: string | null
  relationType: RelationType
  relationId: string
  tipoDocumental: string
  fileName: string
  mimeType?: string | null
  bytes: Uint8Array
  linkedIds?: {
    documento_id?: string | null
    asiento_id?: string | null
    recibo_id?: string | null
    pago_proveedor_id?: string | null
  }
}

export interface RegulatoryConfig {
  id?: string
  empresa_id: string
  obligado_fe: boolean
  usa_proveedor_fe: boolean
  requiere_documento_soporte: boolean
  reporta_exogena: boolean
  usa_radian: boolean
  politica_datos_version?: string | null
  politica_datos_url?: string | null
  aviso_privacidad_url?: string | null
  contacto_privacidad_email?: string | null
}

export interface PeriodoContable {
  id: string
  empresa_id: string
  ejercicio_id: string
  año: number
  mes: number
  fecha_inicio: string
  fecha_fin: string
  estado: 'abierto' | 'cerrado' | 'reabierto'
  motivo?: string | null
  cerrado_por?: string | null
  cerrado_at?: string | null
  reabierto_por?: string | null
  reabierto_at?: string | null
}

export interface DocumentoAdjunto {
  id: string
  empresa_id: string
  bucket: string
  path: string
  nombre_archivo: string
  mime_type?: string | null
  tamaño_bytes: number
  sha256?: string | null
  tipo_documental: string
  relacion_tipo: string
  relacion_id: string
  created_at: string
}

export interface DocumentoSoporteExterno {
  id: string
  empresa_id: string
  documento_id: string
  proveedor_id?: string | null
  requerido: boolean
  estado: 'no_requerido' | 'pendiente' | 'adjunto' | 'validado' | 'rechazado'
  proveedor_tecnologico?: string | null
  numero_externo?: string | null
  fecha_emision?: string | null
  archivo_adjunto_id?: string | null
  observaciones?: string | null
  validated_by?: string | null
  created_at: string
  updated_at?: string
}

export interface UvtVigencia {
  id: string
  empresa_id: string
  año: number
  valor: number
  fuente?: string | null
}

export interface ComplianceJob {
  id: string
  empresa_id?: string | null
  tipo: string
  estado: 'pendiente' | 'procesando' | 'completado' | 'fallido' | 'cancelado'
  payload: Record<string, unknown>
  resultado?: Record<string, unknown> | null
  run_at: string
  attempts: number
  max_attempts: number
  last_error?: string | null
  created_at: string
  updated_at?: string
}

async function getEmpresaContext() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('No autenticado')

  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  if (error || !usuario?.empresa_id) throw new Error('Usuario sin empresa asignada')

  return {
    supabase,
    empresa_id: String(usuario.empresa_id),
    user_id: String(user.id),
  }
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-120) || 'archivo'
}

function buildAdjuntoPath(params: {
  empresaId: string
  relationType: string
  relationId: string
  fileName: string
}) {
  const now = new Date()
  const year = String(now.getUTCFullYear())
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const fileName = sanitizeFileName(params.fileName)
  return `${params.empresaId}/${params.relationType}/${params.relationId}/${year}/${month}/${Date.now()}-${fileName}`
}

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function assertRelationBelongsToEmpresa(
  admin: ReturnType<typeof createServiceClient>,
  empresaId: string,
  relationType: RelationType,
  relationId: string
) {
  const TABLE_BY_RELATION: Record<RelationType, string> = {
    documento: 'documentos',
    asiento: 'asientos',
    recibo: 'recibos',
    pago_proveedor: 'pagos_proveedores',
    documento_soporte: 'documentos_soporte_externo',
  }

  const table = TABLE_BY_RELATION[relationType]
  const { data, error } = await admin
    .from(table)
    .select('id, empresa_id')
    .eq('id', relationId)
    .eq('empresa_id', empresaId)
    .single()

  if (error || !data?.id) {
    throw new Error('La relación del adjunto no pertenece a la empresa actual')
  }
}

async function getCurrentUvtValue(empresaId: string, year: number) {
  const admin = maybeCreateServiceClient()
  if (!admin) return null

  const { data } = await admin
    .from('uvt_vigencias')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('año', year)
    .maybeSingle()

  return data?.valor ? Number(data.valor) : null
}

export async function getRegulatoryConfig() {
  const { supabase, empresa_id } = await getEmpresaContext()
  const { data, error } = await supabase
    .from('configuracion_regulatoria')
    .select('*')
    .eq('empresa_id', empresa_id)
    .maybeSingle()

  if (error) throw error

  return (data ?? {
    empresa_id,
    obligado_fe: false,
    usa_proveedor_fe: false,
    requiere_documento_soporte: true,
    reporta_exogena: true,
    usa_radian: false,
    politica_datos_version: null,
    politica_datos_url: null,
    aviso_privacidad_url: null,
    contacto_privacidad_email: null,
  }) as RegulatoryConfig
}

export async function updateRegulatoryConfig(input: Partial<RegulatoryConfig>) {
  const { supabase, empresa_id } = await getEmpresaContext()
  const payload = {
    empresa_id,
    obligado_fe: Boolean(input.obligado_fe),
    usa_proveedor_fe: Boolean(input.usa_proveedor_fe),
    requiere_documento_soporte: input.requiere_documento_soporte ?? true,
    reporta_exogena: input.reporta_exogena ?? true,
    usa_radian: Boolean(input.usa_radian),
    politica_datos_version: input.politica_datos_version || null,
    politica_datos_url: input.politica_datos_url || null,
    aviso_privacidad_url: input.aviso_privacidad_url || null,
    contacto_privacidad_email: input.contacto_privacidad_email || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('configuracion_regulatoria')
    .upsert(payload, { onConflict: 'empresa_id' })
    .select('*')
    .single()

  if (error) throw error
  return data as RegulatoryConfig
}

export async function getUvtVigencias() {
  const { supabase, empresa_id } = await getEmpresaContext()
  const { data, error } = await supabase
    .from('uvt_vigencias')
    .select('*')
    .eq('empresa_id', empresa_id)
    .order('año', { ascending: false })

  if (error) throw error
  return (data ?? []) as UvtVigencia[]
}

export async function upsertUvtVigencia(input: Pick<UvtVigencia, 'año' | 'valor'> & { fuente?: string | null }) {
  const { supabase, empresa_id } = await getEmpresaContext()
  const payload = {
    empresa_id,
    año: input.año,
    valor: Number(input.valor),
    fuente: input.fuente || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('uvt_vigencias')
    .upsert(payload, { onConflict: 'empresa_id,año' })
    .select('*')
    .single()

  if (error) throw error
  return data as UvtVigencia
}

export async function getPeriodosContables(ejercicioId?: string) {
  const { supabase, empresa_id } = await getEmpresaContext()
  let query = supabase
    .from('periodos_contables')
    .select('*')
    .eq('empresa_id', empresa_id)
    .order('año', { ascending: false })
    .order('mes', { ascending: false })

  if (ejercicioId) query = query.eq('ejercicio_id', ejercicioId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function updatePeriodoContable(
  id: string,
  params: { estado: 'abierto' | 'cerrado' | 'reabierto'; motivo?: string | null }
) {
  const { supabase, user_id } = await getEmpresaContext()
  const payload: Record<string, unknown> = {
    estado: params.estado,
    motivo: params.motivo || null,
    updated_at: new Date().toISOString(),
  }

  if (params.estado === 'cerrado') {
    payload.cerrado_por = user_id
    payload.cerrado_at = new Date().toISOString()
  }
  if (params.estado === 'reabierto') {
    payload.reabierto_por = user_id
    payload.reabierto_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('periodos_contables')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as PeriodoContable
}

export async function ensurePeriodoAbierto(options: {
  session: UserSession
  fecha: string
  source: string
  method?: string
  route?: string
  context?: Record<string, unknown>
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('periodos_contables')
    .select('*')
    .eq('empresa_id', options.session.empresa_id)
    .lte('fecha_inicio', options.fecha)
    .gte('fecha_fin', options.fecha)
    .order('fecha_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) {
    // Auto-crear ejercicio + periodos para el año si no existen
    const año = new Date(options.fecha).getFullYear()
    const { data: ejercicioExistente } = await supabase
      .from('ejercicios')
      .select('id')
      .eq('empresa_id', options.session.empresa_id)
      .eq('año', año)
      .maybeSingle()

    if (!ejercicioExistente) {
      const { error: insertError } = await supabase.from('ejercicios').insert({
        empresa_id: options.session.empresa_id,
        año,
        descripcion: `Ejercicio ${año}`,
        fecha_inicio: `${año}-01-01`,
        fecha_fin: `${año}-12-31`,
        estado: 'activo',
      })
      if (insertError) {
        await logServerEvent({
          level: 'error',
          source: options.source,
          event: 'periodo_auto_creacion_fallida',
          session: options.session,
          context: { fecha: options.fecha, año, error: insertError.message },
        })
        throw new Error(`No existe periodo contable configurado para la fecha ${options.fecha}`)
      }
      await logServerEvent({
        level: 'info',
        source: options.source,
        event: 'periodo_auto_creado',
        session: options.session,
        context: { fecha: options.fecha, año },
      })
    }

    // Re-intentar buscar el periodo (el trigger ya generó los meses)
    const { data: retry } = await supabase
      .from('periodos_contables')
      .select('*')
      .eq('empresa_id', options.session.empresa_id)
      .lte('fecha_inicio', options.fecha)
      .gte('fecha_fin', options.fecha)
      .order('fecha_inicio', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!retry?.id) {
      await logServerEvent({
        level: 'warn',
        source: options.source,
        event: 'periodo_no_configurado',
        session: options.session,
        method: options.method,
        route: options.route,
        context: { fecha: options.fecha, ...options.context },
      })
      throw new Error(`No existe periodo contable configurado para la fecha ${options.fecha}`)
    }

    return retry
  }

  if (data.estado === 'cerrado') {
    await logServerEvent({
      level: 'warn',
      source: options.source,
      event: 'escritura_bloqueada_periodo_cerrado',
      session: options.session,
      method: options.method,
      route: options.route,
      context: {
        fecha: options.fecha,
        año: data.año,
        mes: data.mes,
        estado: data.estado,
        ...options.context,
      },
    })
    throw new Error(`El periodo contable ${data.año}-${String(data.mes).padStart(2, '0')} está cerrado`)
  }

  return data
}

export async function listAdjuntosPrivados(params: {
  relationType: RelationType
  relationId: string
}) {
  const { supabase, empresa_id } = await getEmpresaContext()
  const { data, error } = await supabase
    .from('documentos_adjuntos')
    .select('*')
    .eq('empresa_id', empresa_id)
    .eq('relacion_tipo', params.relationType)
    .eq('relacion_id', params.relationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as DocumentoAdjunto[]
}

export async function uploadAdjuntoPrivado(params: AdjuntoUploadParams) {
  const admin = createServiceClient()
  await assertRelationBelongsToEmpresa(admin, params.empresaId, params.relationType, params.relationId)

  const path = buildAdjuntoPath({
    empresaId: params.empresaId,
    relationType: params.relationType,
    relationId: params.relationId,
    fileName: params.fileName,
  })

  const { error: uploadError } = await admin
    .storage
    .from('adjuntos-privados')
    .upload(path, params.bytes, {
      contentType: params.mimeType ?? 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const payload = {
    empresa_id: params.empresaId,
    bucket: 'adjuntos-privados',
    path,
    nombre_archivo: params.fileName,
    mime_type: params.mimeType ?? null,
    tamaño_bytes: params.bytes.byteLength,
    sha256: sha256(params.bytes),
    tipo_documental: params.tipoDocumental,
    relacion_tipo: params.relationType,
    relacion_id: params.relationId,
    documento_id: params.linkedIds?.documento_id ?? null,
    asiento_id: params.linkedIds?.asiento_id ?? null,
    recibo_id: params.linkedIds?.recibo_id ?? null,
    pago_proveedor_id: params.linkedIds?.pago_proveedor_id ?? null,
    created_by: params.userId ?? null,
  }

  const { data, error } = await admin
    .from('documentos_adjuntos')
    .insert(payload)
    .select('*')
    .single()

  if (error || !data) {
    await admin.storage.from('adjuntos-privados').remove([path]).catch(() => null)
    throw error ?? new Error('No se pudo registrar el adjunto')
  }

  return data as unknown as DocumentoAdjunto
}

export async function createAdjuntoSignedUrl(id: string) {
  const { supabase, empresa_id } = await getEmpresaContext()
  const { data: metadata, error } = await supabase
    .from('documentos_adjuntos')
    .select('id, bucket, path, nombre_archivo')
    .eq('empresa_id', empresa_id)
    .eq('id', id)
    .single()

  if (error || !metadata?.path) throw error ?? new Error('Adjunto no encontrado')

  const admin = createServiceClient()
  const { data, error: signedError } = await admin
    .storage
    .from(String(metadata.bucket))
    .createSignedUrl(String(metadata.path), 60)

  if (signedError || !data?.signedUrl) throw signedError ?? new Error('No se pudo generar URL firmada')

  return {
    signedUrl: data.signedUrl,
    nombre_archivo: metadata.nombre_archivo,
  }
}

export async function deleteAdjuntoPrivado(id: string) {
  const { supabase, empresa_id } = await getEmpresaContext()
  const { data: metadata, error } = await supabase
    .from('documentos_adjuntos')
    .select('id, bucket, path')
    .eq('empresa_id', empresa_id)
    .eq('id', id)
    .single()

  if (error || !metadata?.path) throw error ?? new Error('Adjunto no encontrado')

  const admin = createServiceClient()
  await admin.storage.from(String(metadata.bucket)).remove([String(metadata.path)]).catch(() => null)

  const { error: deleteError } = await supabase
    .from('documentos_adjuntos')
    .delete()
    .eq('id', id)

  if (deleteError) throw deleteError
  return { ok: true as const }
}

export async function getDocumentoSoporte(documentoId: string) {
  const { supabase, empresa_id } = await getEmpresaContext()
  const { data, error } = await supabase
    .from('documentos_soporte_externo')
    .select(`
      id,
      empresa_id,
      documento_id,
      proveedor_id,
      requerido,
      estado,
      proveedor_tecnologico,
      numero_externo,
      fecha_emision,
      archivo_adjunto_id,
      observaciones,
      created_at,
      updated_at,
      proveedor:proveedor_id(id, razon_social, numero_documento, obligado_a_facturar)
    `)
    .eq('empresa_id', empresa_id)
    .eq('documento_id', documentoId)
    .maybeSingle()

  if (error) throw error
  return data as (DocumentoSoporteExterno & { proveedor?: Record<string, unknown> | null }) | null
}

export async function upsertDocumentoSoporte(
  documentoId: string,
  input: Partial<DocumentoSoporteExterno> & { validado_por?: string | null }
) {
  const { supabase, empresa_id, user_id } = await getEmpresaContext()
  const existing = await getDocumentoSoporte(documentoId)

  const estado = (input.estado ?? existing?.estado ?? 'pendiente') as DocumentoSoporteExterno['estado']
  const payload = {
    empresa_id,
    documento_id: documentoId,
    proveedor_id: input.proveedor_id ?? existing?.proveedor_id ?? null,
    requerido: input.requerido ?? existing?.requerido ?? true,
    estado,
    proveedor_tecnologico: input.proveedor_tecnologico ?? existing?.proveedor_tecnologico ?? null,
    numero_externo: input.numero_externo ?? existing?.numero_externo ?? null,
    fecha_emision: input.fecha_emision ?? existing?.fecha_emision ?? null,
    archivo_adjunto_id: input.archivo_adjunto_id ?? existing?.archivo_adjunto_id ?? null,
    observaciones: input.observaciones ?? existing?.observaciones ?? null,
    validated_by: estado === 'validado' ? (input.validado_por ?? user_id) : existing?.validated_by ?? null,
    updated_at: new Date().toISOString(),
  }

  if (payload.requerido && payload.estado !== 'no_requerido') {
    if (payload.estado === 'validado') {
      if (!payload.numero_externo || !payload.fecha_emision || !payload.archivo_adjunto_id) {
        throw new Error('Para validar el documento soporte debes registrar número, fecha y adjunto')
      }
    }
  }

  const { data, error } = await supabase
    .from('documentos_soporte_externo')
    .upsert(payload, { onConflict: 'documento_id' })
    .select('*')
    .single()

  if (error) throw error
  return data as DocumentoSoporteExterno
}

export async function listJobs(limit = 100) {
  const { supabase, empresa_id } = await getEmpresaContext()
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('empresa_id', empresa_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as ComplianceJob[]
}

export async function enqueueJob(params: {
  session: UserSession
  tipo: string
  payload?: Record<string, unknown>
  runAt?: string
  maxAttempts?: number
}) {
  const supabase = await createClient()
  const payload = {
    empresa_id: params.session.empresa_id,
    tipo: params.tipo,
    payload: params.payload ?? {},
    run_at: params.runAt ?? new Date().toISOString(),
    max_attempts: params.maxAttempts ?? 3,
    created_by: params.session.id,
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error
  return data as ComplianceJob
}

async function executeJob(admin: ReturnType<typeof createServiceClient>, job: ComplianceJob) {
  switch (job.tipo) {
    case 'validar_documentos_soporte': {
      const { data: pendientes } = await admin
        .from('documentos_soporte_externo')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', job.empresa_id)
        .neq('estado', 'validado')
        .eq('requerido', true)

      return {
        pendientes_documento_soporte: pendientes ?? null,
      }
    }
    case 'validar_exogena': {
      const year = Number(job.payload?.año ?? new Date().getUTCFullYear())
      const summary = await getExogenaPackageSummaryForEmpresa(admin, String(job.empresa_id), year)
      return summary
    }
    default:
      throw new Error(`Tipo de job no soportado: ${job.tipo}`)
  }
}

export async function processPendingJobs(options?: { limit?: number; lockedBy?: string }) {
  const admin = createServiceClient()
  const nowIso = new Date().toISOString()
  const limit = Math.max(1, Math.min(options?.limit ?? 10, 50))

  const { data: jobs, error } = await admin
    .from('jobs')
    .select('*')
    .eq('estado', 'pendiente')
    .lte('run_at', nowIso)
    .order('run_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  const results: Array<{ id: string; estado: string; error?: string | null }> = []

  for (const rawJob of jobs ?? []) {
    const job = rawJob as ComplianceJob

    await admin
      .from('jobs')
      .update({
        estado: 'procesando',
        locked_at: nowIso,
        locked_by: options?.lockedBy ?? 'manual',
        attempts: Number(job.attempts ?? 0) + 1,
        updated_at: nowIso,
      })
      .eq('id', job.id)

    try {
      const result = await executeJob(admin, job)

      await admin.from('jobs').update({
        estado: 'completado',
        resultado: result,
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)

      await admin.from('job_ejecuciones').insert({
        job_id: job.id,
        empresa_id: job.empresa_id ?? null,
        estado: 'completado',
        detalle: result,
      })

      results.push({ id: job.id, estado: 'completado' })
    } catch (jobError) {
      const message = jobError instanceof Error ? jobError.message : 'Error desconocido'
      const nextState = Number(job.attempts ?? 0) + 1 >= Number(job.max_attempts ?? 3) ? 'fallido' : 'pendiente'

      await admin.from('jobs').update({
        estado: nextState,
        last_error: message,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)

      await admin.from('job_ejecuciones').insert({
        job_id: job.id,
        empresa_id: job.empresa_id ?? null,
        estado: nextState,
        detalle: { error: message },
      })

      results.push({ id: job.id, estado: nextState, error: message })
    }
  }

  return results
}

type ExportRow = Record<string, CsvCell>

export async function getLibroDiarioRows(params?: {
  desde?: string
  hasta?: string
}) {
  const { supabase } = await getEmpresaContext()
  let query = supabase
    .from('asientos')
    .select(`
      id,
      numero,
      fecha,
      concepto,
      tipo,
      tipo_doc,
      lineas:asientos_lineas(
        descripcion,
        debe,
        haber,
        cuenta:cuenta_id(codigo, descripcion)
      )
    `)
    .order('fecha', { ascending: true })
    .order('numero', { ascending: true })

  if (params?.desde) query = query.gte('fecha', params.desde)
  if (params?.hasta) query = query.lte('fecha', params.hasta)

  const { data, error } = await query
  if (error) throw error

  const rows: ExportRow[] = []
  for (const asiento of data ?? []) {
    for (const linea of (asiento.lineas ?? []) as Array<Record<string, unknown>>) {
      const cuenta = linea.cuenta as { codigo?: string; descripcion?: string } | null
      rows.push({
        asiento_numero: asiento.numero,
        fecha: asiento.fecha,
        tipo: asiento.tipo,
        tipo_doc: asiento.tipo_doc,
        concepto: asiento.concepto,
        cuenta_codigo: cuenta?.codigo ?? '',
        cuenta_descripcion: cuenta?.descripcion ?? '',
        linea_descripcion: linea.descripcion as string | null,
        debe: Number(linea.debe ?? 0),
        haber: Number(linea.haber ?? 0),
      })
    }
  }

  return rows
}

export async function getAuxiliaresRows(params?: {
  desde?: string
  hasta?: string
  codigoCuenta?: string
}) {
  const rows = await getLibroDiarioRows({ desde: params?.desde, hasta: params?.hasta })
  const codigoCuenta = params?.codigoCuenta
  if (!codigoCuenta) return rows
  return rows.filter((row) => String(row.cuenta_codigo ?? '').startsWith(codigoCuenta))
}

export async function getRetencionesAplicadasRows(params?: {
  desde?: string
  hasta?: string
}) {
  const { supabase } = await getEmpresaContext()
  let query = supabase
    .from('retenciones_aplicadas')
    .select(`
      id,
      base_gravable,
      porcentaje,
      valor,
      created_at,
      retencion:retencion_id(tipo, nombre),
      documento:documento_id(
        id,
        tipo,
        fecha,
        numero,
        prefijo,
        proveedor:proveedor_id(razon_social, numero_documento),
        cliente:cliente_id(razon_social, numero_documento)
      )
    `)
    .order('created_at', { ascending: false })

  if (params?.desde) query = query.gte('created_at', `${params.desde}T00:00:00`)
  if (params?.hasta) query = query.lte('created_at', `${params.hasta}T23:59:59`)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((item) => {
    const retencion = item.retencion as { tipo?: string; nombre?: string } | null
    const documentoRaw = item.documento as Record<string, unknown> | Record<string, unknown>[] | null
    const documento = Array.isArray(documentoRaw) ? (documentoRaw[0] ?? null) : documentoRaw
    const proveedorRaw = documento?.proveedor as { razon_social?: string; numero_documento?: string } | { razon_social?: string; numero_documento?: string }[] | null | undefined
    const clienteRaw = documento?.cliente as { razon_social?: string; numero_documento?: string } | { razon_social?: string; numero_documento?: string }[] | null | undefined
    const proveedor = Array.isArray(proveedorRaw) ? (proveedorRaw[0] ?? null) : proveedorRaw
    const cliente = Array.isArray(clienteRaw) ? (clienteRaw[0] ?? null) : clienteRaw

    return {
      fecha: documento?.fecha as string | null,
      documento: `${String(documento?.prefijo ?? '')}${String(documento?.numero ?? '')}`,
      tipo_documento: documento?.tipo as string | null,
      tercero: proveedor?.razon_social ?? cliente?.razon_social ?? '',
      tercero_documento: proveedor?.numero_documento ?? cliente?.numero_documento ?? '',
      retencion_tipo: retencion?.tipo ?? '',
      retencion_nombre: retencion?.nombre ?? '',
      base_gravable: Number(item.base_gravable ?? 0),
      porcentaje: Number(item.porcentaje ?? 0),
      valor: Number(item.valor ?? 0),
    }
  })
}

export async function getFaltantesSoporteRows() {
  const { supabase } = await getEmpresaContext()
  const { data, error } = await supabase
    .from('documentos_soporte_externo')
    .select(`
      id,
      estado,
      numero_externo,
      fecha_emision,
      documento:documento_id(id, fecha, numero, prefijo, numero_externo, total),
      proveedor:proveedor_id(razon_social, numero_documento)
    `)
    .eq('requerido', true)
    .neq('estado', 'validado')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((item) => {
    const documento = item.documento as { fecha?: string; numero?: number; prefijo?: string; numero_externo?: string; total?: number } | null
    const proveedor = item.proveedor as { razon_social?: string; numero_documento?: string } | null
    return {
      documento: `${String(documento?.prefijo ?? '')}${String(documento?.numero ?? '')}`,
      fecha: documento?.fecha ?? '',
      factura_proveedor: documento?.numero_externo ?? '',
      proveedor: proveedor?.razon_social ?? '',
      nit_proveedor: proveedor?.numero_documento ?? '',
      estado_soporte: item.estado,
      numero_soporte: item.numero_externo ?? '',
      fecha_soporte: item.fecha_emision ?? '',
      total_compra: Number(documento?.total ?? 0),
    }
  })
}

async function getExogenaPackageSummaryForEmpresa(
  admin: ReturnType<typeof createServiceClient>,
  empresaId: string,
  year: number
) {
  const desde = `${year}-01-01`
  const hasta = `${year}-12-31`

  const [ventasRes, comprasRes, clientesRes, proveedoresRes, soportesRes] = await Promise.all([
    admin.from('documentos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('tipo', 'factura_venta').gte('fecha', desde).lte('fecha', hasta),
    admin.from('documentos').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('tipo', 'factura_compra').gte('fecha', desde).lte('fecha', hasta),
    admin.from('clientes').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
    admin.from('proveedores').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId),
    admin.from('documentos_soporte_externo').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('requerido', true).neq('estado', 'validado'),
  ])

  return {
    año: year,
    ventas: ventasRes.count ?? 0,
    compras: comprasRes.count ?? 0,
    clientes: clientesRes.count ?? 0,
    proveedores: proveedoresRes.count ?? 0,
    soportes_pendientes: soportesRes.count ?? 0,
  }
}

export async function getExogenaPackage(year: number) {
  const { supabase, empresa_id } = await getEmpresaContext()
  const desde = `${year}-01-01`
  const hasta = `${year}-12-31`
  const uvt = await getCurrentUvtValue(empresa_id, year)

  const [clientesRes, proveedoresRes, ventasRes, comprasRes, retencionesRes, soportesRes] = await Promise.all([
    supabase
      .from('clientes')
      .select('tipo_documento, numero_documento, razon_social, ciudad, departamento, email, telefono, activo')
      .order('razon_social'),
    supabase
      .from('proveedores')
      .select('tipo_documento, numero_documento, razon_social, ciudad, departamento, email, telefono, activo, obligado_a_facturar')
      .order('razon_social'),
    supabase
      .from('documentos')
      .select('fecha, prefijo, numero, total, total_iva, total_descuento, cliente:cliente_id(razon_social, numero_documento)')
      .eq('tipo', 'factura_venta')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha'),
    supabase
      .from('documentos')
      .select('fecha, prefijo, numero, numero_externo, total, total_iva, total_descuento, documento_soporte_estado, proveedor:proveedor_id(razon_social, numero_documento)')
      .eq('tipo', 'factura_compra')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha'),
    getRetencionesAplicadasRows({ desde, hasta }),
    getFaltantesSoporteRows(),
  ])

  if (clientesRes.error) throw clientesRes.error
  if (proveedoresRes.error) throw proveedoresRes.error
  if (ventasRes.error) throw ventasRes.error
  if (comprasRes.error) throw comprasRes.error

  const validations = {
    año: year,
    uvt_configurada: uvt ?? 0,
    clientes_sin_documento: (clientesRes.data ?? []).filter((item) => !item.numero_documento).length,
    proveedores_sin_documento: (proveedoresRes.data ?? []).filter((item) => !item.numero_documento).length,
    compras_con_soporte_pendiente: soportesRes.length,
    ventas_totales: (ventasRes.data ?? []).length,
    compras_totales: (comprasRes.data ?? []).length,
  }

  const terceros = [
    ...(clientesRes.data ?? []).map((item) => ({
      tipo_tercero: 'cliente',
      tipo_documento: item.tipo_documento,
      numero_documento: item.numero_documento,
      nombre: item.razon_social,
      ciudad: item.ciudad,
      departamento: item.departamento,
      email: item.email,
      telefono: item.telefono,
      activo: item.activo,
    })),
    ...(proveedoresRes.data ?? []).map((item) => ({
      tipo_tercero: 'proveedor',
      tipo_documento: item.tipo_documento,
      numero_documento: item.numero_documento,
      nombre: item.razon_social,
      ciudad: item.ciudad,
      departamento: item.departamento,
      email: item.email,
      telefono: item.telefono,
      activo: item.activo,
      obligado_a_facturar: item.obligado_a_facturar,
    })),
  ]

  const ventas = (ventasRes.data ?? []).map((item) => {
    const cliente = item.cliente as { razon_social?: string; numero_documento?: string } | null
    return {
      fecha: item.fecha,
      documento: `${String(item.prefijo ?? '')}${String(item.numero ?? '')}`,
      tercero: cliente?.razon_social ?? '',
      tercero_documento: cliente?.numero_documento ?? '',
      total: Number(item.total ?? 0),
      iva: Number(item.total_iva ?? 0),
      descuento: Number(item.total_descuento ?? 0),
    }
  })

  const compras = (comprasRes.data ?? []).map((item) => {
    const proveedor = item.proveedor as { razon_social?: string; numero_documento?: string } | null
    return {
      fecha: item.fecha,
      documento: `${String(item.prefijo ?? '')}${String(item.numero ?? '')}`,
      factura_proveedor: item.numero_externo,
      proveedor: proveedor?.razon_social ?? '',
      nit_proveedor: proveedor?.numero_documento ?? '',
      total: Number(item.total ?? 0),
      iva: Number(item.total_iva ?? 0),
      descuento: Number(item.total_descuento ?? 0),
      estado_soporte: item.documento_soporte_estado ?? 'no_requerido',
    }
  })

  return {
    validations,
    terceros,
    ventas,
    compras,
    retenciones: retencionesRes,
    soportes_pendientes: soportesRes,
  }
}

export async function getUserPersonalDataExport(session: UserSession) {
  const supabase = await createClient()
  const [usuarioRes, consentRes, notifRes] = await Promise.all([
    supabase.from('usuarios').select('id, nombre, email, telefono, activo, created_at').eq('id', session.id).single(),
    supabase.from('consentimientos_privacidad').select('tipo, version, aceptado_en').eq('usuario_id', session.id).order('aceptado_en', { ascending: false }),
    supabase.from('notificaciones').select('id, tipo, titulo, leida, created_at').order('created_at', { ascending: false }).limit(50),
  ])

  if (usuarioRes.error) throw usuarioRes.error
  if (consentRes.error) throw consentRes.error
  if (notifRes.error) throw notifRes.error

  return {
    usuario: usuarioRes.data,
    empresa: {
      id: session.empresa_id,
      nombre: session.empresa_nombre ?? '',
    },
    consentimientos: consentRes.data ?? [],
    notificaciones_recientes: notifRes.data ?? [],
    exportado_en: new Date().toISOString(),
  }
}
