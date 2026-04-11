import { NextResponse } from 'next/server';
import { initPrivateBankerSession } from '@office-unify/ai-office-engine';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';

/**
 * GET /api/private-banker/session
 * J. Pierpont 전용 KST 세션 — persona-chat과 별도이나 동일 DB·인증.
 */
export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  try {
    const body = await initPrivateBankerSession({ supabase, userKey: auth.userKey });
    return NextResponse.json(body);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
