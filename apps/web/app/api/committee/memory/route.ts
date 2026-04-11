import { NextResponse } from 'next/server';
import { COMMITTEE_LT_MEMORY_KEY, formatCommitteeLongTermForPrompt } from '@office-unify/ai-office-engine';
import type { CommitteeMemoryResponseBody } from '@office-unify/shared-types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { selectPersonaLongTermSummary } from '@office-unify/supabase-access';

/**
 * GET /api/committee/memory
 * 위원회 전용 장기 기억(`committee-lt`) 요약 표시용.
 */
export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const { userKey } = auth;

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  try {
    const raw = await selectPersonaLongTermSummary(supabase, userKey, COMMITTEE_LT_MEMORY_KEY);
    const t = formatCommitteeLongTermForPrompt(raw).trim();
    const body: CommitteeMemoryResponseBody = { longTermMemorySummary: t ? t : null };
    return NextResponse.json(body);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
