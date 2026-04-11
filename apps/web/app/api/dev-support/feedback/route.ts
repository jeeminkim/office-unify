import { NextResponse } from 'next/server';
import type { GenerateResponse, TaskType } from '@/lib/types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { submitDevSupportFeedback } from '@/lib/server/devSupportFeedbackService';
import type { DevSupportRating, DevSupportTaskType } from '@office-unify/supabase-access';

const RATINGS: readonly DevSupportRating[] = ['top', 'ok', 'weak'];
const TASKS: readonly DevSupportTaskType[] = ['flow', 'sql', 'ts'];

function isGenerateResponse(v: unknown): v is GenerateResponse {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.taskType === 'string' &&
    ['flow', 'sql', 'ts'].includes(o.taskType) &&
    typeof o.content === 'string'
  );
}

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

  const rating = typeof body.rating === 'string' ? body.rating.trim() : '';
  if (!RATINGS.includes(rating as DevSupportRating)) {
    return NextResponse.json({ error: 'rating must be top, ok, or weak.' }, { status: 400 });
  }

  const taskType = typeof body.taskType === 'string' ? body.taskType.trim() : '';
  if (!TASKS.includes(taskType as DevSupportTaskType)) {
    return NextResponse.json({ error: 'Invalid taskType.' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required.' }, { status: 400 });
  }

  if (!isGenerateResponse(body.result)) {
    return NextResponse.json({ error: 'result must be a valid GenerateResponse object.' }, { status: 400 });
  }

  const result = body.result;
  if ((result.taskType as TaskType) !== (taskType as TaskType)) {
    return NextResponse.json({ error: 'result.taskType must match taskType.' }, { status: 400 });
  }

  const note = typeof body.note === 'string' ? body.note : undefined;

  const sqlContext =
    taskType === 'sql' && body.sqlContext && typeof body.sqlContext === 'object'
      ? {
          dbType:
            typeof (body.sqlContext as Record<string, unknown>).dbType === 'string'
              ? String((body.sqlContext as Record<string, unknown>).dbType)
              : undefined,
          schemaContext:
            typeof (body.sqlContext as Record<string, unknown>).schemaContext === 'string'
              ? String((body.sqlContext as Record<string, unknown>).schemaContext)
              : undefined,
          sqlStyleHints:
            typeof (body.sqlContext as Record<string, unknown>).sqlStyleHints === 'string'
              ? String((body.sqlContext as Record<string, unknown>).sqlStyleHints)
              : undefined,
        }
      : undefined;

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  try {
    const out = await submitDevSupportFeedback({
      supabase,
      userKey,
      rating: rating as DevSupportRating,
      taskType: taskType as DevSupportTaskType,
      prompt,
      note,
      result,
      sqlContext,
    });
    return NextResponse.json({
      ok: true,
      saved: out.saved,
      feedbackId: out.feedbackId,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
