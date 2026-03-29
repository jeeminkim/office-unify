import type { DecisionArtifact, PersonaKeyCommittee } from '../contracts/decisionContract';
import { runDecisionEngine } from '../services/decisionEngineService';

export type RunDecisionEngineAppParams = {
  discordUserId: string;
  chatHistoryId: number | null;
  analysisType: string;
  personaOutputs: Array<{
    personaKey: PersonaKeyCommittee;
    personaName: string;
    responseText: string;
  }>;
  snapshotSummary: {
    position_count: number;
    top3_weight_pct: number;
    degraded_quote_mode?: boolean;
    quote_failure_count?: number;
  };
  anchorState: { hasLifestyle: boolean };
  usSingleAssetConcentration: boolean;
};

/** Phase 2 — 분석 저장 이후 구조화 결정 산출(실행/주문 없음). 실패 시 null, 분석 흐름은 중단하지 않음. */
export async function runDecisionEngineAppService(params: RunDecisionEngineAppParams): Promise<DecisionArtifact | null> {
  return runDecisionEngine(params);
}

export function formatDecisionSummaryForDiscord(a: DecisionArtifact): string {
  const vetoLine = a.vetoApplied && a.vetoReason ? `\n⚠️ Veto: ${a.vetoReason}` : '';
  const ruleLine =
    a.vetoRuleIds.length > 0 ? `\n규칙: ${a.vetoRuleIds.join(', ')}` : '';
  const ver = `engine ${a.engineVersion} · policy ${a.policyVersion}`;
  const head =
    a.originalDecision !== a.decision
      ? `**위원회 결정** (${ver}) — 후보 **${a.originalDecision}** → 최종 **${a.decision}** (신뢰도 ${(a.confidence * 100).toFixed(0)}%)`
      : `**위원회 결정** (${ver}) — **${a.decision}** (신뢰도 ${(a.confidence * 100).toFixed(0)}%)`;
  return [head, `가중 점수: ${a.weightedScore.toFixed(3)} · 정규화: ${a.normalizedScore.toFixed(3)}`, `${a.committeeSummary}${ruleLine}${vetoLine}`].join(
    '\n'
  );
}
