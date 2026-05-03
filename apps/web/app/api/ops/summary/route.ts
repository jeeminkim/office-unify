import { NextResponse } from 'next/server';
import { countOpsEventsOpenError } from '@office-unify/supabase-access';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';

export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, openErrorCount: 0, note: 'supabase_unconfigured' });
  }
  try {
    const openErrorCount = await countOpsEventsOpenError(supabase, auth.userKey);
    return NextResponse.json({ ok: true, openErrorCount });
  } catch {
    return NextResponse.json({ ok: true, openErrorCount: 0, note: 'ops_events_unavailable' });
  }
}
