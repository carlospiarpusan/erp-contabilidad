import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { listAdjuntosPrivados, uploadAdjuntoPrivado } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

const RELATION_TYPES = new Set(['documento', 'asiento', 'recibo', 'pago_proveedor', 'documento_soporte'])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/xml',
  'text/xml',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
])

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const relationType = String(req.nextUrl.searchParams.get('relation_type') ?? '')
    const relationId = String(req.nextUrl.searchParams.get('relation_id') ?? '')
    if (!RELATION_TYPES.has(relationType) || !relationId) {
      return NextResponse.json({ error: 'relation_type y relation_id son requeridos' }, { status: 400 })
    }

    const data = await listAdjuntosPrivados({
      relationType: relationType as 'documento' | 'asiento' | 'recibo' | 'pago_proveedor' | 'documento_soporte',
      relationId,
    })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await req.formData()
    const relationType = String(formData.get('relation_type') ?? '')
    const relationId = String(formData.get('relation_id') ?? '')
    const tipoDocumental = String(formData.get('tipo_documental') ?? 'soporte')
    const file = formData.get('archivo')

    if (!RELATION_TYPES.has(relationType) || !relationId) {
      return NextResponse.json({ error: 'relation_type y relation_id son requeridos' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Debes adjuntar un archivo' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el tamaño máximo de 10 MB' }, { status: 400 })
    }
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Se aceptan: PDF, imágenes (JPG, PNG, WebP), XML, CSV y Excel' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const data = await uploadAdjuntoPrivado({
      empresaId: session.empresa_id,
      userId: session.id,
      relationType: relationType as 'documento' | 'asiento' | 'recibo' | 'pago_proveedor' | 'documento_soporte',
      relationId,
      tipoDocumental,
      fileName: file.name,
      mimeType: file.type || null,
      bytes,
      linkedIds: {
        documento_id: typeof formData.get('documento_id') === 'string' ? String(formData.get('documento_id')) : null,
        asiento_id: typeof formData.get('asiento_id') === 'string' ? String(formData.get('asiento_id')) : null,
        recibo_id: typeof formData.get('recibo_id') === 'string' ? String(formData.get('recibo_id')) : null,
        pago_proveedor_id: typeof formData.get('pago_proveedor_id') === 'string' ? String(formData.get('pago_proveedor_id')) : null,
      },
    })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
