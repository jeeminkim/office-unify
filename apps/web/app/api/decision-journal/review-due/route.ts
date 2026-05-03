import { NextResponse } from 'next/server';
import { listDecisionJournalReviewDue } from '@office-unify/supabase-access';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';

export async function GET(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '100') || 100));
  try {
    const items = await listDecisionJournalReviewDue(supabase, auth.userKey, limit);
    return NextResponse.json({ ok: true, items, count: items.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'list_failed';
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return NextResponse.json(
        { ok: true, items: [], count: 0, note: 'decision_journal_table_missing' },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
