/**
 * Phase 2 — 구조화된 의사결정 산출물 계약 (실행/주문 없음).
 */

import type { VetoRuleId } from './riskPolicyContract';

export type DecisionType = 'BUY' | 'ADD' | 'HOLD' | 'REDUCE' | 'EXIT' | 'NO_ACTION';

export type JudgmentType = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CAUTION';

/** 위원 단위 투표값 (−1 부정 ~ +1 긍정) */
export type VoteValue = -1 | 0 | 1;

export type PersonaKeyCommittee = 'RAY' | 'HINDENBURG' | 'SIMONS' | 'DRUCKER' | 'CIO';

/** 위원 1인의 구조화 판단 (텍스트 응답은 유지, 병행 산출) */
export type PersonaCommitteeJudgment = {
  personaKey: PersonaKeyCommittee;
  personaName: string;
  judgment: JudgmentType;
  vote: VoteValue;
  /** 0~1 계산값 (키워드·claim 신뢰도 혼합) */
  confidence: number;
  keyReasons: string[];
  referencedClaimIds: string[];
  /** vote 산출 근거 한 줄 (DB raw_vote_reason, 감사용) */
  rawVoteReason: string;
};

export type CommitteeVoteResult = {
  /** Σ(weight × vote × confidence) */
  rawWeightedScore: number;
  totalWeight: number;
  /** rawWeightedScore / totalWeight, 대략 [-1, 1] */
  normalizedScore: number;
  /** vote 직전 후보 (veto 적용 전) */
  candidateDecision: DecisionType;
  members: PersonaCommitteeJudgment[];
  committeeSummary: string;
};

export type VetoResult = {
  vetoApplied: boolean;
  vetoReasons: string[];
  vetoRuleIds: VetoRuleId[];
  /** 위원회 raw 후보 (임계 매핑 결과) */
  originalDecision: DecisionType;
  /** veto 적용 후 최종 */
  finalDecision: DecisionType;
};

export type DecisionArtifact = {
  /** 저장 후 DB PK (미저장 시 없음) */
  artifactId?: string;
  discordUserId: string;
  analysisType: string;
  chatHistoryId: number | null;
  /** 엔진·정책 버전 (DB engine_version / policy_version 정합) */
  engineVersion: string;
  policyVersion: string;
  createdByEngine: string;
  /** veto 전 위원회 후보 */
  originalDecision: DecisionType;
  /** veto 후 최종 */
  decision: DecisionType;
  /** 0~1, 위원회 일치도·신뢰 혼합 */
  confidence: number;
  vetoApplied: boolean;
  vetoReason: string | null;
  /** 적용된 veto 규칙 id (없으면 빈 배열) */
  vetoRuleIds: VetoRuleId[];
  committeeSummary: string;
  committeeVotes: PersonaCommitteeJudgment[];
  supportingClaims: Array<{ id: string; persona_name: string; claim_summary: string }>;
  /** 근거 claim id 목록 (중복 제거, scorecard/audit 연결용) */
  supportingClaimIds: string[];
  weightedScore: number;
  normalizedScore: number;
  createdAt: string;
};
