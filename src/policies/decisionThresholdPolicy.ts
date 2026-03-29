import type { DecisionType } from '../contracts/decisionContract';

/**
 * rawWeightedScore = Σ(weight × vote × confidence) 기준 임계값.
 * 가중치 합 ≈ 5.2 이므로 동일 스케일에서 해석.
 */
export const DECISION_RAW_THRESHOLDS = {
  buy: 1.5,
  holdHigh: 0.3,
  neutralLow: -0.3,
  neutralHigh: 0.3,
  reduce: -1.5
} as const;

/** raw 점수 → 후보 DecisionType (veto 전) */
export function mapRawScoreToCandidate(raw: number, hasOpenPositions: boolean): DecisionType {
  if (raw >= DECISION_RAW_THRESHOLDS.buy) {
    return hasOpenPositions ? 'ADD' : 'BUY';
  }
  if (raw >= DECISION_RAW_THRESHOLDS.holdHigh) return 'HOLD';
  if (raw > DECISION_RAW_THRESHOLDS.neutralLow && raw < DECISION_RAW_THRESHOLDS.neutralHigh) return 'NO_ACTION';
  if (raw >= DECISION_RAW_THRESHOLDS.reduce && raw <= DECISION_RAW_THRESHOLDS.neutralLow) return 'REDUCE';
  return 'EXIT';
}
