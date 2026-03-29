/**
 * Phase 2 decision engine 스모크: 위원회 점수, veto, chat_history_id 계약, (선택) DB 저장.
 * npm run check:decision-engine
 */
import 'dotenv/config';
import { runCommitteeVote } from '../src/services/committeeDecisionService';
import { evaluateRiskVetoRules, applyRiskVeto } from '../src/services/riskVetoService';
import type { PersonaCommitteeJudgment } from '../src/contracts/decisionContract';
import { mapRawScoreToCandidate } from '../src/policies/decisionThresholdPolicy';
import {
  insertCommitteeVoteLogs,
  insertDecisionArtifactRow,
  isPostgresUniqueViolation
} from '../src/repositories/decisionArtifactRepository';
import type { DecisionArtifact } from '../src/contracts/decisionContract';
import {
  DECISION_CREATED_BY_ENGINE,
  DECISION_ENGINE_VERSION,
  DECISION_POLICY_VERSION
} from '../src/policies/decisionEnginePolicy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const bullishMembers: PersonaCommitteeJudgment[] = [
  {
    personaKey: 'RAY',
    personaName: 'Ray Dalio (PB)',
    judgment: 'BULLISH',
    vote: 1,
    confidence: 0.9,
    keyReasons: ['t'],
    referencedClaimIds: [],
    rawVoteReason: 'mock'
  },
  {
    personaKey: 'HINDENBURG',
    personaName: 'HINDENBURG_ANALYST',
    judgment: 'BULLISH',
    vote: 1,
    confidence: 0.8,
    keyReasons: ['t'],
    referencedClaimIds: [],
    rawVoteReason: 'mock'
  },
  {
    personaKey: 'SIMONS',
    personaName: 'James Simons (Quant)',
    judgment: 'BULLISH',
    vote: 1,
    confidence: 0.85,
    keyReasons: ['t'],
    referencedClaimIds: [],
    rawVoteReason: 'mock'
  },
  {
    personaKey: 'DRUCKER',
    personaName: 'Peter Drucker (COO)',
    judgment: 'NEUTRAL',
    vote: 0,
    confidence: 0.5,
    keyReasons: ['t'],
    referencedClaimIds: [],
    rawVoteReason: 'mock'
  },
  {
    personaKey: 'CIO',
    personaName: 'Stanley Druckenmiller (CIO)',
    judgment: 'BULLISH',
    vote: 1,
    confidence: 0.88,
    keyReasons: ['t'],
    referencedClaimIds: [],
    rawVoteReason: 'mock'
  }
];

async function main() {
  const cv = runCommitteeVote({ members: bullishMembers, hasOpenPositions: true });
  assert(cv.rawWeightedScore > 0, 'committee raw score should be positive for bullish mock');
  assert(['BUY', 'ADD', 'HOLD', 'REDUCE', 'EXIT', 'NO_ACTION'].includes(cv.candidateDecision), 'candidate decision in enum');

  const vetoCtx = evaluateRiskVetoRules({
    candidateDecision: 'ADD',
    hindenburg: { judgment: 'BEARISH', confidence: 0.9 },
    portfolio: { top3WeightPct: 50, positionCount: 3, usSingleAssetConcentration: false },
    quotes: { degradedQuoteMode: false, quoteFailureCount: 0 },
    anchors: { hasLifestyle: true },
    claims: { totalCount: 10, minClaimsSuggested: 3 }
  });
  assert(vetoCtx.triggeredRules.includes('HINDENBURG_BEARISH_HIGH_CONF'), 'hindenburg bearish veto');
  const veto = applyRiskVeto({ candidateDecision: 'ADD', evaluation: vetoCtx });
  assert(veto.vetoApplied && veto.finalDecision !== 'ADD', 'ADD blocked under hindenburg veto');
  assert(veto.originalDecision === 'ADD', 'veto originalDecision tracks committee candidate');
  assert(Array.isArray(veto.vetoRuleIds) && veto.vetoRuleIds.includes('HINDENBURG_BEARISH_HIGH_CONF'), 'vetoRuleIds populated');

  const vetoBuyCtx = evaluateRiskVetoRules({
    candidateDecision: 'BUY',
    hindenburg: { judgment: 'BEARISH', confidence: 0.9 },
    portfolio: { top3WeightPct: 50, positionCount: 3, usSingleAssetConcentration: false },
    quotes: { degradedQuoteMode: false, quoteFailureCount: 0 },
    anchors: { hasLifestyle: true },
    claims: { totalCount: 10, minClaimsSuggested: 3 }
  });
  const vetoBuy = applyRiskVeto({ candidateDecision: 'BUY', evaluation: vetoBuyCtx });
  assert(vetoBuy.finalDecision !== 'BUY' && vetoBuy.finalDecision !== 'ADD', 'BUY/ADD blocked under hindenburg veto');

  assert(isPostgresUniqueViolation({ code: '23505' }), '23505 maps to unique violation');
  assert(!isPostgresUniqueViolation({ code: '42P01' }), 'other codes not unique');

  const mapHold = mapRawScoreToCandidate(0.5, true);
  assert(mapHold === 'HOLD', 'threshold mapping HOLD');

  const chId: number | null = 12345;
  const _n: number | null = chId;
  void _n;

  const baseArtifact: DecisionArtifact = {
    engineVersion: DECISION_ENGINE_VERSION,
    policyVersion: DECISION_POLICY_VERSION,
    createdByEngine: DECISION_CREATED_BY_ENGINE,
    discordUserId: 'self-check',
    analysisType: 'decision_engine_self_check',
    chatHistoryId: 1,
    originalDecision: 'HOLD',
    decision: 'HOLD',
    confidence: 0.5,
    vetoApplied: false,
    vetoReason: null,
    vetoRuleIds: [],
    committeeSummary: 'smoke',
    committeeVotes: [],
    supportingClaims: [],
    supportingClaimIds: [],
    weightedScore: 0,
    normalizedScore: 0,
    createdAt: new Date().toISOString()
  };

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const first = await insertDecisionArtifactRow({
      discordUserId: baseArtifact.discordUserId,
      chatHistoryId: 1,
      analysisType: `${baseArtifact.analysisType}_dup`,
      artifact: baseArtifact,
      committeeRawScore: 0
    });
    const second = await insertDecisionArtifactRow({
      discordUserId: baseArtifact.discordUserId,
      chatHistoryId: 1,
      analysisType: `${baseArtifact.analysisType}_dup`,
      artifact: baseArtifact,
      committeeRawScore: 0
    });
    if (first.status === 'inserted') {
      assert(second.status === 'duplicate_skipped', 'second insert should be idempotent');
      const voteOk = await insertCommitteeVoteLogs({
        discordUserId: baseArtifact.discordUserId,
        chatHistoryId: 1,
        analysisType: `${baseArtifact.analysisType}_dup`,
        decisionArtifactId: first.artifactId,
        committee: cv,
        engineVersion: DECISION_ENGINE_VERSION,
        policyVersion: DECISION_POLICY_VERSION
      });
      assert(voteOk, 'committee vote logs should persist when artifact insert succeeded');
      console.log(
        '[decision-engine-self-check] duplicate-safe insert + vote_logs OK (requires migration + valid chat_history id=1 or FK may fail).'
      );
    } else {
      console.warn(
        '[decision-engine-self-check] DB insert not verified (FK chat_history or migration). Logic-only checks passed.'
      );
    }
  }

  console.log('[decision-engine-self-check] committee vote + veto + contract checks OK.');
}

main().catch(e => {
  console.error('[decision-engine-self-check] FAILED', e);
  process.exit(1);
});
