import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { registrarAuditoria } from '@/lib/auditoria'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { getEmpresaId } from '@/lib/db/maestros'
import { createAsientoManual } from '@/lib/db/contabilidad'

type Resultado = {
  fila: number
  estado: 'ok' | 'error'
  mensaje?: string
}

type AsientoFila = {
  fila: number
  referencia: string
  fecha: string
  concepto: string
  codigo_cuenta: string
  descripcion_linea: string
  debe: number
  haber: number
}

function parseNumber(value: unknown) {
  const normalized = String(value ?? '').replace(/[^0-9.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
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
    const resultados: Resultado[] = []
    const grupos = new Map<string, AsientoFila[]>()
    const codigosCuenta = new Set<string>()

    for (let i = 0; i < filas.length; i++) {
      const row = filas[i] as Record<string, string>
      const fila = i + 2
      const referencia = row.referencia?.trim()
      const fecha = row.fecha?.trim()
      const concepto = row.concepto?.trim()
      const codigo_cuenta = row.codigo_cuenta?.trim()
      const descripcion_linea = row.descripcion_linea?.trim() ?? ''
      const debe = parseNumber(row.debe)
      const haber = parseNumber(row.haber)

      if (!referencia || !fecha || !concepto || !codigo_cuenta) {
        resultados.push({ fila, estado: 'error', mensaje: 'referencia, fecha, concepto y codigo_cuenta son requeridos' })
        continue
      }
      if ((debe > 0 && haber > 0) || (debe === 0 && haber === 0)) {
        resultados.push({ fila, estado: 'error', mensaje: 'Cada linea debe tener solo debe o solo haber' })
        continue
      }

      const normalizedRow: AsientoFila = {
        fila,
        referencia,
        fecha,
        concepto,
        codigo_cuenta,
        descripcion_linea,
        debe,
        haber,
      }

      codigosCuenta.add(codigo_cuenta)
      grupos.set(referencia, [...(grupos.get(referencia) ?? []), normalizedRow])
    }

    const { data: cuentas, error: cuentasErr } = await supabase
      .from('cuentas_puc')
      .select('id, codigo')
      .eq('empresa_id', empresa_id)
      .in('codigo', [...codigosCuenta])

    if (cuentasErr) {
      throw cuentasErr
    }

    const mapaCuentas = new Map((cuentas ?? []).map((cuenta) => [cuenta.codigo as string, cuenta.id as string]))

    for (const [referencia, lineasGrupo] of grupos.entries()) {
      const fechas = [...new Set(lineasGrupo.map((linea) => linea.fecha))]
      const conceptos = [...new Set(lineasGrupo.map((linea) => linea.concepto))]
      if (fechas.length > 1 || conceptos.length > 1) {
        for (const linea of lineasGrupo) {
          resultados.push({
            fila: linea.fila,
            estado: 'error',
            mensaje: `La referencia ${referencia} mezcla fechas o conceptos distintos`,
          })
        }
        continue
      }

      const faltantes = [...new Set(lineasGrupo.map((linea) => linea.codigo_cuenta).filter((codigo) => !mapaCuentas.has(codigo)))]
      if (faltantes.length > 0) {
        for (const linea of lineasGrupo) {
          resultados.push({
            fila: linea.fila,
            estado: 'error',
            mensaje: `No existe la cuenta ${faltantes.join(', ')} para la referencia ${referencia}`,
          })
        }
        continue
      }

      try {
        const asiento = await createAsientoManual({
          fecha: lineasGrupo[0].fecha,
          concepto: lineasGrupo[0].concepto,
          lineas: lineasGrupo.map((linea) => ({
            cuenta_id: mapaCuentas.get(linea.codigo_cuenta) as string,
            descripcion: linea.descripcion_linea || linea.referencia,
            debe: linea.debe,
            haber: linea.haber,
          })),
        })

        for (const linea of lineasGrupo) {
          resultados.push({
            fila: linea.fila,
            estado: 'ok',
            mensaje: `Asiento #${asiento.numero} (${referencia})`,
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo crear el asiento'
        for (const linea of lineasGrupo) {
          resultados.push({
            fila: linea.fila,
            estado: 'error',
            mensaje: `${message} [${referencia}]`,
          })
        }
      }
    }

    resultados.sort((left, right) => left.fila - right.fila)

    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'import_asientos_contables',
      accion: 'INSERT',
      datos_nuevos: {
        entidad: 'asientos-contables',
        total: filas.length,
        exitosos: resultados.filter((item) => item.estado === 'ok').length,
        fallidos: resultados.filter((item) => item.estado === 'error').length,
        detalle: 'Migracion de asientos y saldos iniciales agrupados por referencia.',
      },
      ip: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ resultados })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
