import { getActionReasonContract } from '@/lib/actionReasonContract';

const CENTRAL_REASON_LABELS: Record<string, string> = {
  structured_output_parse_failed: getActionReasonContract('structured_output_parse_failed').userMessageKo,
  partial_recovery: getActionReasonContract('partial_recovery').userMessageKo,
  manual_review_required: getActionReasonContract('manual_review_required').userMessageKo,
};

const KEYWORD_LABELS: Record<string, string> = {
  hindsight_bias: '결과를 보고 과거 판단을 과도하게 확신하는 편향',
  causal_fallacy: '한두 가지 사건만으로 원인을 단정하는 위험',
  emotional_trading_tendency: '감정에 따라 판단이 흔들릴 위험',
  lack_of_predefined_exit_criteria: '사전에 정한 종료 기준이 부족함',
  lack_of_risk_diversification: '리스크 분산 기준이 부족함',
  over_reliance_on_short_term_gains: '단기 수익률에 과도하게 의존할 위험',
  systematic_model_enhancement: '판단 기준을 더 체계화할 필요',
  data_driven_decision_making: '데이터 기반 판단 보강 필요',
  signal_to_noise_ratio_improvement: '신호와 잡음을 구분할 필요',
  risk_diversification: '리스크 분산 확인 필요',
  sector_concentration: '섹터 집중도 점검 필요',
  provider_timeout: '응답 시간이 길어 핵심 요약 중심으로 확인 필요',
  provider_error: '응답 생성 오류가 있어 핵심 요약 중심으로 확인 필요',
};

const SNAKE_CASE = /\b[a-z][a-z0-9]+(?:_[a-z0-9]+)+\b/g;

function sentenceForUnknownKeyword(keyword: string): string {
  return `추가 확인 필요: ${keyword.replace(/_/g, ' ')}`;
}

export function humanizeCommitteeText(input: string): string {
  return String(input ?? '')
    .replace(SNAKE_CASE, (match) => CENTRAL_REASON_LABELS[match] ?? KEYWORD_LABELS[match] ?? sentenceForUnknownKeyword(match))
    .replace(/\s+/g, ' ')
    .trim();
}

export function humanizeCommitteeItems(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = humanizeCommitteeText(raw);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function containsRawSnakeCase(text: string): boolean {
  SNAKE_CASE.lastIndex = 0;
  return SNAKE_CASE.test(text);
}
