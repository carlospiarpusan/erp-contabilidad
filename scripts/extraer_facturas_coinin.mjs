import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

import {
  bootstrapEnv,
  chunk,
  createAdminClient,
} from './facturas_importadas_utils.mjs'

const log = (...args) => console.log('[coinin]', ...args)
const warn = (...args) => console.warn('[coinin:warn]', ...args)

bootstrapEnv()

const DEFAULT_EMPRESA_ID = '948ce6fc-6337-4f39-9e80-7b2c0ce0166c'
const DEFAULT_OUTPUT_PATH = '/tmp/coinin_facturas_detalle.json'
const DEFAULT_BASE_URL = 'https://www.mariaesperanzat.coinin.com.co/'
const DEFAULT_FACTURAS_PAGE = 'facturasdeventa'
const DEFAULT_PAGE_SIZE = 50
const DEFAULT_CONCURRENCY = 4
const DEFAULT_TIMEOUT_MS = 30_000

const EMPRESA_ID = process.env.EMPRESA_ID ?? DEFAULT_EMPRESA_ID
const BASE_URL = normalizeBaseUrl(process.env.COININ_BASE_URL ?? DEFAULT_BASE_URL)
const COININ_USER = requiredValue('COININ_USER', process.env.COININ_USER)
const COININ_PASSWORD = requiredValue('COININ_PASSWORD', process.env.COININ_PASSWORD)
const OUTPUT_PATH = resolve(process.cwd(), process.env.COININ_OUTPUT_PATH ?? DEFAULT_OUTPUT_PATH)
const FACTURAS_PAGE = process.env.COININ_FACTURAS_PAGE ?? DEFAULT_FACTURAS_PAGE
const PAGE_SIZE = parsePositiveInt(process.env.COININ_PAGE_SIZE, DEFAULT_PAGE_SIZE)
const CONCURRENCY = parsePositiveInt(process.env.COININ_CONCURRENCY, DEFAULT_CONCURRENCY)
const MAX_FACTURAS = parsePositiveInt(process.env.COININ_MAX_FACTURAS, 0)
const CDP_TIMEOUT_MS = parsePositiveInt(process.env.COININ_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
const CDP_PORT = parsePositiveInt(
  process.env.COININ_CDP_PORT,
  9200 + Math.floor(Math.random() * 400)
)
const PROFILE_DIR = resolve(
  process.cwd(),
  process.env.COININ_PROFILE_DIR ?? '/tmp/chrome-coinin-profile'
)
const CHROME_PATH = findChromePath(process.env.COININ_CHROME_PATH)

const admin = createAdminClient()

function requiredValue(name, value) {
  if (!value) {
    throw new Error(`Falta ${name}. Exporta la variable de entorno antes de ejecutar el script.`)
  }
  return value
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return DEFAULT_BASE_URL
  return raw.endsWith('/') ? raw : `${raw}/`
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseYears(value) {
  const years = String(value ?? '')
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 2000)

  return [...new Set(years)].sort((a, b) => a - b)
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
    throw new Error('No se encontró Chrome/Chromium. Define COININ_CHROME_PATH con la ruta correcta.')
  }
  return found
}

async function loadImportedFacturas() {
  const facturas = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await admin
      .from('documentos')
      .select('id, numero, prefijo, fecha')
      .eq('empresa_id', EMPRESA_ID)
      .eq('tipo', 'factura_venta')
      .ilike('observaciones', '%Coin In ERP%')
      .order('fecha', { ascending: true })
      .range(from, to)

    if (error) throw error
    if (!data?.length) break

    facturas.push(...data)
    if (data.length < pageSize) break
  }

  return facturas
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

  async waitFor(method, sessionId, timeoutMs = CDP_TIMEOUT_MS) {
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

  async navigate(sessionId, url, timeoutMs = CDP_TIMEOUT_MS) {
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

  const args = [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-software-rasterizer',
    'about:blank',
  ]

  const child = spawn(CHROME_PATH, args, {
    stdio: 'ignore',
  })

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

async function installPageHelpers(cdp, sessionId) {
  const expression = `
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
          throw new Error('Sesion Coin In expirada durante la extracción');
        }
      };

      const parseFacturaNumber = (doc, fallback) => {
        const title = cleanText(doc.querySelector('title')?.textContent);
        const bodyText = cleanText(doc.body?.innerText);
        const match =
          title.match(/N[°º]\\s*(\\d+)/i) ||
          bodyText.match(/Factura de venta N[°º]\\s*(\\d+)/i);
        return match?.[1] ?? String(fallback ?? '');
      };

      const parseListHtml = (html) => {
        requireSession(html);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return Array.from(doc.querySelectorAll('tr.table-row[data-href][data-codigo]'))
          .map((row) => {
            const href = row.getAttribute('data-href') || '';
            const match = href.match(/id=(\\d+)/);
            if (!match) return null;
            return {
              id: Number(match[1]),
              numero: cleanText(row.getAttribute('data-codigo')),
              href,
            };
          })
          .filter(Boolean);
      };

      const parseDetailHtml = (html, meta) => {
        requireSession(html);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const table = Array.from(doc.querySelectorAll('table')).find((candidate) => {
          const headers = Array.from(candidate.querySelectorAll('th')).map((cell) => cleanText(cell.textContent));
          return headers.includes('Código') && headers.includes('Descripción') && headers.includes('Cantidad');
        });

        const lineas = [];
        for (const row of Array.from(table?.querySelectorAll('tbody tr') ?? [])) {
          const cells = Array.from(row.querySelectorAll('td')).map((cell) => cleanText(cell.textContent));
          if (cells.length < 9) continue;
          if (!cells[1] || !cells[2]) continue;
          if (/^Total productos$/i.test(cells[0])) continue;

          lineas.push({
            codigo: cells[1],
            descripcion: cells[2],
            cantidad: parseNumber(cells[3]),
            precio_unitario: parseNumber(cells[4]),
            descuento_porcentaje: parseNumber(cells[5]),
            subtotal: parseNumber(cells[6]),
            iva_porcentaje: parseNumber(cells[7]),
            total: parseNumber(cells[8]),
          });
        }

        return {
          numero: parseFacturaNumber(doc, meta?.numero),
          prefijo: 'F',
          coinin_id: meta?.id ?? null,
          href: meta?.href ?? '',
          lineas,
        };
      };

      globalThis.__codexCoinIn = {
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
              const html = await this.fetchText('index.php?page=facturadeventa&id=' + item.id);
              return parseDetailHtml(html, item);
            })
          );
        },
      };

      return 'ready';
    })()
  `

  const ready = await cdp.evaluate(sessionId, expression)
  if (ready !== 'ready') {
    throw new Error('No se pudieron instalar los helpers de Coin In en la página')
  }
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

  if (!loginResult?.ok) {
    throw new Error(loginResult?.reason ?? 'No se pudo enviar el formulario de Coin In')
  }

  try {
    await cdp.waitFor('Page.loadEventFired', sessionId, CDP_TIMEOUT_MS)
  } catch {}
  await delay(2_500)

  const sessionState = await cdp.evaluate(
    sessionId,
    `({
      href: location.href,
      body: document.body ? document.body.innerText : '',
      title: document.title,
    })`
  )

  if (
    String(sessionState?.href ?? '').includes('page=') &&
    String(sessionState?.body ?? '').includes('Menú de administración')
  ) {
    return sessionState
  }

  throw new Error('Login en Coin In falló o devolvió una pantalla inesperada')
}

async function collectInvoiceIndex(cdp, sessionId, years, targetNumbers) {
  const targetSet = new Set(targetNumbers.map((value) => String(value)))
  const byNumero = new Map()

  for (const year of years) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const path = `index.php?page=${FACTURAS_PAGE}&mostrar=buscar&query=&codagente=&codalmacen=&codcliente=&codgrupo=&codpago=&codserie=&codejercicio=${year}&desde=&estado=activas&hasta=&offset=${offset}`
      const rows = await cdp.evaluate(
        sessionId,
        `globalThis.__codexCoinIn.fetchList(${JSON.stringify(path)})`
      )

      if (!rows?.length) {
        if (offset === 0) warn(`Año ${year}: Coin In no devolvió facturas`)
        break
      }

      for (const row of rows) {
        const numero = String(row.numero ?? '')
        if (targetSet.has(numero)) {
          byNumero.set(numero, row)
        }
      }

      log(
        `Indexado año ${year}, offset ${offset}: ${rows.length} filas, ${byNumero.size}/${targetSet.size} facturas encontradas`
      )

      if (rows.length < PAGE_SIZE || byNumero.size === targetSet.size) break
    }

    if (byNumero.size === targetSet.size) break
  }

  return byNumero
}

function writeSnapshot(facturas, resumen) {
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generado_en: new Date().toISOString(),
        resumen,
        facturas,
      },
      null,
      2
    )
  )
}

async function fetchInvoiceDetails(cdp, sessionId, rows, totalEsperado) {
  const facturas = []
  let procesadas = 0
  let vacias = 0

  for (const batch of chunk(rows, CONCURRENCY)) {
    const payload = batch.map((row) => ({
      id: row.id,
      numero: String(row.numero ?? ''),
      href: row.href,
    }))

    const detalles = await cdp.evaluate(
      sessionId,
      `globalThis.__codexCoinIn.fetchBatch(${JSON.stringify(payload)})`
    )

    for (const detalle of detalles ?? []) {
      if (!detalle?.numero) continue
      if (!detalle.lineas?.length) vacias += 1
      facturas.push(detalle)
    }

    procesadas += batch.length
    if (procesadas % 25 === 0 || procesadas === totalEsperado) {
      log(`Detalles extraídos: ${procesadas}/${totalEsperado}`)
      writeSnapshot(facturas, {
        total_objetivo: totalEsperado,
        total_extraidas: facturas.length,
        total_vacias: vacias,
      })
    }
  }

  return {
    facturas,
    vacias,
  }
}

async function main() {
  const imported = await loadImportedFacturas()
  if (!imported.length) {
    log('No hay facturas importadas desde Coin In en Supabase')
    return
  }

  const targetNumbers = imported.map((factura) => String(factura.numero))
  const years =
    parseYears(process.env.COININ_YEARS).length > 0
      ? parseYears(process.env.COININ_YEARS)
      : [...new Set(imported.map((factura) => Number.parseInt(String(factura.fecha).slice(0, 4), 10)))]
          .filter((year) => Number.isFinite(year))
          .sort((a, b) => a - b)

  let selectedNumbers = targetNumbers
  if (MAX_FACTURAS > 0) {
    selectedNumbers = selectedNumbers.slice(0, MAX_FACTURAS)
    log(`Modo limitado activo: ${selectedNumbers.length} facturas`)
  }

  log(`Facturas Coin In objetivo: ${selectedNumbers.length}`)
  log(`Años a consultar: ${years.join(', ')}`)

  const chrome = await startChrome()
  const cdp = new CdpClient(chrome.webSocketUrl)

  try {
    await cdp.connect()
    const sessionId = await cdp.createPage()

    const state = await loginToCoinIn(cdp, sessionId)
    log(`Sesión iniciada en ${state.href}`)

    await installPageHelpers(cdp, sessionId)

    const indexed = await collectInvoiceIndex(cdp, sessionId, years, selectedNumbers)
    const rows = selectedNumbers
      .map((numero) => indexed.get(String(numero)))
      .filter(Boolean)

    const missing = selectedNumbers.filter((numero) => !indexed.has(String(numero)))
    if (missing.length > 0) {
      warn(`No se encontraron ${missing.length} facturas en el índice de Coin In`)
    }

    const { facturas, vacias } = await fetchInvoiceDetails(cdp, sessionId, rows, rows.length)

    writeSnapshot(facturas, {
      total_objetivo: selectedNumbers.length,
      total_encontradas: rows.length,
      total_extraidas: facturas.length,
      total_sin_lineas: vacias,
      total_no_encontradas: missing.length,
      anios: years,
    })

    log(`✓ Archivo generado en ${OUTPUT_PATH}`)
    log(`✓ Facturas encontradas: ${rows.length}/${selectedNumbers.length}`)
    log(`✓ Facturas extraídas: ${facturas.length}`)
    log(`✓ Facturas sin líneas: ${vacias}`)
    if (missing.length > 0) {
      log(`✓ Facturas no encontradas: ${missing.length}`)
    }
  } finally {
    cdp.close()
    chrome.child.kill('SIGKILL')
    rmSync(PROFILE_DIR, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
