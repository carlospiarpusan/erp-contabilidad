import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'

// ── Parsea XML DIAN UBL 2.1 y devuelve cabecera + líneas + estado de productos ──

function extractText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<[^:>]*:?${tag}[^>]*>([^<]*)<`, 'i'))
  return m?.[1]?.trim() ?? ''
}

function extractAll(xml: string, tag: string): string[] {
  const results: string[] = []
  const re = new RegExp(`<[^:>]*:?${tag}[^>]*>([^<]*)<`, 'gi')
  let m
  while ((m = re.exec(xml)) !== null) {
    if (m[1].trim()) results.push(m[1].trim())
  }
  return results
}

function extractBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = []
  const openRe  = new RegExp(`<[^:>]*:?${tag}[\\s>]`, 'gi')
  const closeRe = new RegExp(`</[^:>]*:?${tag}>`, 'gi')
  let pos = 0
  let depth = 0
  let start = -1

  for (let i = 0; i < xml.length; i++) {
    openRe.lastIndex = i
    closeRe.lastIndex = i

    const openMatch  = openRe.exec(xml)
    const closeMatch = closeRe.exec(xml)

    if (openMatch && openMatch.index === i) {
      if (depth === 0) start = i
      depth++
      i = openMatch.index + openMatch[0].length - 2
    } else if (closeMatch && closeMatch.index === i) {
      depth--
      if (depth === 0 && start !== -1) {
        blocks.push(xml.slice(start, closeMatch.index + closeMatch[0].length))
        start = -1
      }
      i = closeMatch.index + closeMatch[0].length - 2
    }
    void pos
  }
  return blocks
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('archivo') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const xml = await file.text()

    // ── Cabecera ──────────────────────────────────────────────────────────────
    const numero_externo = extractText(xml, 'ID') || extractText(xml, 'InvoiceID')
    const fecha_raw      = extractText(xml, 'IssueDate')
    const fecha          = fecha_raw || new Date().toISOString().split('T')[0]

    // Proveedor (AccountingSupplierParty)
    const nit_proveedor  = extractText(xml, 'CompanyID') || extractText(xml, 'AdditionalAccountID')
    const nombre_proveedor = extractText(xml, 'RegistrationName') || extractText(xml, 'Name')

    // Totales globales
    const total_raw     = extractText(xml, 'PayableAmount') || extractText(xml, 'TaxInclusiveAmount')
    const subtotal_raw  = extractText(xml, 'LineExtensionAmount') || extractText(xml, 'TaxExclusiveAmount')
    const iva_raw       = extractText(xml, 'TaxAmount')

    const total    = parseFloat(total_raw)    || 0
    const subtotal = parseFloat(subtotal_raw) || 0
    const iva      = parseFloat(iva_raw)      || 0

    // ── Líneas (InvoiceLine) ──────────────────────────────────────────────────
    // Intentar parseo de líneas con regex sencillo
    const lineas_xml = extractBlocks(xml, 'InvoiceLine')
    const lineas_raw: {
      descripcion: string
      codigo: string
      cantidad: number
      precio_unitario: number
      subtotal: number
      iva: number
      total: number
    }[] = []

    if (lineas_xml.length > 0) {
      for (const bloque of lineas_xml) {
        const desc     = extractText(bloque, 'Description') || extractText(bloque, 'Name') || '—'
        const codigo   = extractText(bloque, 'SellersItemIdentification')
                      || extractText(bloque, 'ID')
                      || ''
        const cantidad = parseFloat(extractText(bloque, 'InvoicedQuantity') || '1')
        const precio   = parseFloat(extractText(bloque, 'PriceAmount') || '0')
        const sub      = parseFloat(extractText(bloque, 'LineExtensionAmount') || '0')
        const iva_l    = parseFloat(extractText(bloque, 'TaxAmount') || '0')
        const tot      = sub + iva_l

        lineas_raw.push({
          descripcion: desc,
          codigo: codigo.replace(/[^a-zA-Z0-9\-_]/g, '').toUpperCase(),
          cantidad: isNaN(cantidad) ? 1 : cantidad,
          precio_unitario: isNaN(precio) ? (sub / (isNaN(cantidad) ? 1 : cantidad)) : precio,
          subtotal: isNaN(sub) ? 0 : sub,
          iva: isNaN(iva_l) ? 0 : iva_l,
          total: isNaN(tot) ? 0 : tot,
        })
      }
    } else {
      // Si no hay líneas individuales, crear una sola línea con el total
      lineas_raw.push({
        descripcion: `Factura ${numero_externo}`,
        codigo: '',
        cantidad: 1,
        precio_unitario: subtotal || total,
        subtotal: subtotal || total,
        iva,
        total,
      })
    }

    // ── Buscar productos por código en nuestra DB ─────────────────────────────
    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])
    const { data: proveedores } = await supabase
      .from('proveedores')
      .select('id, numero_documento, razon_social')
      .eq('empresa_id', empresa_id)

    // Buscar proveedor por NIT
    const proveedor = proveedores?.find(p =>
      p.numero_documento?.replace(/[^0-9]/g, '') === nit_proveedor?.replace(/[^0-9]/g, '')
    ) ?? null

    // Para cada línea, buscar el producto
    const { data: productos } = await supabase
      .from('productos')
      .select('id, codigo, descripcion, precio_compra, precio_venta, stock:stock(cantidad)')
      .eq('empresa_id', empresa_id)
      .eq('activo', true)

    const lineas_resultado = lineas_raw.map(l => {
      const producto_encontrado = l.codigo
        ? productos?.find(p => p.codigo.toUpperCase() === l.codigo.toUpperCase()) ?? null
        : null

      return {
        ...l,
        producto_id: producto_encontrado?.id ?? null,
        producto_codigo: producto_encontrado?.codigo ?? null,
        producto_descripcion: producto_encontrado?.descripcion ?? null,
        estado: producto_encontrado ? 'encontrado' : (l.codigo ? 'no_encontrado' : 'sin_codigo'),
      }
    })

    // Bodegas disponibles
    const { data: bodegas } = await supabase
      .from('bodegas')
      .select('id, nombre')
      .eq('empresa_id', empresa_id)
      .eq('activa', true)

    return NextResponse.json({
      cabecera: {
        numero_externo,
        fecha,
        nit_proveedor,
        nombre_proveedor,
        total,
        subtotal,
        iva,
      },
      proveedor,
      lineas: lineas_resultado,
      productos_disponibles: (productos ?? []).map(p => ({ id: p.id, codigo: p.codigo, descripcion: p.descripcion })),
      bodegas: bodegas ?? [],
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al procesar XML' }, { status: 500 })
  }
}
