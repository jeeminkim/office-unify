import { NextResponse } from 'next/server';
import type { CommitteeDiscussionLineDto } from '@office-unify/shared-types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import {
  executeCommitteeDiscussionJoReport,
  resolvePersonaChatLlmEnv,
} from '@/lib/server/runCommitteeDiscussion';

type Body = {
  topic?: string;
  transcript?: CommitteeDiscussionLineDto[];
};

/**
 * 조일현 스타일 Markdown — UI에서 사용자가 명시적으로 요청했을 때만 POST된다.
 * 토론/정리 발언 완료와 자동 연동하지 않는다.
 */
export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) {
    return NextResponse.json({ error: 'topic is required.' }, { status: 400 });
  }

  const transcript = Array.isArray(body.transcript) ? body.transcript : [];
  if (transcript.length === 0) {
    return NextResponse.json({ error: 'transcript must include at least one line.' }, { status: 400 });
  }

  const llm = resolvePersonaChatLlmEnv();
  if (!llm.ok) {
    return NextResponse.json({ error: llm.message }, { status: llm.status });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  try {
    const { markdown, sanitizeMeta } = await executeCommitteeDiscussionJoReport({
      supabase,
      geminiApiKey: llm.geminiApiKey,
      openAiApiKey: llm.openAiApiKey,
      topic,
      transcript,
    });
    return NextResponse.json({ markdown, sanitizeMeta });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
