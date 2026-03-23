import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { getEmpresaId } from '@/lib/db/maestros'

const TIPOS_CUENTA = new Set(['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo'])
const NATURALEZAS = new Set(['debito', 'credito'])

function parseBoolean(value: string | undefined, fallback = true) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return fallback
  if (['1', 'si', 'sí', 'true', 'activo'].includes(normalized)) return true
  if (['0', 'no', 'false', 'inactivo'].includes(normalized)) return false
  return fallback
}

function defaultNaturaleza(tipo: string) {
  return ['pasivo', 'patrimonio', 'ingreso'].includes(tipo) ? 'credito' : 'debito'
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'configuracion', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para importar datos' }, { status: 403 })
    }

    const { filas } = await req.json()
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 })
    }

    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])
    const resultados: Array<{ fila: number; estado: 'ok' | 'error'; mensaje?: string }> = []
    const seenCodes = new Set<string>()
    const filasOrdenadas = filas
      .map((current, index) => ({
        current: current as Record<string, string>,
        fila: index + 2,
        nivel: Number((current as Record<string, string>).nivel),
      }))
      .sort((left, right) => {
        const leftNivel = Number.isFinite(left.nivel) ? left.nivel : Number.MAX_SAFE_INTEGER
        const rightNivel = Number.isFinite(right.nivel) ? right.nivel : Number.MAX_SAFE_INTEGER
        if (leftNivel !== rightNivel) return leftNivel - rightNivel
        return left.fila - right.fila
      })

    for (const item of filasOrdenadas) {
      const fila = item.fila
      const current = item.current
      const codigo = current.codigo?.trim()
      const descripcion = current.descripcion?.trim()
      const tipo = current.tipo?.trim().toLowerCase()
      const nivel = Number(current.nivel)
      const naturaleza = (current.naturaleza?.trim().toLowerCase() || defaultNaturaleza(tipo)) as 'debito' | 'credito'
      const codigoPadre = current.codigo_padre?.trim()

      if (!codigo || !descripcion || !tipo || !Number.isFinite(nivel)) {
        resultados.push({ fila, estado: 'error', mensaje: 'codigo, descripcion, tipo y nivel son requeridos' })
        continue
      }
      if (seenCodes.has(codigo)) {
        resultados.push({ fila, estado: 'error', mensaje: `El codigo ${codigo} está repetido dentro del archivo` })
        continue
      }
      if (!TIPOS_CUENTA.has(tipo)) {
        resultados.push({ fila, estado: 'error', mensaje: 'tipo invalido' })
        continue
      }
      if (nivel < 1 || nivel > 5) {
        resultados.push({ fila, estado: 'error', mensaje: 'nivel invalido (1-5)' })
        continue
      }
      if (!NATURALEZAS.has(naturaleza)) {
        resultados.push({ fila, estado: 'error', mensaje: 'naturaleza invalida' })
        continue
      }

      let cuentaPadreId: string | null = null
      if (codigoPadre) {
        const { data: padre, error: padreErr } = await supabase
          .from('cuentas_puc')
          .select('id')
          .eq('empresa_id', empresa_id)
          .eq('codigo', codigoPadre)
          .maybeSingle()

        if (padreErr) {
          resultados.push({ fila, estado: 'error', mensaje: padreErr.message })
          continue
        }
        if (!padre?.id) {
          resultados.push({ fila, estado: 'error', mensaje: `La cuenta padre ${codigoPadre} no existe todavia` })
          continue
        }
        cuentaPadreId = padre.id as string
      }

      const { error } = await supabase
        .from('cuentas_puc')
        .upsert({
          empresa_id,
          codigo,
          descripcion,
          tipo,
          nivel,
          naturaleza,
          cuenta_padre_id: cuentaPadreId,
          activa: parseBoolean(current.activa, true),
        }, { onConflict: 'empresa_id,codigo' })

      if (error) {
        resultados.push({ fila, estado: 'error', mensaje: error.message })
        continue
      }

      resultados.push({ fila, estado: 'ok', mensaje: codigo })
      seenCodes.add(codigo)
    }

    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'import_cuentas_puc',
      accion: 'INSERT',
      datos_nuevos: {
        entidad: 'cuentas-puc',
        total: filas.length,
        exitosos: resultados.filter((item) => item.estado === 'ok').length,
        fallidos: resultados.filter((item) => item.estado === 'error').length,
        detalle: 'Migracion del plan unico de cuentas desde Configuracion > Migracion e Importacion.',
      },
      ip: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ resultados })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
