import { NextResponse } from 'next/server';
import type { CommitteeDiscussionLineDto } from '@office-unify/shared-types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import {
  executeCommitteeDiscussionRound,
  resolvePersonaChatLlmEnv,
} from '@/lib/server/runCommitteeDiscussion';

type Body = {
  topic?: string;
  roundNote?: string;
  priorTranscript?: CommitteeDiscussionLineDto[];
};

export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const { userKey } = auth;

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

  const priorTranscript = Array.isArray(body.priorTranscript) ? body.priorTranscript : [];
  const roundNote = typeof body.roundNote === 'string' ? body.roundNote.trim() : undefined;

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
    const { lines } = await executeCommitteeDiscussionRound({
      supabase,
      userKey,
      geminiApiKey: llm.geminiApiKey,
      openAiApiKey: llm.openAiApiKey,
      topic,
      roundNote: roundNote || undefined,
      priorTranscript,
    });
    return NextResponse.json({ lines });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
