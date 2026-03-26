import { ROLE_IDS } from '@/lib/auth/permissions'
import { getSupabaseServiceEnv } from '@/lib/supabase/config'
import { createServiceClient } from '@/lib/supabase/service'
import { getTodayInAppTimeZone } from '@/lib/utils/dates'

const EMPRESA_BASE_ID = '00000000-0000-0000-0000-000000000001'

export type CreateEmpresaWithAdminInput = {
  nombre: string
  nit: string
  dv?: string | null
  razon_social?: string | null
  direccion?: string | null
  ciudad?: string | null
  departamento?: string | null
  pais?: string | null
  telefono?: string | null
  email?: string | null
  regimen?: string | null
  tipo_org?: string | null
  email_admin: string
  nombre_admin: string
  password_admin: string
}

type CreatedEmpresaWithAdmin = {
  empresa_id: string
  user_id: string
}

function cleanOptionalString(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function createAuthAdmin(params: {
  email: string
  password: string
  nombre: string
}) {
  const { url, serviceRoleKey } = getSupabaseServiceEnv()
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: { nombre: params.nombre },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.msg || errorBody?.message || 'No fue posible crear el usuario administrador')
  }

  const payload = await response.json()
  const userId = typeof payload?.id === 'string' ? payload.id : ''
  if (!userId) throw new Error('No se obtuvo el id del usuario administrador')

  return userId
}

async function ensureEmpresaBase() {
  const admin = createServiceClient()
  const { error } = await admin
    .from('empresas')
    .upsert({
      id: EMPRESA_BASE_ID,
      nombre: 'Empresa Base Sistema',
      nit: 'BASE-000000000001',
      razon_social: 'Empresa Base Sistema',
      ciudad: 'Ipiales',
      departamento: 'Nariño',
      pais: 'Colombia',
      regimen: 'simplificado',
      tipo_org: 'persona_natural',
      activa: false,
    }, { onConflict: 'id' })

  if (error) {
    throw new Error(error.message ?? 'No fue posible preparar la empresa base del sistema')
  }
}

async function deleteAuthAdmin(userId: string) {
  const { url, serviceRoleKey } = getSupabaseServiceEnv()
  await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  }).catch(() => null)
}

export async function createEmpresaWithAdmin(input: CreateEmpresaWithAdminInput): Promise<CreatedEmpresaWithAdmin> {
  const admin = createServiceClient()
  const nombre = input.nombre.trim()
  const nit = input.nit.trim()
  const emailAdmin = input.email_admin.trim().toLowerCase()
  const nombreAdmin = input.nombre_admin.trim()

  const { data: empresa, error: empresaError } = await admin
    .from('empresas')
    .insert({
      nombre,
      nit,
      dv: cleanOptionalString(input.dv),
      razon_social: cleanOptionalString(input.razon_social) ?? nombre,
      direccion: cleanOptionalString(input.direccion),
      ciudad: cleanOptionalString(input.ciudad),
      departamento: cleanOptionalString(input.departamento),
      pais: cleanOptionalString(input.pais) ?? 'Colombia',
      telefono: cleanOptionalString(input.telefono),
      email: cleanOptionalString(input.email) ?? emailAdmin,
      regimen: cleanOptionalString(input.regimen),
      tipo_org: cleanOptionalString(input.tipo_org),
      activa: true,
    })
    .select('id')
    .single()

  if (empresaError || !empresa?.id) {
    throw new Error(empresaError?.message ?? 'No fue posible crear la empresa')
  }

  let userId = ''

  try {
    const { error: bodegaError } = await admin
      .from('bodegas')
      .insert({
        empresa_id: empresa.id,
        codigo: '001',
        nombre: 'Bodega Principal',
        principal: true,
        activa: true,
      })

    if (bodegaError) throw new Error(bodegaError.message ?? 'No fue posible crear la bodega principal')

    await ensureEmpresaBase()

    userId = await createAuthAdmin({
      email: emailAdmin,
      password: input.password_admin,
      nombre: nombreAdmin,
    })

    const { error: usuarioError } = await admin
      .from('usuarios')
      .upsert({
        id: userId,
        empresa_id: empresa.id,
        rol_id: ROLE_IDS.admin,
        nombre: nombreAdmin,
        email: emailAdmin,
        telefono: cleanOptionalString(input.telefono),
        activo: true,
        debe_cambiar_password: false,
      }, { onConflict: 'id' })

    if (usuarioError) throw new Error(usuarioError.message ?? 'No fue posible crear el usuario administrador')

    const year = Number(getTodayInAppTimeZone().slice(0, 4))
    await admin
      .from('ejercicios')
      .upsert({
        empresa_id: empresa.id,
        año: year,
        descripcion: `Ejercicio ${year}`,
        fecha_inicio: `${year}-01-01`,
        fecha_fin: `${year}-12-31`,
        estado: 'activo',
      }, { onConflict: 'empresa_id,año' })

    return {
      empresa_id: empresa.id,
      user_id: userId,
    }
  } catch (error) {
    if (userId) {
      await deleteAuthAdmin(userId)
    }
    try {
      await admin.from('empresas').delete().eq('id', empresa.id)
    } catch {}

    if (error instanceof Error) throw error
    throw new Error('No fue posible completar el registro de la empresa')
  }
}
