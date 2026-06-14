import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // 1. Bypass auth check completely if no Supabase auth cookie is present.
  // This ensures first-time page loads and unauthenticated sessions never hang.
  const hasAuthCookie = request.cookies.getAll().some(cookie => cookie.name.startsWith('sb-'));
  if (!hasAuthCookie) {
    return supabaseResponse;
  }

  // 2. If cookie exists, refresh the session in the background with a strict 2-second timeout
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
          },
        },
        global: {
          fetch: (url, init) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            return fetch(url, { ...init, signal: controller.signal }).finally(() => {
              clearTimeout(timeoutId);
            });
          }
        }
      },
    );

    // This refreshes the session cookies if close to expiry
    await supabase.auth.getUser();
  } catch (err) {
    console.warn('Proxy session refresh bypassed or timed out:', err);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
