import { NextResponse } from 'next/server';
import { applyPersonaAssistantFeedback } from '@office-unify/ai-office-engine';
import type { PersonaChatFeedbackRating, PersonaChatFeedbackResponseBody } from '@office-unify/shared-types';
import { PERSONA_CHAT_FEEDBACK_NOTE_MAX_CHARS } from '@office-unify/shared-types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';

const RATINGS: readonly PersonaChatFeedbackRating[] = ['top', 'ok', 'weak'];

/**
 * POST /api/persona-chat/feedback
 * 페르소나 assistant 답변 평가를 장기 기억(persona_memory)에 반영한다.
 */
export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const { userKey } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const personaKey = typeof body.personaKey === 'string' ? body.personaKey.trim() : '';
  if (!personaKey) {
    return NextResponse.json({ error: 'personaKey is required.' }, { status: 400 });
  }

  const assistantMessageId = typeof body.assistantMessageId === 'string' ? body.assistantMessageId.trim() : '';
  if (!assistantMessageId) {
    return NextResponse.json({ error: 'assistantMessageId is required.' }, { status: 400 });
  }

  const rating = typeof body.rating === 'string' ? body.rating.trim() : '';
  if (!RATINGS.includes(rating as PersonaChatFeedbackRating)) {
    return NextResponse.json({ error: 'rating must be top, ok, or weak.' }, { status: 400 });
  }

  let note: string | undefined;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') {
      return NextResponse.json({ error: 'note must be a string.' }, { status: 400 });
    }
    note = body.note.trim() || undefined;
    if (note && note.length > PERSONA_CHAT_FEEDBACK_NOTE_MAX_CHARS) {
      return NextResponse.json(
        { error: `note must be at most ${PERSONA_CHAT_FEEDBACK_NOTE_MAX_CHARS} characters.` },
        { status: 400 },
      );
    }
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  try {
    const out = await applyPersonaAssistantFeedback({
      supabase,
      userKey,
      personaKeyRaw: personaKey,
      assistantMessageId,
      rating: rating as PersonaChatFeedbackRating,
      note,
    });
    const resBody: PersonaChatFeedbackResponseBody = { ok: true, longTermMemorySummary: out.longTermMemorySummary };
    return NextResponse.json(resBody);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status =
      message.includes('not found') || message.includes('access denied')
        ? 404
        : message.startsWith('Unknown personaKey')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
