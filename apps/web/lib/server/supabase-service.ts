import 'server-only';

import { createServerSupabaseClient } from '@office-unify/supabase-access';

/**
 * 서버 런타임 전용 Supabase(service role). API Route / Server Actions 등에서만 사용.
 */
export function getServiceSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    return null;
  }
  return createServerSupabaseClient(url, key);
}
