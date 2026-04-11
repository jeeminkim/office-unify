import { NextResponse } from 'next/server';
import {
  DEFAULT_PERSONA_WEB_KEY,
  isOpenAiWebPersonaSlug,
  resolveWebPersona,
} from '@office-unify/ai-office-engine';
import type { PersonaChatMessageRequestBody } from '@office-unify/shared-types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { buildPersonaContentHash, runPersonaChatMessageWithDbIdempotency } from '@/lib/server/runPersonaChatMessage';
import { getServiceSupabase } from '@/lib/server/supabase-service';

/** orchestrator와 동일한 기본 페르소나 해석 — 멱등 해시에 사용 */
function resolvePersonaSlugForIdempotency(body: PersonaChatMessageRequestBody): string {
  const raw = body.personaKey?.trim();
  if (raw) {
    const p = resolveWebPersona(raw);
    if (!p) throw new Error(`Unknown personaKey: ${raw}`);
    return String(p.key);
  }
  const d = resolveWebPersona(DEFAULT_PERSONA_WEB_KEY);
  if (!d) throw new Error('Default persona not registered');
  return String(d.key);
}

/**
 * POST /api/persona-chat/message
 * DB 멱등(`web_persona_chat_requests`) + 세션 사용자만. 클라이언트 userKey 없음.
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

  let personaSlug: string;
  try {
    personaSlug = resolvePersonaSlugForIdempotency(body);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid personaKey';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const contentHash = buildPersonaContentHash(userKeyStr, personaSlug, content);

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (isOpenAiWebPersonaSlug(personaSlug)) {
    if (!openAiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set on the server.' }, { status: 503 });
    }
  } else if (!geminiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not set on the server.' }, { status: 503 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  try {
    const result = await runPersonaChatMessageWithDbIdempotency({
      supabase,
      userKey,
      userKeyStr,
      geminiApiKey: geminiKey ?? '',
      openAiApiKey: openAiKey,
      personaKeyRaw: body.personaKey,
      content,
      contentHash,
      personaSlug,
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
