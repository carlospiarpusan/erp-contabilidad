type Entry = {
  firstAttemptAt: number
  attempts: number
  blockedUntil: number
}

const STORE = new Map<string, Entry>()
const WINDOW_MS = 15 * 60 * 1000
const BLOCK_MS = 20 * 60 * 1000
const MAX_ATTEMPTS = 8

function now() {
  return Date.now()
}

function cleanup() {
  const t = now()
  for (const [key, entry] of STORE.entries()) {
    const expiredWindow = t - entry.firstAttemptAt > WINDOW_MS && entry.blockedUntil <= t
    if (expiredWindow) STORE.delete(key)
  }
}

export function loginRateLimitStatus(key: string) {
  cleanup()
  const t = now()
  const entry = STORE.get(key)
  if (!entry) return { blocked: false, retryAfterSeconds: 0, attempts: 0 }
  if (entry.blockedUntil > t) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((entry.blockedUntil - t) / 1000),
      attempts: entry.attempts,
    }
  }
  if (t - entry.firstAttemptAt > WINDOW_MS) {
    STORE.delete(key)
    return { blocked: false, retryAfterSeconds: 0, attempts: 0 }
  }
  return { blocked: false, retryAfterSeconds: 0, attempts: entry.attempts }
}

export function registerLoginFailure(key: string) {
  cleanup()
  const t = now()
  const entry = STORE.get(key)
  if (!entry || t - entry.firstAttemptAt > WINDOW_MS) {
    STORE.set(key, {
      firstAttemptAt: t,
      attempts: 1,
      blockedUntil: 0,
    })
    return
  }
  entry.attempts += 1
  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.blockedUntil = t + BLOCK_MS
  }
  STORE.set(key, entry)
}

export function resetLoginFailures(key: string) {
  STORE.delete(key)
}
