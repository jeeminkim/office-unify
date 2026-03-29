import { logger } from '../../logger';
import type { DecisionType, VetoResult } from '../contracts/decisionContract';
import type { RiskVetoContext, VetoEvaluation, VetoRuleId } from '../contracts/riskPolicyContract';

function isAggressive(dec: DecisionType): boolean {
  return dec === 'BUY' || dec === 'ADD';
}

function downgradeAggressive(dec: DecisionType): DecisionType {
  if (dec === 'BUY' || dec === 'ADD') return 'HOLD';
  return dec;
}

function downgradeToNoAction(dec: DecisionType): DecisionType {
  if (dec === 'ADD') return 'NO_ACTION';
  if (dec === 'BUY') return 'NO_ACTION';
  return dec;
}

/** 정책 기반 veto 평가 (입력/출력 명시) */
export function evaluateRiskVetoRules(ctx: RiskVetoContext): VetoEvaluation {
  const triggered: VetoRuleId[] = [];
  const messages: string[] = [];

  const { hindenburg, portfolio, quotes, anchors, claims } = ctx;

  if (
    hindenburg.judgment === 'BEARISH' &&
    hindenburg.confidence >= 0.65 &&
    isAggressive(ctx.candidateDecision)
  ) {
    triggered.push('HINDENBURG_BEARISH_HIGH_CONF');
    messages.push('HINDENBURG 고신뢰 약세 — 매수/추가 진입 제한 (BUY/ADD → HOLD 또는 NO_ACTION 경로로 강등 가능)');
  }

  if (portfolio.top3WeightPct >= 80 && isAggressive(ctx.candidateDecision)) {
    triggered.push('PORTFOLIO_CONCENTRATION');
    messages.push('상위 3종목 비중 과다 — 집중도 리스크로 공격적 진입 제한');
  }

  if (portfolio.usSingleAssetConcentration && isAggressive(ctx.candidateDecision)) {
    triggered.push('PORTFOLIO_CONCENTRATION');
    messages.push('단일 자산 과집중 — 진입 제한');
  }

  if (quotes.degradedQuoteMode && isAggressive(ctx.candidateDecision)) {
    triggered.push('DEGRADED_QUOTE');
    messages.push('degraded quote 상태 — 가격 신뢰도 낮음, 매수/추가 제한');
  }

  if (quotes.quoteFailureCount >= 2 && isAggressive(ctx.candidateDecision)) {
    triggered.push('QUOTE_FAILURES');
    messages.push('다수 심볼 시세 실패 — 실행 판단 보수화');
  }

  if (portfolio.positionCount > 0 && portfolio.top3WeightPct >= 95) {
    triggered.push('SANITY_GUARD_VALUATION');
    messages.push('스냅샷 비중 이상 징후 — 공격적 진입 제한');
  }

  if (!anchors.hasLifestyle && isAggressive(ctx.candidateDecision)) {
    triggered.push('LIFESTYLE_DATA_MISSING');
    messages.push('지출/현금흐름 데이터 부재 — 확신 부족으로 매수/추가 제한');
  }

  if (claims.totalCount < claims.minClaimsSuggested && isAggressive(ctx.candidateDecision)) {
    triggered.push('CLAIM_EVIDENCE_INSUFFICIENT');
    messages.push('claim 근거 수 부족 — 매수/추가 제한');
  }

  return { triggeredRules: triggered, messages };
}

export function applyRiskVeto(params: {
  candidateDecision: DecisionType;
  evaluation: VetoEvaluation;
}): VetoResult {
  const { candidateDecision, evaluation } = params;
  const originalDecision = candidateDecision;
  const vetoRuleIds = [...evaluation.triggeredRules];

  if (!evaluation.triggeredRules.length) {
    return {
      vetoApplied: false,
      vetoReasons: [],
      vetoRuleIds: [],
      originalDecision,
      finalDecision: candidateDecision
    };
  }

  let adjusted = candidateDecision;
  const rules = new Set(evaluation.triggeredRules);

  if (
    rules.has('HINDENBURG_BEARISH_HIGH_CONF') ||
    rules.has('PORTFOLIO_CONCENTRATION') ||
    rules.has('DEGRADED_QUOTE') ||
    rules.has('SANITY_GUARD_VALUATION')
  ) {
    adjusted = downgradeAggressive(adjusted);
  }

  if (rules.has('QUOTE_FAILURES') || rules.has('LIFESTYLE_DATA_MISSING')) {
    if (adjusted === 'BUY' || adjusted === 'ADD') adjusted = downgradeAggressive(adjusted);
  }

  if (rules.has('CLAIM_EVIDENCE_INSUFFICIENT')) {
    adjusted = downgradeToNoAction(adjusted);
  }

  logger.info('DECISION_ENGINE', 'veto_applied', {
    vetoRuleIds,
    originalDecision,
    finalDecision: adjusted
  });

  return {
    vetoApplied: true,
    vetoReasons: evaluation.messages,
    vetoRuleIds,
    originalDecision,
    finalDecision: adjusted
  };
}
