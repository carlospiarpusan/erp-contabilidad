#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(fileName) {
  const fullPath = resolve(process.cwd(), fileName)
  if (!existsSync(fullPath)) return

  const lines = readFileSync(fullPath, 'utf8').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Falta variable de entorno: ${name}`)
  return value
}

function parseNumberEnv(name, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const raw = Number(process.env[name] ?? fallback)
  if (!Number.isFinite(raw)) return fallback
  return Math.max(min, Math.min(max, Math.floor(raw)))
}

function percentile(values, pct) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1))
  return sorted[index]
}

function formatMs(value) {
  return `${Math.round(value)} ms`
}

function stripTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

async function readFully(response) {
  await response.arrayBuffer()
}

function getCookies(response) {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers)
  if (typeof getSetCookie === 'function') {
    return getSetCookie()
  }

  const single = response.headers.get('set-cookie')
  return single ? [single] : []
}

function buildCookieHeader(setCookies) {
  return setCookies
    .map((cookie) => cookie.split(';', 1)[0]?.trim())
    .filter(Boolean)
    .join('; ')
}

async function login(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`Login falló (${response.status}): ${body || 'sin detalle'}`)
  }

  const cookieHeader = buildCookieHeader(getCookies(response))
  if (!cookieHeader) {
    throw new Error('Login exitoso pero no se recibieron cookies de sesión')
  }

  return cookieHeader
}

async function timedRequest(baseUrl, cookieHeader, scenario) {
  const started = performance.now()
  const response = await fetch(`${baseUrl}${scenario.path}`, {
    method: scenario.method ?? 'GET',
    headers: {
      Cookie: cookieHeader,
      ...(scenario.headers ?? {}),
    },
    redirect: 'manual',
  })
  await readFully(response)
  const elapsed = performance.now() - started

  if (!response.ok) {
    throw new Error(`${scenario.name} respondió ${response.status}`)
  }

  return elapsed
}

async function runScenario(baseUrl, cookieHeader, scenario, iterations, concurrency) {
  const warmup = await timedRequest(baseUrl, cookieHeader, scenario)

  const sequential = []
  for (let index = 0; index < iterations; index += 1) {
    sequential.push(await timedRequest(baseUrl, cookieHeader, scenario))
  }

  const concurrent = []
  for (let round = 0; round < iterations; round += 1) {
    const batch = await Promise.all(
      Array.from({ length: concurrency }, () => timedRequest(baseUrl, cookieHeader, scenario))
    )
    concurrent.push(...batch)
  }

  return {
    name: scenario.name,
    warmup,
    sequential,
    concurrent,
  }
}

function printSummary(result) {
  const seq = result.sequential
  const conc = result.concurrent
  console.log(`\n[${result.name}]`)
  console.log(`  warmup: ${formatMs(result.warmup)}`)
  console.log(
    `  sequential: min ${formatMs(Math.min(...seq))} | p50 ${formatMs(percentile(seq, 50))} | p95 ${formatMs(percentile(seq, 95))} | max ${formatMs(Math.max(...seq))}`
  )
  console.log(
    `  concurrent: min ${formatMs(Math.min(...conc))} | p50 ${formatMs(percentile(conc, 50))} | p95 ${formatMs(percentile(conc, 95))} | max ${formatMs(Math.max(...conc))}`
  )
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const baseUrl = stripTrailingSlash(process.env.BENCH_BASE_URL ?? 'http://localhost:3000')
  const email = requiredEnv('BENCH_EMAIL')
  const password = requiredEnv('BENCH_PASSWORD')
  const iterations = parseNumberEnv('BENCH_ITERATIONS', 3, 1, 20)
  const concurrency = parseNumberEnv('BENCH_CONCURRENCY', 3, 1, 20)
  const includeExports = process.env.BENCH_INCLUDE_EXPORTS !== '0'

  const today = new Date().toISOString().slice(0, 10)
  const currentYear = new Date().getFullYear()
  const desde = `${currentYear}-01-01`

  const scenarios = [
    { name: 'dashboard-api', path: '/api/dashboard' },
    { name: 'dashboard-page', path: '/' },
    { name: 'productos-selector', path: '/api/productos?select_mode=selector&include_total=false&limit=25&q=pro' },
    { name: 'clientes-selector', path: '/api/clientes?select_mode=selector&include_total=false&limit=25&q=a' },
    { name: 'compras-sugeridos', path: '/compras/sugeridos?dias=90&lead=30' },
  ]

  if (includeExports) {
    scenarios.push(
      { name: 'export-ventas', path: `/api/export/ventas?desde=${desde}&hasta=${today}` },
      { name: 'export-compras', path: `/api/export/compras?desde=${desde}&hasta=${today}` },
      { name: 'export-inventario', path: '/api/export/inventario' }
    )
  }

  console.log(`Base URL: ${baseUrl}`)
  console.log(`Iteraciones: ${iterations}`)
  console.log(`Concurrencia: ${concurrency}`)
  console.log(`Escenarios: ${scenarios.length}`)

  const cookieHeader = await login(baseUrl, email, password)
  console.log('Login OK')

  const results = []
  for (const scenario of scenarios) {
    const result = await runScenario(baseUrl, cookieHeader, scenario, iterations, concurrency)
    results.push(result)
    printSummary(result)
  }

  const allSequential = results.flatMap((result) => result.sequential)
  const allConcurrent = results.flatMap((result) => result.concurrent)

  console.log('\n[global]')
  console.log(
    `  sequential: p50 ${formatMs(percentile(allSequential, 50))} | p95 ${formatMs(percentile(allSequential, 95))}`
  )
  console.log(
    `  concurrent: p50 ${formatMs(percentile(allConcurrent, 50))} | p95 ${formatMs(percentile(allConcurrent, 95))}`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
