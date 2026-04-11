import { createBrowserClient } from '@supabase/ssr';

/** 클라이언트 컴포넌트 전용 — Google OAuth 등 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
