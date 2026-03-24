import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEjercicioActivo, getEmpresaId } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'
import {
  buildFacturaImportMatches,
  parseFacturaElectronica,
  parseFacturaElectronicaPdf,
  readFacturaElectronicaInput,
  suggestPostingDate,
  type ProductoImportMatch,
} from '@/lib/import/factura-electronica'

export const runtime = 'nodejs'

type ProveedorDisponible = {
  id: string
  numero_documento: string | null
  razon_social: string
}

function normalizeDigits(value: string | null | undefined) {
  return (value ?? '').replace(/[^0-9]/g, '')
}

function nitMatches(left: string | null | undefined, right: string | null | undefined) {
  const a = normalizeDigits(left)
  const b = normalizeDigits(right)
  if (!a || !b) return false
  if (a === b) return true
  return (a.length + 1 === b.length && b.startsWith(a)) || (b.length + 1 === a.length && a.startsWith(b))
}

function getErrorStatus(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message.includes('ZIP') ||
      error.message.includes('PDF') ||
      error.message.includes('XML') ||
      error.message.includes('Invoice') ||
      error.message.includes('ejercicio') ||
      error.message.includes('archivo') ||
      error.message.includes('codigo') ||
      error.message.includes('linea') ||
      error.message.includes('reconciliar')
    ) {
      return 400
    }
  }
  return 500
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('archivo') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No se recibio archivo' }, { status: 400 })
    }

    const { rawXml, pdfText, pdfPages, sourceType } = await readFacturaElectronicaInput(file)
    if (sourceType === 'xml') {
      return NextResponse.json({
        error: 'El XML solo no es suficiente. Sube el PDF o el ZIP original con PDF para usar el codigo de cada articulo.',
      }, { status: 400 })
    }
    const parsed = sourceType === 'pdf'
      ? parseFacturaElectronicaPdf(pdfText ?? '', pdfPages)
      : parseFacturaElectronica(rawXml ?? '', { pdfText, pdfPages })

    const [supabase, empresaId, ejercicio] = await Promise.all([
      createClient(),
      getEmpresaId(),
      getEjercicioActivo(),
    ])

    if (!ejercicio) {
      return NextResponse.json({ error: 'Sin ejercicio contable activo' }, { status: 400 })
    }

    const [{ data: proveedoresData, error: proveedoresError }, { data: productosData, error: productosError }, { data: bodegasData, error: bodegasError }] = await Promise.all([
      supabase
        .from('proveedores')
        .select('id, numero_documento, razon_social')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .order('razon_social'),
      supabase
        .from('productos')
        .select('id, codigo, codigo_barras, descripcion, precio_compra, precio_venta, impuesto_id')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .order('descripcion'),
      supabase
        .from('bodegas')
        .select('id, nombre')
        .eq('empresa_id', empresaId)
        .eq('activa', true)
        .order('nombre'),
    ])

    if (proveedoresError) throw proveedoresError
    if (productosError) throw productosError
    if (bodegasError) throw bodegasError

    const proveedores = (proveedoresData ?? []) as ProveedorDisponible[]
    const productos = (productosData ?? []) as ProductoImportMatch[]
    const nitProveedor = normalizeDigits(parsed.cabecera.nit_proveedor)
    const proveedor = proveedores.find((item) => nitMatches(item.numero_documento, nitProveedor)) ?? null
    const lineas = buildFacturaImportMatches({
      lineas: parsed.lineas,
      productos,
    })
    const fechaContabilizacionSugerida = suggestPostingDate(parsed.cabecera.fecha_original, {
      fecha_inicio: String(ejercicio.fecha_inicio),
      fecha_fin: String(ejercicio.fecha_fin),
    })

    return NextResponse.json({
      cabecera: parsed.cabecera,
      fecha_original: parsed.cabecera.fecha_original,
      fecha_contabilizacion_sugerida: fechaContabilizacionSugerida,
      ejercicio_activo: {
        id: ejercicio.id,
        año: ejercicio.año,
        fecha_inicio: ejercicio.fecha_inicio,
        fecha_fin: ejercicio.fecha_fin,
      },
      proveedor,
      proveedores_disponibles: proveedores,
      lineas,
      productos_disponibles: productos.map((producto) => ({
        id: producto.id,
        codigo: producto.codigo,
        codigo_barras: producto.codigo_barras,
        descripcion: producto.descripcion,
      })),
      bodegas: bodegasData ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar factura electronica' },
      { status: getErrorStatus(error) }
    )
  }
}
