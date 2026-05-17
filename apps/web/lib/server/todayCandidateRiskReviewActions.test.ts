import { describe, expect, it } from 'vitest';
import { resolveCorporateActionRiskForStockCode } from '@/lib/server/corporateActionRiskRegistry';
import {
  assertNoWriteOnActionBuild,
  expectedCorporateRiskActionLabels,
} from '@/lib/todayCandidateActionPolicy';
import {
  attachRiskReviewActionsToDeck,
  buildRiskReviewActions,
  isRiskReviewCandidate,
} from '@/lib/server/todayCandidateRiskReviewActions';
import type { TodayStockCandidate } from '@/lib/todayCandidatesContract';

function hlbCandidate(): TodayStockCandidate {
  const corp = resolveCorporateActionRiskForStockCode('028300')!;
  return {
    candidateId: 'hlb-test',
    name: 'HLB',
    market: 'KOSPI',
    country: 'KR',
    stockCode: '028300',
    source: 'watchlist',
    score: 48,
    confidence: 'medium',
    riskLevel: 'high',
    reasonSummary: '기업 이벤트 리스크 점검',
    reasonDetails: [],
    positiveSignals: [],
    cautionNotes: [],
    relatedUserContext: [],
    relatedWatchlistSymbols: [],
    isBuyRecommendation: false,
    corporateActionRisk: corp,
    candidateAction: 'review_required',
    briefDeckSlot: 'risk_review',
    decisionTrace: {
      decisionStatus: 'risk_review',
      selectedReasons: [],
      downgradeReasons: [{ code: 'corporate_action_risk', labelKo: '기업 이벤트' }],
      riskFlags: [{ code: 'corporate_event_risk', labelKo: '이벤트 리스크' }],
      missingEvidence: [],
      nextChecks: ['공시 확인'],
      doNotDo: ['신규 비중 확대 가정'],
    },
  };
}

describe('todayCandidateRiskReviewActions', () => {
  it('detects risk review candidates', () => {
    expect(isRiskReviewCandidate(hlbCandidate())).toBe(true);
  });

  it('builds riskReviewActions for corporateActionRisk active HLB', () => {
    const actions = buildRiskReviewActions(hlbCandidate(), { isWatchlist: true });
    const keys = actions.map((a) => a.actionKey);
    expect(keys).toContain('open_risk_detail');
    expect(keys).toContain('generate_research_report');
    expect(keys).toContain('create_decision_retrospective');
    expect(keys).toContain('create_trade_journal_seed');
    expect(keys).toContain('check_disclosure');
    expect(keys).toContain('keep_observing');
  });

  it('writeAction actions are contract-only (deferred or requires confirmation)', () => {
    const actions = buildRiskReviewActions(hlbCandidate());
    assertNoWriteOnActionBuild(actions);
    const writeActions = actions.filter((a) => a.writeAction);
    expect(writeActions.length).toBeGreaterThan(0);
    for (const a of writeActions) {
      expect(a.requiresConfirmation || a.deferred).toBe(true);
    }
  });

  it('corporateActionRisk active: core risk review actions with policyKind', () => {
    const actions = buildRiskReviewActions(hlbCandidate(), { isWatchlist: true });
    const labels = actions.map((a) => a.label);
    for (const fragment of expectedCorporateRiskActionLabels()) {
      expect(labels.some((l) => l.includes(fragment) || fragment.includes(l))).toBe(true);
    }
    expect(actions.every((a) => a.policyKind)).toBe(true);
    expect(actions.filter((a) => a.policyKind === 'disabled_todo').length).toBeGreaterThan(0);
    expect(actions.some((a) => a.policyKind === 'api_post_confirmed')).toBe(true);
    expect(actions.some((a) => a.href?.includes('/research-center'))).toBe(true);
  });

  it('view_report_history when history exists', () => {
    const actions = buildRiskReviewActions(hlbCandidate(), {
      hasReportHistory: true,
      reportOlderThan7d: true,
    });
    expect(actions.some((a) => a.actionKey === 'view_report_history')).toBe(true);
    const v = actions.find((a) => a.actionKey === 'view_report_history');
    expect(v?.label).toContain('변화');
  });

  it('attachRiskReviewActionsToDeck is additive', () => {
    const deck = attachRiskReviewActionsToDeck([hlbCandidate()]);
    expect(deck[0]?.riskReviewActions?.length).toBeGreaterThan(0);
    expect(deck[0]?.candidateAction).toBe('review_required');
  });

  it('action labels avoid auto-trading wording', () => {
    const actions = buildRiskReviewActions(hlbCandidate());
    const blob = JSON.stringify(actions);
    expect(blob).not.toMatch(/자동매매|자동 주문|자동 리밸런싱|매수 추천/);
  });
});
