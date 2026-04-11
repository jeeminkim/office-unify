import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 서버 컴포넌트·Route Handler·Server Action에서 사용.
 * 쿠키 기반 세션으로 Auth 사용자를 읽는다 (anon 키).
 */
export async function createServerSupabaseAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* Server Component 등 set 불가 컨텍스트 — middleware·Route Handler에서 갱신 */
          }
        },
      },
    },
  );
}
