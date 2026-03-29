/**
 * 리스크 veto 정책 — 명시적 규칙 식별자 (블랙박스 if 대신 사유 코드화).
 */

export type VetoRuleId =
  | 'HINDENBURG_BEARISH_HIGH_CONF'
  | 'PORTFOLIO_CONCENTRATION'
  | 'DEGRADED_QUOTE'
  | 'QUOTE_FAILURES'
  | 'SANITY_GUARD_VALUATION'
  | 'LIFESTYLE_DATA_MISSING'
  | 'CLAIM_EVIDENCE_INSUFFICIENT';

export type RiskVetoContext = {
  candidateDecision: import('./decisionContract').DecisionType;
  hindenburg: {
    judgment: import('./decisionContract').JudgmentType;
    confidence: number;
  };
  portfolio: {
    top3WeightPct: number;
    positionCount: number;
    /** 단일 US 자산 95% 이상 등 */
    usSingleAssetConcentration: boolean;
  };
  quotes: {
    degradedQuoteMode: boolean;
    quoteFailureCount: number;
  };
  anchors: {
    hasLifestyle: boolean;
  };
  claims: {
    totalCount: number;
    minClaimsSuggested: number;
  };
};

export type VetoEvaluation = {
  triggeredRules: VetoRuleId[];
  messages: string[];
};
