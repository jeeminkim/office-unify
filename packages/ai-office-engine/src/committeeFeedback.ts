import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey, PersonaChatFeedbackRating } from '@office-unify/shared-types';
import {
  getWebCommitteeTurnForUser,
  selectPersonaLongTermSummary,
  upsertPersonaLongTermSummary,
} from '@office-unify/supabase-access';
import {
  COMMITTEE_LT_MEMORY_KEY,
  formatCommitteeLongTermForPrompt,
  mergeCommitteeLongTermWithFeedback,
} from './committee/committeeLongTerm';

/**
 * 위원회 토론 1회(`web_committee_turns.id`)에 대한 피드백을 `committee-lt` 장기 기억에 반영한다.
 */
export async function applyCommitteeTurnFeedback(params: {
  supabase: SupabaseClient;
  userKey: OfficeUserKey;
  committeeTurnId: string;
  rating: PersonaChatFeedbackRating;
  note?: string | null;
}): Promise<{ longTermMemorySummary: string | null }> {
  const turn = await getWebCommitteeTurnForUser(params.supabase, params.userKey, params.committeeTurnId);
  if (!turn) {
    throw new Error('Committee turn not found or access denied.');
  }

  const sourceText = turn.transcript_excerpt?.trim() || turn.topic.trim();
  const prev = await selectPersonaLongTermSummary(params.supabase, params.userKey, COMMITTEE_LT_MEMORY_KEY);
  const merged = mergeCommitteeLongTermWithFeedback(prev, {
    committeeTurnId: params.committeeTurnId,
    sourceText,
    rating: params.rating,
    userNote: params.note,
  });
  await upsertPersonaLongTermSummary(params.supabase, params.userKey, COMMITTEE_LT_MEMORY_KEY, merged);
  const display = formatCommitteeLongTermForPrompt(merged).trim();
  return { longTermMemorySummary: display ? display : null };
}
