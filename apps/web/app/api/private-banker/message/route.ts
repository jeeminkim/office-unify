import { NextResponse } from 'next/server';
import type { PersonaChatMessageRequestBody } from '@office-unify/shared-types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { buildPrivateBankerContentHash, runPrivateBankerMessageWithDbIdempotency } from '@/lib/server/runPrivateBankerMessage';
import { getServiceSupabase } from '@/lib/server/supabase-service';

/**
 * POST /api/private-banker/message
 * OpenAI (서버 OPENAI_API_KEY) — Gemini persona-chat과 경로 분리.
 */
export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const { userKey } = auth;
  const userKeyStr = userKey as string;

  let body: PersonaChatMessageRequestBody;
  try {
    body = (await req.json()) as PersonaChatMessageRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) {
    return NextResponse.json({ error: 'Missing content.' }, { status: 400 });
  }

  const idempotencyKey =
    typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length > 0
      ? body.idempotencyKey.trim()
      : '';
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: 'idempotencyKey is required (e.g. a UUID per send attempt).' },
      { status: 400 },
    );
  }

  const contentHash = buildPrivateBankerContentHash(userKeyStr, content);

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not set on the server (Private Banker uses OpenAI).' },
      { status: 503 },
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? '';

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  try {
    const result = await runPrivateBankerMessageWithDbIdempotency({
      supabase,
      userKey,
      userKeyStr,
      openAiApiKey: openAiKey,
      geminiApiKey: geminiKey,
      content,
      contentHash,
      idempotencyKey,
    });

    if (result.kind === 'error') {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ...result.body,
      deduplicated: result.deduplicated,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const isSchema =
      message.includes('web_persona_chat_requests') ||
      message.includes('does not exist') ||
      message.includes('schema cache');
    if (isSchema) {
      return NextResponse.json(
        {
          error:
            'Persona chat idempotency table is missing. Apply docs/sql/append_web_persona_chat_requests.sql in Supabase.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
