import { createClient } from '@supabase/supabase-js'

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Falta la variable de entorno requerida: ${name}`)
  return value
}

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const ANON_KEY = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SERVICE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const TEST_EMAIL = requiredEnv('TEST_LOGIN_EMAIL')
const TEST_PASSWORD = requiredEnv('TEST_LOGIN_PASSWORD')

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const anon  = createClient(SUPABASE_URL, ANON_KEY)

const { data: session, error: loginErr } = await anon.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: TEST_PASSWORD
})
if (loginErr) { console.log('LOGIN ERROR:', loginErr.message); process.exit(1) }
console.log('Login OK, user_id:', session.user.id)

const [
  { data: clientes,  count: c1, error: e1 },
  { data: productos, count: c2, error: e2 },
  { data: usuario,   error: e3 },
  { data: empresa,   error: e4 },
] = await Promise.all([
  anon.from('clientes').select('id, razon_social', { count: 'exact' }).limit(3),
  anon.from('productos').select('id, descripcion', { count: 'exact' }).limit(3),
  anon.from('usuarios').select('nombre, empresa_id, roles(nombre)').eq('id', session.user.id).single(),
  anon.from('empresas').select('nombre, nit').single(),
])

console.log('\n=== Resultados ===')
console.log('Clientes  count:', c1,  '| error:', e1?.message ?? 'none')
console.log('Productos count:', c2,  '| error:', e2?.message ?? 'none')
console.log('Usuario:', JSON.stringify(usuario), '| error:', e3?.message ?? 'none')
console.log('Empresa:', JSON.stringify(empresa), '| error:', e4?.message ?? 'none')

// Probar con service role - get_empresa_id() para ese user
const { data: fn, error: fe } = await admin.rpc('get_empresa_id')
console.log('\nget_empresa_id (admin, sin auth):', fn, fe?.message)
