import { createClient } from '@/lib/supabase/server'

export async function getFormasPago() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formas_pago')
    .select('*')
    .eq('activa', true)
    .order('descripcion')
  if (error) throw error
  return data ?? []
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

export async function getEjercicios() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ejercicios')
    .select('*')
    .order('año', { ascending: false })
  if (error) throw error
  return data ?? []
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

export async function getConsecutivosPorTipo(tipo: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consecutivos')
    .select('*')
    .eq('tipo', tipo)
    .eq('activo', true)
    .order('created_at')
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
