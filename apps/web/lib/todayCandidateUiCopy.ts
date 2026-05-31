/**
 * 클라이언트 표시문 방어 필터 (관찰 후보 카드용).
 */

import type { TodayStockCandidate } from '@/lib/todayCandidatesContract';

const UI_BANNED_SUBSTRINGS = [
  '지금 사라',
  '강력 매수',
  '무조건 매수',
  '수익 보장',
  '확정 수익',
  '자동 매수',
  '자동 주문',
  '매수 추천',
];

/** 매수·부추김 문구는 낮추고, 오해 가능한 단독 표현만 치환한다. */
const OBSERVATION_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/추천 종목/g, '관찰 후보'],
  [/추천 후보/g, '점검 후보'],
  [/매수 판단/g, '확인 후 판단'],
  [/리스크 있음/g, '리스크 점검 필요'],
  [/자동 등록/g, '승인 후 등록'],
  [/자동 반영/g, '명시 적용 후 반영'],
];

export const TODAY_CANDIDATE_UI_DISCLAIMERS = [
  '매수 추천이 아닙니다.',
  '자동매매·자동주문 기능은 없습니다.',
  '승인 전에는 관심종목에 등록하지 않습니다.',
  '리스크 점검은 확인과 복기를 위한 상태입니다.',
] as const;

/** 면책 문구(매수 추천이 아닙니다)는 금지 치환에서 제외한다. */
const NEGATED_BUY_RECOMMENDATION = /매수\s*추천\s*(이\s*)?아님|매수\s*추천이\s*아닙니다/i;

export function scrubTodayCandidateUiCopy(text: string): string {
  let out = text;
  for (const ph of UI_BANNED_SUBSTRINGS) {
    if (ph === '매수 추천' && NEGATED_BUY_RECOMMENDATION.test(out)) continue;
    const re = new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, '관찰');
  }
  return out.trim();
}

export function normalizeObservationCopy(text: string): string {
  if (TODAY_CANDIDATE_UI_DISCLAIMERS.some((d) => text.trim() === d || text.includes(d))) {
    return text.trim();
  }
  let out = scrubTodayCandidateUiCopy(text);
  for (const [re, rep] of OBSERVATION_PHRASE_REPLACEMENTS) {
    out = out.replace(re, rep);
  }
  return out.trim();
}

export function isRiskReviewCandidateClient(c: TodayStockCandidate): boolean {
  if (c.briefDeckSlot === 'risk_review') return true;
  if (c.decisionTrace?.decisionStatus === 'risk_review') return true;
  if (c.corporateActionRisk?.active && c.candidateAction === 'review_required') return true;
  return false;
}

/** 리스크 카드 기본 영역 2~3줄 요약 */
export function riskReviewCardHeadline(c: TodayStockCandidate): string {
  if (c.corporateActionRisk?.active) {
    return '기업 이벤트 리스크가 있어 신규 판단 전 확인이 필요합니다. 자동 주문 없음 · 확인 후 판단하세요.';
  }
  return '리스크 점검이 필요한 후보입니다. 자동 주문 없음 · 확인 후 판단하세요.';
}

export function riskReviewNextActionLine(): string {
  return '다음 액션: 리포트 확인 · 판단 복기 · 관찰 메모';
}

/** 카드에서 중복 표시되는 문구 제거(리스크 카드용) */
export function scrubRiskReviewDuplicateCopy(c: TodayStockCandidate, lines: string[]): string[] {
  const banned = new Set<string>();
  if (c.corporateActionRisk?.headline) {
    banned.add(c.corporateActionRisk.headline.trim().toLowerCase());
    banned.add('기업 이벤트 리스크 점검');
  }
  banned.add('가벼운 관찰 신호입니다. 참고용입니다.');
  banned.add('중립 관찰군 · 참고용 해석입니다.');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const t = scrubTodayCandidateUiCopy(raw).trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    if ([...banned].some((b) => k.includes(b) || b.includes(k))) continue;
    if (k.includes('기업 이벤트 리스크 점검') && c.corporateActionRisk?.active) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function riskReviewChecklistItems(c: TodayStockCandidate): string[] {
  const base = [
    '공시·기업 이벤트 일정 확인',
    '권리락·신주배정 기준일 확인',
    '최근 시세·거래량 확인',
  ];
  if (c.concentrationRiskAssessment && c.concentrationRiskAssessment.level !== 'none') {
    base.push('보유 중이면 비중과 손실 허용 범위 확인');
  }
  base.push('리포트 이력 또는 7일 diff 확인', '판단 복기 또는 관찰 메모 남기기');
  const fromTrace = (c.decisionTrace?.nextChecks ?? []).slice(0, 4);
  return [...base, ...fromTrace].slice(0, 8);
}
