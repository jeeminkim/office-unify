/**
 * 장기 기억 엔트리 표시·프롬프트 주입 순서 — 피드백 점수·최근성·메모 가중.
 * 저장 JSON 배열 순서와 무관하게, 화면/프롬프트용으로만 정렬한다.
 */

import type { PersonaChatFeedbackRating } from '@office-unify/shared-types';

/** 높을수록 먼저 표시 (top > ok > weak > 피드백 없음) */
export const FEEDBACK_RATING_RANK: Record<PersonaChatFeedbackRating, number> = {
  top: 3,
  ok: 2,
  weak: 1,
};

export function feedbackTierScore(rating?: PersonaChatFeedbackRating): number {
  if (!rating) return 0;
  return FEEDBACK_RATING_RANK[rating] ?? 0;
}

export type LongTermPriorityEntry = {
  at: string;
  rating?: PersonaChatFeedbackRating;
  userNote?: string;
};

/**
 * 1) 피드백 등급 내림차순
 * 2) 메모 있음 우선
 * 3) 같은 등급·메모면 at(ISO) 내림차순 — 최근 것 우선
 */
export function compareLongTermEntriesByPriority(a: LongTermPriorityEntry, b: LongTermPriorityEntry): number {
  const tb = feedbackTierScore(b.rating);
  const ta = feedbackTierScore(a.rating);
  if (tb !== ta) return tb - ta;
  const nb = b.userNote?.trim() ? 1 : 0;
  const na = a.userNote?.trim() ? 1 : 0;
  if (nb !== na) return nb - na;
  return b.at.localeCompare(a.at);
}

export function sortLongTermEntriesForDisplay<T extends LongTermPriorityEntry>(entries: T[]): T[] {
  return [...entries].sort(compareLongTermEntriesByPriority);
}
