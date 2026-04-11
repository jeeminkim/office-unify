import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey } from '@office-unify/shared-types';
import {
  insertDevSupportFeedback,
  insertDevSupportSavedBest,
  type DevSupportRating,
  type DevSupportTaskType,
} from '@office-unify/supabase-access';
import { formatResultAsMarkdown } from '@/lib/utils';
import type { GenerateResponse } from '@/lib/types';

function buildSavedParts(result: GenerateResponse, prompt: string) {
  const flowMarkdown = result.taskType === 'flow' ? formatResultAsMarkdown(result) : null;
  return {
    title: result.title ?? null,
    prompt,
    flowMarkdown,
    mermaidCode: result.mermaidCode ?? null,
    content: result.content || null,
    example: result.example ?? null,
    explanation: result.explanation ?? null,
    warnings: result.warnings ?? null,
    rawResult: result,
  };
}

export async function submitDevSupportFeedback(params: {
  supabase: SupabaseClient;
  userKey: OfficeUserKey;
  rating: DevSupportRating;
  taskType: DevSupportTaskType;
  prompt: string;
  note?: string | null;
  result: GenerateResponse;
  sqlContext?: {
    dbType?: string;
    schemaContext?: string;
    sqlStyleHints?: string;
  };
}): Promise<{ feedbackId: string; saved: boolean }> {
  const { id: feedbackId } = await insertDevSupportFeedback(params.supabase, {
    userKey: params.userKey,
    rating: params.rating,
    taskType: params.taskType,
    prompt: params.prompt,
    note: params.note,
  });

  if (params.rating !== 'top') {
    return { feedbackId, saved: false };
  }

  const parts = buildSavedParts(params.result, params.prompt);
  await insertDevSupportSavedBest(params.supabase, {
    userKey: params.userKey,
    feedbackId,
    taskType: params.taskType,
    title: parts.title,
    prompt: parts.prompt,
    flowMarkdown: parts.flowMarkdown,
    mermaidCode: parts.mermaidCode,
    content: parts.content,
    example: parts.example,
    explanation: parts.explanation,
    warnings: parts.warnings,
    dbType: params.sqlContext?.dbType ?? null,
    schemaContext: params.sqlContext?.schemaContext ?? null,
    sqlStyleHints: params.sqlContext?.sqlStyleHints ?? null,
    rawResult: parts.rawResult,
  });

  return { feedbackId, saved: true };
}
