/**
 * Phase 1 계층/contract 구조 스모크 검증 (테스트 러너 없이 ts-node 실행).
 * npm run check:phase1-structure
 */
import { routeEarlyButtonInteraction } from '../src/interactions/interactionRouter';
import { runFeedbackAppService } from '../src/application/runFeedbackAppService';
import { runPortfolioDebateAppService } from '../src/application/runPortfolioDebateAppService';
import { runTrendAnalysisAppService } from '../src/application/runTrendAnalysisAppService';
import { runOpenTopicDebateAppService } from '../src/application/runOpenTopicDebateAppService';
import { runDecisionEngineAppService } from '../src/application/runDecisionEngineAppService';
import { runAnalysisAppService } from '../src/application/runAnalysisAppService';
import { resolveProviderForPersona, executeWithProvider } from '../src/contracts/providerPolicy';
import { extractClaimsByContract } from '../src/contracts/claimContract';
import { insertChatHistoryWithLegacyFallback } from '../src/repositories/chatHistoryRepository';
import { insertGenerationTraceExtendedOrBase } from '../src/repositories/generationTraceRepository';
import { selectPersonaMemoryRow } from '../src/repositories/personaMemoryRepository';
import { extractClaimsWithFallbackMeta } from '../claimLedgerService';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

void routeEarlyButtonInteraction;
void runFeedbackAppService;
void runPortfolioDebateAppService;
void runTrendAnalysisAppService;
void runOpenTopicDebateAppService;
void runDecisionEngineAppService;
void runAnalysisAppService;
void insertChatHistoryWithLegacyFallback;
void insertGenerationTraceExtendedOrBase;
void selectPersonaMemoryRow;

const pol = resolveProviderForPersona({
  discordUserId: '0',
  personaKey: 'HINDENBURG',
  personaName: 'HINDENBURG_ANALYST'
});
assert(pol.provider === 'openai' || pol.provider === 'gemini', 'provider policy resolves');

assert(typeof executeWithProvider === 'function', 'executeWithProvider export');

const ex = extractClaimsByContract({
  responseText: '## A\n- one\n- two',
  analysisType: 'open_topic',
  personaName: 'Test'
});
assert(Array.isArray(ex.claims) && ex.claims.length >= 1, 'claim contract extraction');

const meta = extractClaimsWithFallbackMeta({
  responseText: '',
  analysisType: 'x',
  personaName: 'x'
});
assert(meta.usedSingleClaimFallback === true, 'single-claim fallback path');

console.log('[phase1-structure-self-check] interaction → application → repository symbols OK.');
console.log('[phase1-structure-self-check] providerPolicy / claimContract / claimLedger meta OK.');
