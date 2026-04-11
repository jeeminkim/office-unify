import type { PersonaKey } from '@office-unify/shared-types';

/**
 * 금융 위원회 vs 트렌드 분리 — legacy `personaRoutePolicy` 중
 * Discord·logger·detectFinancialIntent 에 의존하지 않는 부분만.
 */
export const FINANCIAL_COMMITTEE_KEYS = ['RAY', 'HINDENBURG', 'SIMONS', 'DRUCKER', 'CIO'] as const;
export type FinancialCommitteeKey = (typeof FINANCIAL_COMMITTEE_KEYS)[number];

export const TREND_PERSONA_IDS = [
  'JYP',
  'KIM_EUNHEE',
  'SON_HEUNGMIN',
  'JEON_HYEONGMU',
  'TREND_ANALYST',
] as const;
export type TrendPersonaId = (typeof TREND_PERSONA_IDS)[number];

export type RouteFamily =
  | 'portfolio_financial'
  | 'trend_k_culture'
  | 'open_topic'
  | 'other';

export type OpenTopicKind = 'financial' | 'trend' | 'general';

export const K_CULTURE_DISPLAY_NAMES = new Set([
  'JYP (Analyst)',
  '전현무 · 핫 트렌드 분석',
  '손흥민 · 스포츠 비즈니스 분석',
  '김은희 · 드라마/OTT 리서처',
]);

export function isFinancialCommitteeKey(k: PersonaKey): k is FinancialCommitteeKey {
  return (FINANCIAL_COMMITTEE_KEYS as readonly string[]).includes(k);
}

export function analysisTypeToRouteFamily(analysisType: string): RouteFamily {
  const t = analysisType || '';
  if (t.startsWith('trend_')) return 'trend_k_culture';
  if (t.startsWith('open_topic')) return 'open_topic';
  if (
    t.startsWith('portfolio_') ||
    t === 'financial_debate' ||
    t.includes('rebalance') ||
    t.includes('advisory') ||
    t.includes('data_center')
  ) {
    return 'portfolio_financial';
  }
  return 'other';
}

export function getPersonaGroupForRoute(
  analysisType: string,
  topicHint?: string,
): 'FINANCIAL' | 'TREND' | 'MIXED_BLOCKED' {
  const family = analysisTypeToRouteFamily(analysisType);
  if (family === 'trend_k_culture') return 'TREND';
  if (family === 'portfolio_financial') return 'FINANCIAL';
  if (family === 'open_topic') {
    if (topicHint === 'trend') return 'TREND';
    if (topicHint === 'financial' || topicHint === 'general') return 'FINANCIAL';
  }
  return 'FINANCIAL';
}

export function resolveOpenTopicAnalysisType(kind: OpenTopicKind): string {
  if (kind === 'financial') return 'open_topic_financial';
  if (kind === 'trend') return 'open_topic_trend';
  return 'open_topic_general';
}
