import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessModule, getApiRouteAccess, getPageRouteAccess } from '@/lib/auth/permissions'
import { getUsuarioContext } from '@/lib/auth/user-context'
import { getSupabasePublicEnv } from '@/lib/supabase/config'

export async function proxy(request: NextRequest) {
  const { url, anonKey } = getSupabasePublicEnv()
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    url,
    anonKey,
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
  const isApiRoute = pathname.startsWith('/api/')
  const loginUrl = new URL('/login', request.url)

  const unauthorizedApi = (status: 401 | 403, error: string) =>
    NextResponse.json({ error }, { status })

  // Rutas públicas
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/print') ||
    pathname.startsWith('/api/health')
  ) {
    if (user && pathname === '/login') {
      const context = await getUsuarioContext(supabase, user.id)
      if (context) {
        const home = context.rol === 'superadmin' ? '/superadmin' : '/'
        return NextResponse.redirect(new URL(home, request.url))
      }
    }
    return supabaseResponse
  }

  // Requiere autenticación
  if (!user) {
    return isApiRoute
      ? unauthorizedApi(401, 'No autorizado')
      : NextResponse.redirect(loginUrl)
  }

  const context = await getUsuarioContext(supabase, user.id)
  if (!context) {
    return isApiRoute
      ? unauthorizedApi(403, 'Sesión inválida o usuario inactivo')
      : NextResponse.redirect(loginUrl)
  }

  const access = isApiRoute
    ? getApiRouteAccess(pathname, request.method)
    : getPageRouteAccess(pathname)

  if (access && !canAccessModule(context.rol, access.module, access.scope)) {
    if (isApiRoute) {
      return unauthorizedApi(403, 'Sin permisos para este recurso')
    }

    const home = context.rol === 'superadmin' ? '/superadmin' : '/'
    return NextResponse.redirect(new URL(home, request.url))
  }

  if (!isApiRoute && context.rol === 'superadmin' && pathname === '/') {
    return NextResponse.redirect(new URL('/superadmin', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
