import { createClient } from '@/lib/supabase/server'

export interface RetencionActiva {
  id: string
  tipo: string
  nombre: string
  porcentaje: number
  base_minima?: number | null
  base_uvt?: number | null
  cuenta_contable_id?: string | null
  aplica_a?: string | null
  activa?: boolean
}

export async function getRetencionesActivas(aplicaA?: 'compras' | 'ventas' | 'ambos') {
  const supabase = await createClient()
  let query = supabase
    .from('retenciones')
    .select('id, tipo, nombre, porcentaje, base_minima, base_uvt, cuenta_contable_id, aplica_a, activa')
    .eq('activa', true)
    .order('tipo')
    .order('nombre')

  if (aplicaA) {
    query = query.or(`aplica_a.eq.${aplicaA},aplica_a.eq.ambos`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as RetencionActiva[]
}
