import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Rutas públicas
  if (pathname.startsWith('/login') || pathname.startsWith('/print')) {
    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return supabaseResponse
  }

  // Requiere autenticación
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Proteger rutas /superadmin — solo superadmin puede acceder
  if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin')) {
    const { data: perfil } = await supabase
      .from('usuarios')
      .select('rol_id')
      .eq('id', user.id)
      .single()

    // Leer roles con service_role — RLS bloquea la tabla roles para usuarios normales
    const adminSupa = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: rolData } = perfil?.rol_id
      ? await adminSupa.from('roles').select('nombre').eq('id', perfil.rol_id).single()
      : { data: null }

    if (rolData?.nombre !== 'superadmin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
