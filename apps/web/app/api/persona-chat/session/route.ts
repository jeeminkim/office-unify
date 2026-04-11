import { NextResponse } from 'next/server';
import { initPersonaChatSession } from '@office-unify/ai-office-engine';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';

/**
 * GET /api/persona-chat/session?personaKey=
 * 오늘(KST) 세션 조회·생성, 당일 메시지 + 장기 기억 + 어제 assistant 힌트.
 * 사용자 식별은 Supabase Auth 세션(쿠키)에서만 한다.
 */
export async function GET(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const { userKey } = auth;

  const { searchParams } = new URL(req.url);
  const personaKey = searchParams.get('personaKey') ?? undefined;

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  try {
    const body = await initPersonaChatSession({ supabase, userKey, personaKeyRaw: personaKey });
    return NextResponse.json(body);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.startsWith('Unknown personaKey') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
