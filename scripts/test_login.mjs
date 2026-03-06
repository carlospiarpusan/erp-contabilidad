import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const anon  = createClient(SUPABASE_URL, ANON_KEY)

const { data: session, error: loginErr } = await anon.auth.signInWithPassword({
  email: 'esperanzatengana@hotmail.com',
  password: '27104393'
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
