import { createClient } from '@/lib/supabase/server'

function ordenarFormasPago<T extends { descripcion?: string | null }>(formas: T[]) {
  return [...formas].sort((a, b) => {
    const descA = (a.descripcion ?? '').trim()
    const descB = (b.descripcion ?? '').trim()
    const esEfectivoA = descA.localeCompare('Efectivo', 'es', { sensitivity: 'base' }) === 0
    const esEfectivoB = descB.localeCompare('Efectivo', 'es', { sensitivity: 'base' }) === 0

    if (esEfectivoA !== esEfectivoB) return esEfectivoA ? -1 : 1
    return descA.localeCompare(descB, 'es', { sensitivity: 'base' })
  })
}

export async function getFormasPago() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formas_pago')
    .select('*')
    .eq('activa', true)
    .order('descripcion')
  if (error) throw error
  return ordenarFormasPago(data ?? [])
}

export async function getEjercicioActivo() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ejercicios')
    .select('*')
    .eq('estado', 'activo')
    .order('año', { ascending: false })
    .limit(1)
    .single()
  if (error) throw error
  return data
}

export async function getColaboradores() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('colaboradores')
    .select('*')
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export async function getCuentasPUC() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cuentas_puc')
    .select('*')
    .eq('activa', true)
    .order('codigo')
  if (error) throw error
  return data ?? []
}

export async function getEmpresaId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data, error } = await supabase
    .from('usuarios')
    .select('empresa_id')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data.empresa_id
}
