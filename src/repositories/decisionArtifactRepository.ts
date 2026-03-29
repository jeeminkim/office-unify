import { logger } from '../../logger';
import type { CommitteeVoteResult, DecisionArtifact } from '../contracts/decisionContract';
import {
  DECISION_CREATED_BY_ENGINE,
  DECISION_ENGINE_VERSION,
  DECISION_POLICY_VERSION
} from '../policies/decisionEnginePolicy';
import { COMMITTEE_MEMBER_WEIGHTS } from '../policies/committeeWeightsPolicy';
import { repoSupabase } from './supabaseClient';

export function isPostgresUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

export type InsertDecisionArtifactOutcome =
  | { status: 'inserted'; artifactId: string }
  | { status: 'duplicate_skipped' }
  | { status: 'failed'; message: string };

/**
 * decision_artifacts 단일 행 삽입. unique(chat_history_id, analysis_type, engine_version) 충돌 시 duplicate.
 */
export async function insertDecisionArtifactRow(params: {
  discordUserId: string;
  chatHistoryId: number;
  analysisType: string;
  artifact: DecisionArtifact;
  committeeRawScore: number;
}): Promise<InsertDecisionArtifactOutcome> {
  const row: Record<string, unknown> = {
    discord_user_id: params.discordUserId,
    chat_history_id: params.chatHistoryId,
    analysis_type: params.analysisType,
    original_decision: params.artifact.originalDecision,
    final_decision: params.artifact.decision,
    confidence_score: params.artifact.confidence,
    veto_applied: params.artifact.vetoApplied,
    veto_reason: params.artifact.vetoReason,
    veto_rule_ids_json: params.artifact.vetoRuleIds,
    weighted_score: params.committeeRawScore,
    normalized_score: params.artifact.normalizedScore,
    decision_summary: params.artifact.committeeSummary,
    committee_json: params.artifact.committeeVotes,
    supporting_claims_json: params.artifact.supportingClaims,
    supporting_claim_ids_json: params.artifact.supportingClaimIds,
    engine_version: params.artifact.engineVersion,
    policy_version: params.artifact.policyVersion,
    created_by_engine: params.artifact.createdByEngine,
    created_at: params.artifact.createdAt
  };

  const { data, error } = await repoSupabase.from('decision_artifacts').insert(row).select('id').maybeSingle();

  if (error) {
    if (isPostgresUniqueViolation(error)) {
      logger.info('DECISION_ENGINE', 'duplicate_artifact_skipped', {
        chatHistoryId: params.chatHistoryId,
        analysisType: params.analysisType,
        engineVersion: params.artifact.engineVersion
      });
      return { status: 'duplicate_skipped' };
    }
    logger.warn('DECISION_ENGINE', 'decision_artifact_save_failed', { message: error.message });
    return { status: 'failed', message: error.message };
  }

  const idRaw = data?.id;
  const artifactId = idRaw != null ? String(idRaw) : '';
  if (!artifactId) {
    logger.warn('DECISION_ENGINE', 'decision_artifact_save_failed', { message: 'no id returned' });
    return { status: 'failed', message: 'no id returned' };
  }

  logger.info('DECISION_ENGINE', 'artifact_saved', {
    artifactId,
    chatHistoryId: params.chatHistoryId,
    decision: params.artifact.decision
  });
  return { status: 'inserted', artifactId };
}

export async function insertCommitteeVoteLogs(params: {
  discordUserId: string;
  chatHistoryId: number;
  analysisType: string;
  decisionArtifactId: string;
  committee: CommitteeVoteResult;
  engineVersion?: string;
  policyVersion?: string;
}): Promise<boolean> {
  const ev = params.engineVersion ?? DECISION_ENGINE_VERSION;
  const pv = params.policyVersion ?? DECISION_POLICY_VERSION;

  const rows = params.committee.members.map(m => ({
    discord_user_id: params.discordUserId,
    chat_history_id: params.chatHistoryId,
    analysis_type: params.analysisType,
    decision_artifact_id: params.decisionArtifactId,
    persona_name: m.personaName,
    judgment: m.judgment,
    vote_value: m.vote,
    weight_value: COMMITTEE_MEMBER_WEIGHTS[m.personaKey] ?? 1,
    weighted_score: (COMMITTEE_MEMBER_WEIGHTS[m.personaKey] ?? 1) * m.vote * m.confidence,
    confidence_score: m.confidence,
    reasons_json: m.keyReasons,
    referenced_claim_ids_json: m.referencedClaimIds,
    raw_vote_reason: m.rawVoteReason,
    engine_version: ev,
    policy_version: pv,
    created_at: new Date().toISOString()
  }));

  if (!rows.length) return true;

  const { error } = await repoSupabase.from('committee_vote_logs').insert(rows);
  if (error) {
    if (isPostgresUniqueViolation(error)) {
      logger.info('DECISION_ENGINE', 'duplicate_artifact_skipped', {
        scope: 'committee_vote_logs',
        decisionArtifactId: params.decisionArtifactId
      });
      return false;
    }
    logger.warn('DECISION_ENGINE', 'decision_artifact_save_failed', {
      scope: 'committee_vote_logs',
      message: error.message
    });
    return false;
  }

  logger.info('DECISION_ENGINE', 'vote_logs_saved', {
    decisionArtifactId: params.decisionArtifactId,
    rowCount: rows.length
  });
  return true;
}
