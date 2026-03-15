const DATAICO_BASE = 'https://api.dataico.com/direct/dataico_api/v2'

export interface DataicoConfig {
  auth_token: string
  account_id: string
  ambiente: 'pruebas' | 'produccion'
  prefijo?: string
  resolucion?: string
  send_dian?: boolean
  send_email?: boolean
  email_copia?: string
}

export interface DataicoCustomer {
  party_type: 'persona_natural' | 'persona_juridica'
  party_identification: string
  party_identification_type: '13' | '31' | '22' | '42' // CC, NIT, CE, documento extranjero
  tax_level_code: '49' | '04' | '05' // no responsable, responsable IVA, régimen simple
  company_name?: string
  first_name?: string
  family_name?: string
  department: string
  city: string
  address_line: string
  phone?: string
  email: string
}

export interface DataicoItem {
  description: string
  code?: string
  quantity: number
  price: number
  tax_rate?: string    // "19.00", "5.00", "0.00"
  discount_rate?: string
  unit_code?: string   // "94" (unidad)
}

export interface DataicoInvoicePayload {
  actions: {
    send_dian: boolean
    send_email: boolean
    email?: string
  }
  invoice: {
    env: 'PRODUCCION' | 'PRUEBAS'
    dataico_account_id: string
    number?: number
    issue_date: string      // "dd/mm/yyyy"
    payment_date?: string
    payment_means_type: 'CONTADO' | 'CREDITO'
    numbering: {
      prefix: string
      resolution_number: string
    }
    customer: DataicoCustomer
    items: {
      sku: string
      quantity: number
      description: string
      price: string
      discount_rate?: string
      taxes: { tax_category: 'IVA'; tax_rate: string }[]
    }[]
    notes?: string[]
  }
}

export interface DataicoResponse {
  invoice_id?: string
  number?: string
  cufe?: string
  qr_code?: string
  status?: string
  pdf_url?: string
  xml_url?: string
  errors?: string[]
}

export async function testDataicoConnection(config: DataicoConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${DATAICO_BASE}/invoices?number=TEST000`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Auth-token': config.auth_token,
      },
    })

    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Auth Token inválido. Verifica tus credenciales en app.dataico.com.' }
    }

    if (res.status >= 500) {
      return { ok: false, message: `Dataico respondió con error del servidor (${res.status}). Intenta más tarde.` }
    }

    // Any 2xx or 404 means the credentials are valid (invoice not found is expected)
    return { ok: true, message: 'Conexión exitosa. Las credenciales de Dataico son válidas.' }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Error desconocido'
    return { ok: false, message: `No se pudo conectar con Dataico: ${errMsg}` }
  }
}

export async function enviarFacturaDataico(
  config: DataicoConfig,
  payload: DataicoInvoicePayload
): Promise<DataicoResponse> {
  const res = await fetch(`${DATAICO_BASE}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Auth-token': config.auth_token,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Error ${res.status}`)
  }

  return data
}

export async function consultarFacturaDataico(
  config: DataicoConfig,
  number: string
): Promise<DataicoResponse> {
  const res = await fetch(`${DATAICO_BASE}/invoices?number=${encodeURIComponent(number)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Auth-token': config.auth_token,
    },
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Error ${res.status}`)
  }

  return data
}
