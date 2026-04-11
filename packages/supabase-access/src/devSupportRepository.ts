import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey } from '@office-unify/shared-types';

export type DevSupportRating = 'top' | 'ok' | 'weak';
export type DevSupportTaskType = 'flow' | 'sql' | 'ts';

const MAX_PROMPT_CHARS = 12_000;
const MAX_NOTE_CHARS = 800;

export type DevSupportFeedbackRow = {
  id: string;
  rating: DevSupportRating;
  task_type: DevSupportTaskType;
  note: string | null;
  created_at: string;
};

function trunc(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 20)}\n… [truncated]`;
}

export async function insertDevSupportFeedback(
  client: SupabaseClient,
  params: {
    userKey: OfficeUserKey;
    rating: DevSupportRating;
    taskType: DevSupportTaskType;
    prompt: string;
    note?: string | null;
  },
): Promise<{ id: string }> {
  const note =
    typeof params.note === 'string' && params.note.trim()
      ? trunc(params.note.trim(), MAX_NOTE_CHARS)
      : null;

  const { data, error } = await client
    .from('web_dev_support_feedback')
    .insert({
      user_key: params.userKey as string,
      rating: params.rating,
      task_type: params.taskType,
      prompt: trunc(params.prompt, MAX_PROMPT_CHARS),
      note,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error('insertDevSupportFeedback: no id');
  return { id: data.id as string };
}

export async function insertDevSupportSavedBest(
  client: SupabaseClient,
  params: {
    userKey: OfficeUserKey;
    feedbackId: string;
    taskType: DevSupportTaskType;
    title: string | null;
    prompt: string;
    flowMarkdown: string | null;
    mermaidCode: string | null;
    content: string | null;
    example: string | null;
    explanation: string | null;
    warnings: unknown[] | null;
    dbType: string | null;
    schemaContext: string | null;
    sqlStyleHints: string | null;
    rawResult: unknown;
  },
): Promise<void> {
  const { error } = await client.from('web_dev_support_saved_best').insert({
    user_key: params.userKey as string,
    feedback_id: params.feedbackId,
    task_type: params.taskType,
    title: params.title,
    prompt: trunc(params.prompt, MAX_PROMPT_CHARS),
    flow_markdown: params.flowMarkdown,
    mermaid_code: params.mermaidCode,
    content: params.content,
    example: params.example,
    explanation: params.explanation,
    warnings: params.warnings == null ? null : params.warnings,
    db_type: params.dbType,
    schema_context: params.schemaContext == null ? null : trunc(params.schemaContext, 24_000),
    sql_style_hints: params.sqlStyleHints,
    raw_result: params.rawResult as object,
  });

  if (error) throw new Error(error.message);
}

/** 최근 피드백으로 generate 프롬프트에 붙일 짧은 힌트 문자열 */
export async function fetchDevSupportPreferenceHintLines(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  limit = 24,
): Promise<DevSupportFeedbackRow[]> {
  const { data, error } = await client
    .from('web_dev_support_feedback')
    .select('id,rating,task_type,note,created_at')
    .eq('user_key', userKey as string)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as DevSupportFeedbackRow[];
}

export function buildPreferenceHintFromRows(rows: DevSupportFeedbackRow[]): string {
  if (rows.length === 0) return '';

  const counts: Record<DevSupportTaskType, { top: number; ok: number; weak: number }> = {
    flow: { top: 0, ok: 0, weak: 0 },
    sql: { top: 0, ok: 0, weak: 0 },
    ts: { top: 0, ok: 0, weak: 0 },
  };

  const notes: string[] = [];
  for (const r of rows) {
    const t = r.task_type as DevSupportTaskType;
    if (r.rating === 'top') counts[t].top += 1;
    else if (r.rating === 'ok') counts[t].ok += 1;
    else counts[t].weak += 1;

    if (r.note?.trim() && (r.rating === 'ok' || r.rating === 'weak')) {
      notes.push(`[${t}] ${r.rating === 'weak' ? '아쉬움' : '괜찮음'}: ${r.note.trim()}`);
    }
  }

  const parts: string[] = [];
  parts.push('(아래는 이 사용자의 최근 dev_support 피드백 요약이다. 스타일·톤 조정에만 참고하고, 스키마·사실을 바꾸지 말 것.)');

  for (const tt of ['flow', 'sql', 'ts'] as const) {
    const c = counts[tt];
    if (c.top + c.ok + c.weak === 0) continue;
    const label = tt === 'ts' ? 'TypeScript' : tt === 'sql' ? 'SQL' : 'Flow';
    parts.push(`${label}: 최고 ${c.top}회, 괜찮음 ${c.ok}회, 아쉬움 ${c.weak}회`);
  }

  const recentNotes = notes.slice(0, 6);
  if (recentNotes.length > 0) {
    parts.push('최근 메모:');
    parts.push(...recentNotes.map((n) => `- ${n}`));
  }

  return parts.join('\n').slice(0, 6_000);
}
