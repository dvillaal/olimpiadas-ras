import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';
import type { Database } from '@/types/database';

/**
 * Proxy de la aplicación (antes «middleware»).
 *
 * Refresca la sesión en cada navegación y bloquea el acceso a las zonas
 * privadas. La verificación fina de rol la hacen los layouts del servidor
 * (`/admin` y `/panel`), que además cargan el perfil una sola vez.
 *
 * Next 16 renombró la convención `middleware` a `proxy`: el archivo debe
 * llamarse `src/proxy.ts` y exportar una función `proxy`.
 */

// `/resultados` es el portal público: se consulta sin cuenta, a propósito.
const PUBLIC_ROUTES = ['/', '/ingresar', '/registro', '/recuperar', '/auth', '/resultados'];

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() valida el token contra Supabase; getSession() no. Es la llamada
  // correcta en middleware, aunque cueste una petición.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/ingresar';
    url.searchParams.set('siguiente', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/ingresar' || pathname === '/registro')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Se excluyen estáticos e imágenes: no necesitan sesión y encarecerían
     * cada carga con una llamada a Supabase.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
