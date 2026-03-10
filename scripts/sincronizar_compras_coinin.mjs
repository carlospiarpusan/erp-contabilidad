import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

import {
  bootstrapEnv,
  chunk,
  createAdminClient,
  ensureProveedor,
  loadCompraImportContext,
  normalizeCode,
  normalizeDescription,
  normalizeDocRef,
  normalizeLooseCode,
  normalizeText,
  round2,
  safeNumber,
} from './facturas_importadas_utils.mjs'

const log = (...args) => console.log('[compras-coinin]', ...args)
const warn = (...args) => console.warn('[compras-coinin:warn]', ...args)

bootstrapEnv()

const DEFAULT_EMPRESA_ID = '948ce6fc-6337-4f39-9e80-7b2c0ce0166c'
const DEFAULT_BASE_URL = 'https://www.mariaesperanzat.coinin.com.co/'
const DEFAULT_OUTPUT_PATH = '/tmp/coinin_compras_detalle.json'

const EMPRESA_ID = process.env.EMPRESA_ID ?? DEFAULT_EMPRESA_ID
const BASE_URL = normalizeBaseUrl(process.env.COININ_BASE_URL ?? DEFAULT_BASE_URL)
const COININ_USER = requiredValue('COININ_USER', process.env.COININ_USER)
const COININ_PASSWORD = requiredValue('COININ_PASSWORD', process.env.COININ_PASSWORD)
const OUTPUT_PATH = resolve(process.cwd(), process.env.COININ_COMPRAS_OUTPUT_PATH ?? DEFAULT_OUTPUT_PATH)
const REPLACE_EXISTING = process.env.REPLACE_EXISTING === '1'
const CHROME_PATH = findChromePath(process.env.COININ_CHROME_PATH)
const CDP_PORT = parsePositiveInt(
  process.env.COININ_CDP_PORT,
  9300 + Math.floor(Math.random() * 300)
)
const PROFILE_DIR = resolve(
  process.cwd(),
  process.env.COININ_PROFILE_DIR ?? '/tmp/chrome-coinin-compras-profile'
)

const admin = createAdminClient()

function requiredValue(name, value) {
  if (!value) throw new Error(`Falta ${name}. Exporta la variable antes de ejecutar el script.`)
  return value
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return DEFAULT_BASE_URL
  return raw.endsWith('/') ? raw : `${raw}/`
}

function findChromePath(preferred) {
  const candidates = [
    preferred,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ].filter(Boolean)

  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) {
    throw new Error('No se encontró Chrome/Chromium. Define COININ_CHROME_PATH.')
  }
  return found
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl
    this.ws = null
    this.nextId = 1
    this.pending = new Map()
    this.listeners = []
  }

  async connect() {
    this.ws = new WebSocket(this.webSocketUrl)
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(JSON.stringify(message.error)))
        else resolve(message.result)
        return
      }

      for (const listener of this.listeners) listener(message)
    }

    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = reject
    })
  }

  close() {
    try {
      this.ws?.close()
    } catch {}
  }

  async send(method, params = {}, sessionId) {
    const id = this.nextId++
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId

    this.ws.send(JSON.stringify(payload))
    return await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })
  }

  async waitFor(method, sessionId, timeoutMs = 30_000) {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Timeout esperando ${method}`))
      }, timeoutMs)

      const listener = (message) => {
        if (message.method !== method) return
        if (sessionId && message.sessionId !== sessionId) return
        cleanup()
        resolve(message.params ?? {})
      }

      const cleanup = () => {
        clearTimeout(timeout)
        const index = this.listeners.indexOf(listener)
        if (index >= 0) this.listeners.splice(index, 1)
      }

      this.listeners.push(listener)
    })
  }

  async createPage(url = 'about:blank') {
    const { targetId } = await this.send('Target.createTarget', { url })
    const { sessionId } = await this.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    })

    await this.send('Page.enable', {}, sessionId)
    await this.send('Runtime.enable', {}, sessionId)

    return sessionId
  }

  async navigate(sessionId, url, timeoutMs = 30_000) {
    const loadEvent = this.waitFor('Page.loadEventFired', sessionId, timeoutMs)
    await this.send('Page.navigate', { url }, sessionId)
    await loadEvent
    await delay(1_000)
  }

  async evaluate(sessionId, expression) {
    const result = await this.send(
      'Runtime.evaluate',
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
      },
      sessionId
    )

    if (result.exceptionDetails) {
      const text = result.exceptionDetails.text ?? 'Error evaluando Runtime.evaluate'
      throw new Error(text)
    }

    return result?.result?.value
  }
}

async function startChrome() {
  rmSync(PROFILE_DIR, { recursive: true, force: true })
  mkdirSync(PROFILE_DIR, { recursive: true })

  const child = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-software-rasterizer',
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Chrome terminó antes de iniciar CDP (exit ${child.exitCode})`)
    }

    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
      if (response.ok) {
        const json = await response.json()
        return {
          child,
          webSocketUrl: json.webSocketDebuggerUrl,
        }
      }
    } catch {}

    await delay(500)
  }

  child.kill('SIGKILL')
  throw new Error('No se pudo abrir Chrome con DevTools remoto')
}

async function loginToCoinIn(cdp, sessionId) {
  await cdp.navigate(sessionId, BASE_URL)

  const loginResult = await cdp.evaluate(
    sessionId,
    `(() => {
      const userInput = document.querySelector('input[name="user"]');
      const passwordInput = document.querySelector('input[name="password"]');
      const form = document.forms[0];
      if (!userInput || !passwordInput || !form) {
        return { ok: false, reason: 'No se encontró el formulario de login', href: location.href };
      }

      userInput.value = ${JSON.stringify(COININ_USER)};
      passwordInput.value = ${JSON.stringify(COININ_PASSWORD)};
      form.submit();
      return { ok: true, href: location.href };
    })()`
  )

  if (!loginResult?.ok) throw new Error(loginResult?.reason ?? 'No se pudo enviar el formulario')

  try {
    await cdp.waitFor('Page.loadEventFired', sessionId, 30_000)
  } catch {}
  await delay(2_500)

  const state = await cdp.evaluate(
    sessionId,
    `({
      href: location.href,
      body: document.body ? document.body.innerText : '',
      title: document.title,
    })`
  )

  if (
    String(state?.href ?? '').includes('page=') &&
    String(state?.body ?? '').includes('Menú de administración')
  ) {
    return state
  }

  throw new Error('Login en Coin In falló o devolvió una pantalla inesperada')
}

async function installHelpers(cdp, sessionId) {
  const ready = await cdp.evaluate(
    sessionId,
    `
      (() => {
        const cleanText = (value) =>
          String(value ?? '')
            .replace(/\\u00A0/g, ' ')
            .replace(/\\s+/g, ' ')
            .trim();

        const parseNumber = (value) => {
          const normalized = cleanText(value)
            .replace(/[$%]/g, '')
            .replace(/\\./g, '')
            .replace(/,/g, '.');
          const parsed = Number(normalized);
          return Number.isFinite(parsed) ? parsed : 0;
        };

        const requireSession = (html) => {
          if (html.includes('name="forminicio"') || html.includes("name='forminicio'")) {
            throw new Error('Sesion Coin In expirada durante la sincronización');
          }
        };

        const parseListHtml = (html) => {
          requireSession(html);
          const doc = new DOMParser().parseFromString(html, 'text/html');
          return Array.from(doc.querySelectorAll('tr.clickableRow[href][data-codigo]'))
            .map((row) => {
              const cells = Array.from(row.querySelectorAll('td')).map((cell) => cleanText(cell.textContent));
              return {
                href: row.getAttribute('href') || '',
                numero_interno: cleanText(row.getAttribute('data-codigo')),
                proveedor: cells[0] || '',
                numero_externo: cells[2] || '',
                estado: cells[3] || '',
                fecha: cells[4] || '',
                hora: cells[5] || '',
                total: parseNumber(cells[6]),
                observaciones: cells[7] || '',
              };
            })
            .filter((row) => row.href && row.numero_externo);
        };

        const parseDetailHtml = (html, meta) => {
          requireSession(html);
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const table = Array.from(doc.querySelectorAll('table')).find((candidate) => {
            const headers = Array.from(candidate.querySelectorAll('th')).map((cell) => cleanText(cell.textContent));
            return headers.includes('Código') && headers.includes('Descripción') && headers.includes('Cantidad');
          });

          const proveedorInput =
            doc.querySelector('a[href*="compras_proveedor"]')?.parentElement?.querySelector('input') ??
            doc.querySelector('input[value][readonly]');

          const lineas = [];
          for (const row of Array.from(table?.querySelectorAll('tbody tr') ?? [])) {
            const cells = Array.from(row.querySelectorAll('td')).map((cell) => cleanText(cell.textContent));
            if (cells.length < 9) continue;
            if (!cells[1] || !cells[2]) continue;

            lineas.push({
              codigo: cells[1],
              descripcion: cells[2],
              cantidad: parseNumber(cells[3]),
              precio_lista: parseNumber(cells[4]),
              descuento_porcentaje: parseNumber(cells[5]),
              neto: parseNumber(cells[6]),
              iva_porcentaje: parseNumber(cells[7]),
              total: parseNumber(cells[8]),
            });
          }

          return {
            href: meta?.href ?? '',
            numero_interno: meta?.numero_interno ?? '',
            proveedor: cleanText(proveedorInput?.value) || meta?.proveedor || '',
            numero_externo: cleanText(doc.querySelector('input[name="numproveedor"]')?.value) || meta?.numero_externo || '',
            fecha: cleanText(doc.querySelector('input[name="fecha"]')?.value) || meta?.fecha || '',
            hora: cleanText(doc.querySelector('input[name="hora"]')?.value) || meta?.hora || '',
            vencimiento: cleanText(doc.querySelector('input[name="vencimiento"]')?.value) || '',
            forma_pago: cleanText(doc.querySelector('select[name="forma_pago"] option:checked')?.textContent) || '',
            observaciones: cleanText(doc.querySelector('textarea[name="observaciones"]')?.value) || meta?.observaciones || '',
            estado: meta?.estado || '',
            total_lista: meta?.total || 0,
            lineas,
          };
        };

        const parseVentasListHtml = (html) => {
          requireSession(html);
          const doc = new DOMParser().parseFromString(html, 'text/html');
          return Array.from(doc.querySelectorAll('tr.table-row[data-href][data-codigo]'))
            .map((row) => ({
              href: row.getAttribute('data-href') || '',
              numero: cleanText(row.getAttribute('data-codigo')),
            }))
            .filter((row) => row.href && row.numero);
        };

        globalThis.__codexCoinInCompras = {
          async fetchText(path) {
            const url = /^https?:/i.test(path) ? path : new URL(path, location.origin).toString();
            const response = await fetch(url, {
              credentials: 'include',
              redirect: 'follow',
            });
            return await response.text();
          },
          async fetchList(path) {
            const html = await this.fetchText(path);
            return parseListHtml(html);
          },
          async fetchBatch(items) {
            return await Promise.all(
              items.map(async (item) => {
                const html = await this.fetchText(item.href);
                return parseDetailHtml(html, item);
              })
            );
          },
          async fetchVentasList(path) {
            const html = await this.fetchText(path);
            return parseVentasListHtml(html);
          },
        };

        return 'ready';
      })()
    `
  )

  if (ready !== 'ready') throw new Error('No se pudieron instalar los helpers de Coin In')
}

async function fetchCompras(cdp, sessionId) {
  const compras = []

  for (let offset = 0; ; offset += 50) {
    const path = offset === 0
      ? 'index.php?page=facturasdecompra'
      : `index.php?page=facturasdecompra&offset=${offset}`

    const rows = await cdp.evaluate(
      sessionId,
      `globalThis.__codexCoinInCompras.fetchList(${JSON.stringify(path)})`
    )

    if (!rows?.length) break
    compras.push(...rows)
    log(`Compras indexadas: ${compras.length}`)
    if (rows.length < 50) break
  }

  const detalles = []
  for (const batch of chunk(compras, 5)) {
    const rows = await cdp.evaluate(
      sessionId,
      `globalThis.__codexCoinInCompras.fetchBatch(${JSON.stringify(batch)})`
    )

    detalles.push(...(rows ?? []))
    if (detalles.length % 10 === 0 || detalles.length === compras.length) {
      log(`Detalles de compras extraídos: ${detalles.length}/${compras.length}`)
    }
  }

  return detalles
}

function normalizeCompraStatus(value) {
  const normalized = normalizeDescription(value)
  if (normalized.includes('PAGADA')) return 'pagada'
  if (normalized.includes('CANCEL')) return 'cancelada'
  return 'pendiente'
}

function buildDocumentPayload(compra, context, proveedorId) {
  const fecha = formatDate(compra.fecha)
  const anio = fecha.slice(0, 4)

  const subtotal = round2(compra.lineas.reduce((sum, linea) => sum + safeNumber(linea.neto, 0), 0))
  const total = round2(compra.lineas.reduce((sum, linea) => sum + safeNumber(linea.total, 0), 0))
  const totalIva = round2(total - subtotal)

  return {
    empresa_id: EMPRESA_ID,
    tipo: 'factura_compra',
    proveedor_id: proveedorId,
    bodega_id: context.bodegaId,
    ejercicio_id: context.ejerciciosPorAnio[anio] ?? null,
    fecha,
    fecha_vencimiento: formatDate(compra.vencimiento) || fecha,
    numero_externo: normalizeText(compra.numero_externo),
    subtotal,
    total_iva: totalIva,
    total_descuento: 0,
    total,
    estado: normalizeCompraStatus(compra.estado),
    observaciones: normalizeText(compra.observaciones) || 'Importado desde Coin In ERP',
  }
}

function formatDate(value) {
  const raw = normalizeText(value)
  if (!raw) return ''
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return raw
  return `${match[3]}-${match[2]}-${match[1]}`
}

function resolveProducto(linea, context) {
  const byCode =
    context.productosPorCodigo.get(normalizeCode(linea.codigo)) ??
    context.productosPorCodigoLoose.get(normalizeLooseCode(linea.codigo))
  if (byCode) return byCode

  return context.productosPorDescripcion.get(normalizeDescription(linea.descripcion)) ?? null
}

function buildLineas(documentoId, compra, context) {
  return compra.lineas.map((linea, index) => {
    const cantidad = Math.max(0.001, safeNumber(linea.cantidad, 1))
    const subtotal = round2(safeNumber(linea.neto, 0))
    const total = round2(safeNumber(linea.total, subtotal))
    const totalIva = round2(total - subtotal)
    const producto = resolveProducto(linea, context)
    const precioNetoUnitario = round2(subtotal / cantidad)
    const impuestoId = context.impuestosPorPorcentaje.get(Number(safeNumber(linea.iva_porcentaje, 0))) ?? null

    return {
      documento_id: documentoId,
      producto_id: producto?.id ?? null,
      variante_id: null,
      descripcion: normalizeText(linea.descripcion) || `Ítem compra ${index + 1}`,
      cantidad,
      precio_unitario: precioNetoUnitario,
      precio_costo: precioNetoUnitario,
      descuento_porcentaje: 0,
      impuesto_id: impuestoId,
      subtotal,
      total_descuento: 0,
      total_iva: totalIva,
      total,
      orden: index,
    }
  })
}

async function loadExistingCompras() {
  const compras = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await admin
      .from('documentos')
      .select('id, numero, numero_externo, observaciones')
      .eq('empresa_id', EMPRESA_ID)
      .eq('tipo', 'factura_compra')
      .order('numero', { ascending: true })
      .range(from, to)

    if (error) throw error
    if (!data?.length) break

    compras.push(...data)
    if (data.length < pageSize) break
  }

  return compras
}

async function loadLineCounts(documentoIds) {
  const counts = new Map(documentoIds.map((id) => [id, 0]))

  for (const idsChunk of chunk(documentoIds, 200)) {
    let from = 0
    for (;;) {
      const { data, error } = await admin
        .from('documentos_lineas')
        .select('documento_id, id')
        .in('documento_id', idsChunk)
        .order('id')
        .range(from, from + 999)

      if (error) throw error
      if (!data?.length) break

      for (const row of data) {
        counts.set(row.documento_id, (counts.get(row.documento_id) ?? 0) + 1)
      }

      if (data.length < 1000) break
      from += 1000
    }
  }

  return counts
}

async function verifyVentasLatest(cdp, sessionId) {
  const rows = await cdp.evaluate(
    sessionId,
    `globalThis.__codexCoinInCompras.fetchVentasList('index.php?page=facturasdeventa&mostrar=buscar&query=&codagente=&codalmacen=&codcliente=&codgrupo=&codpago=&codserie=&codejercicio=2026&desde=&estado=activas&hasta=&offset=0')`
  )

  const maxCoinIn = Number.parseInt(String(rows?.[0]?.numero ?? ''), 10)
  const { data, error } = await admin
    .from('documentos')
    .select('numero')
    .eq('empresa_id', EMPRESA_ID)
    .eq('tipo', 'factura_venta')
    .order('numero', { ascending: false })
    .limit(1)

  if (error) throw error

  const maxSupabase = Number(data?.[0]?.numero ?? 0)
  return {
    maxCoinIn,
    maxSupabase,
    hay_nuevas: Number.isFinite(maxCoinIn) && maxCoinIn > maxSupabase,
  }
}

async function main() {
  const chrome = await startChrome()
  const cdp = new CdpClient(chrome.webSocketUrl)

  try {
    await cdp.connect()
    const sessionId = await cdp.createPage()

    const session = await loginToCoinIn(cdp, sessionId)
    log(`Sesión iniciada en ${session.href}`)
    await installHelpers(cdp, sessionId)

    const comprasCoinIn = await fetchCompras(cdp, sessionId)
    writeFileSync(
      OUTPUT_PATH,
      JSON.stringify(
        {
          generado_en: new Date().toISOString(),
          total: comprasCoinIn.length,
          compras: comprasCoinIn,
        },
        null,
        2
      )
    )

    const context = await loadCompraImportContext(admin, EMPRESA_ID)
    const comprasDb = await loadExistingCompras()
    const existingByRef = new Map()
    for (const compra of comprasDb) {
      const key = normalizeDocRef(compra.numero_externo)
      if (!key || existingByRef.has(key)) continue
      existingByRef.set(key, compra)
    }

    const nextNumeroBase = Math.max(0, ...comprasDb.map((compra) => Number(compra.numero ?? 0)))
    let nextNumero = nextNumeroBase + 1

    const matched = []
    const inserted = []
    const docsToReplace = []
    const docsToInsertLineas = []

    for (const compra of comprasCoinIn) {
      const proveedorKey = normalizeDescription(compra.proveedor)
      let proveedor = context.proveedoresPorNombre.get(proveedorKey) ?? null
      if (!proveedor) {
        proveedor = await ensureProveedor(admin, EMPRESA_ID, compra.proveedor)
        context.proveedoresPorNombre.set(proveedorKey, proveedor)
      }

      const payload = buildDocumentPayload(compra, context, proveedor.id)
      const refKey = normalizeDocRef(compra.numero_externo)
      const existente = existingByRef.get(refKey) ?? null

      if (existente) {
        const { error: updateError } = await admin
          .from('documentos')
          .update(payload)
          .eq('id', existente.id)

        if (updateError) throw updateError
        matched.push(existente.id)
        docsToReplace.push({ id: existente.id, compra })
        continue
      }

      const { data: creado, error: insertError } = await admin
        .from('documentos')
        .insert({
          ...payload,
          numero: nextNumero,
          prefijo: 'C',
        })
        .select('id, numero, numero_externo')
        .single()

      if (insertError) throw insertError

      nextNumero += 1
      inserted.push(creado.id)
      existingByRef.set(refKey, creado)
      docsToInsertLineas.push({ id: creado.id, compra })
    }

    const counts = await loadLineCounts(matched)
    for (const item of docsToReplace) {
      const lineCount = counts.get(item.id) ?? 0
      if (lineCount === 0 || REPLACE_EXISTING) {
        docsToInsertLineas.push(item)
      }
    }

    const idsToDelete = docsToInsertLineas
      .map((item) => item.id)
      .filter((id) => (counts.get(id) ?? 0) > 0)

    for (const idsChunk of chunk(idsToDelete, 200)) {
      const { error } = await admin
        .from('documentos_lineas')
        .delete()
        .in('documento_id', idsChunk)

      if (error) throw error
    }

    let totalLineas = 0
    let lineasConProducto = 0
    let lineasSinProducto = 0

    for (const itemsChunk of chunk(docsToInsertLineas, 50)) {
      const lineas = itemsChunk.flatMap((item) => buildLineas(item.id, item.compra, context))
      if (!lineas.length) continue

      const { error } = await admin.from('documentos_lineas').insert(lineas)
      if (error) throw error

      totalLineas += lineas.length
      lineasConProducto += lineas.filter((linea) => Boolean(linea.producto_id)).length
      lineasSinProducto += lineas.filter((linea) => !linea.producto_id).length
      log(`Líneas de compra sincronizadas: ${totalLineas}`)
    }

    const ventasCheck = await verifyVentasLatest(cdp, sessionId)

    log(`✓ Snapshot guardado en ${OUTPUT_PATH}`)
    log(`✓ Compras en Coin In: ${comprasCoinIn.length}`)
    log(`✓ Compras ya existentes actualizadas: ${matched.length}`)
    log(`✓ Compras nuevas insertadas: ${inserted.length}`)
    log(`✓ Compras con líneas sincronizadas: ${docsToInsertLineas.length}`)
    log(`✓ Líneas creadas: ${totalLineas}`)
    log(`✓ Líneas con producto mapeado: ${lineasConProducto}`)
    log(`✓ Líneas sin producto mapeado: ${lineasSinProducto}`)
    if (ventasCheck.hay_nuevas) {
      warn(`Ventas nuevas detectadas en Coin In: máximo ${ventasCheck.maxCoinIn} vs Supabase ${ventasCheck.maxSupabase}`)
    } else {
      log(`✓ Ventas nuevas no detectadas: Coin In ${ventasCheck.maxCoinIn} / Supabase ${ventasCheck.maxSupabase}`)
    }
  } finally {
    cdp.close()
    try {
      chrome.child.kill('SIGKILL')
    } catch {}
    try {
      rmSync(PROFILE_DIR, { recursive: true, force: true })
    } catch (error) {
      warn(`No se pudo limpiar el perfil temporal de Chrome: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
