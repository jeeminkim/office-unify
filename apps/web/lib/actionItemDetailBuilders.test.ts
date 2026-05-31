import { describe, expect, it } from 'vitest';
import {
  buildActionItemDetailFromTodayCandidate,
  buildCommitteeLineRegenerateActionItemDetail,
  buildCommitteeRoadmapItemDetail,
  buildDailyReviewNoteActionItemDetail,
  buildGenericActionItemDetail,
  buildGoogleFinanceSetupActionItemDetail,
  buildManualSemanticActionItemDetail,
  buildPbDailyNoteActionItemDetail,
  buildResearchReportActionItemDetail,
  buildUsDiagnosticsActionItemDetail,
  enrichCreateRequestWithDetail,
  pbDailyNoteActionIdempotencyKey,
} from '@/lib/actionItemDetailBuilders';
import { analyzeActionItemDetailCompleteness } from '@/lib/actionItemDetailCompleteness';
import { buildLongResponseActionItemRequest } from '@/lib/longResponseFallbackSeeds';
import type { TodayStockCandidate } from '@/lib/todayCandidatesContract';

const baseCandidate = {
  candidateId: 'c1',
  name: 'HLB',
  stockCode: '028300',
  market: 'KR',
  reasonSummary: '기업 이벤트 리스크 점검',
  briefDeckSlot: 'risk_review',
  decisionTrace: {
    riskFlags: [{ code: 'corporate_action' }],
    nextChecks: ['공시 확인'],
    doNotDo: ['주문 금지'],
    missingEvidence: [{ code: 'disclosure' }],
  },
} as TodayStockCandidate;

describe('actionItemDetailBuilders', () => {
  it('today candidate risk review has checklist and notTradeInstruction', () => {
    const d = buildActionItemDetailFromTodayCandidate(baseCandidate);
    expect(d.notTradeInstruction).toBe(true);
    expect((d.checklist?.length ?? 0)).toBeGreaterThan(0);
    expect((d.doNotDo?.length ?? 0)).toBeGreaterThan(0);
  });

  it('blocks trade instruction phrases in generic builder defaults', () => {
    const d = buildGenericActionItemDetail({
      sourceType: 'manual',
      title: '점검',
      doNotDo: ['매수·매도·자동 주문 지시가 아닙니다.'],
    });
    expect(d.notTradeInstruction).toBe(true);
    expect(d.checklist?.length).toBeGreaterThan(0);
  });

  it('committee roadmap maps buckets', () => {
    const d = buildCommitteeRoadmapItemDetail({
      title: '주간 점검',
      reason: '이유',
      bucket: 'doThisWeek',
    });
    expect(d.checklist?.[0]?.label).toContain('주간');
  });

  it('google finance setup detail includes readback summary', () => {
    const d = buildGoogleFinanceSetupActionItemDetail({
      status: 'degraded',
      actionHint: 'fallback only',
      warnings: [],
      expectedTabs: ['portfolio_quotes'],
      sampleFormulas: ['=GOOGLEFINANCE("NASDAQ:TSLA","price")'],
      overallQuoteSource: 'yahoo_fallback',
      portfolioQuotesTab: { configuredName: 'portfolio_quotes', readbackUnavailable: false },
      usAnchor: {
        requested: 18,
        summary: { sheetsAnchorOk: 0, fallbackOnly: 3, missing: 15, rangeOrPermissionError: 0 },
        results: [{ symbol: 'TSLA', source: 'yahoo_fallback', readbackStatus: 'missing' }],
      },
    });
    expect(d.googleFinanceReadback?.sheetsAnchorOk).toBe(0);
    expect(d.googleFinanceReadback?.fallbackOnly).toBe(3);
    expect(d.googleFinanceReadback?.primaryTab).toBe('portfolio_quotes');
    expect(d.googleFinanceReadback?.sampleTableIncluded).toBe(true);
    expect(d.doNotDo?.some((x) => x.includes('SQL'))).toBe(true);
    expect(d.whyCreated).not.toMatch(/지금\s*매수|매수\s*추천/);
    expect(d.doNotDo?.some((x) => /automatic|자동/i.test(x))).toBe(true);
  });

  it('pb daily note action detail has checklist and idempotency key', () => {
    const d = buildPbDailyNoteActionItemDetail(
      {
        subjectType: 'holding',
        symbol: '028300',
        name: 'HLB',
        noteSummary: 'Daily PB memo',
        pbPerspective: 'Check context',
        nextChecks: ['Check disclosure'],
        doNotDo: ['Do not expand risk'],
        evidenceNeeded: ['disclosure'],
      },
      '2026-05-19',
    );
    expect(d.whyCreated).toContain('PB Daily Note');
    expect(d.checklist?.[0]?.source).toBe('pb_daily_note');
    expect(pbDailyNoteActionIdempotencyKey('2026-05-19', { subjectType: 'holding', symbol: '028300' })).toContain(
      'pb-daily-note-action',
    );
  });

  it('us diagnostics has anchor checklist', () => {
    const d = buildUsDiagnosticsActionItemDetail();
    expect((d.checklist?.length ?? 0)).toBeGreaterThan(0);
    expect(d.doNotDo?.some((x) => /buy|sell|매수/i.test(x))).toBe(true);
  });

  it('enrich minimal request adds checklist sourceSummary notTradeInstruction', () => {
    const enriched = enrichCreateRequestWithDetail({
      title: '최소 요청 테스트 항목',
      sourceType: 'manual',
    });
    const d = enriched.detailJson!;
    expect(d.notTradeInstruction).toBe(true);
    expect(d.sourceSummary?.length).toBeGreaterThan(0);
    expect((d.checklist?.length ?? 0)).toBeGreaterThan(0);
    expect(d.doNotDo?.some((x) => /buy|sell|order|rebalance|매수|매도|자동/i.test(x))).toBe(true);
  });

  it('manual semantic pb_response has sourceLabel and sourceRefs', () => {
    const d = buildManualSemanticActionItemDetail({
      sourceLabel: 'pb_response',
      title: 'PB 요약',
      sourceSummary: '리스크 요약',
    });
    expect(d.sourceLabel).toBe('pb_response');
    expect(d.sourceRefs?.[0]?.sourceType).toBe('pb_response');
    expect(d.doNotDo?.some((x) => x.includes('PB'))).toBe(true);
    const report = analyzeActionItemDetailCompleteness(d);
    expect(report.hasSourceRefsOrLinks).toBe(true);
    expect(report.hasActionSteps).toBe(true);
  });

  it('long response trend uses manual semantic detail', () => {
    const req = buildLongResponseActionItemRequest({
      sourceType: 'trend_report',
      title: 'Trend 요약',
      fallback: {
        displayText: '트렌드 핵심 요약',
        copyableCompactText: '- 근거 확인\n- 과열 평가',
      },
    });
    expect(req.sourceType).toBe('manual');
    expect(req.sourceLabel).toBe('trend_report');
    expect(req.detailJson?.sourceLabel).toBe('trend_report');
  });

  it('committee regenerate has originalQuestion and sourceRefs', () => {
    const d = buildCommitteeLineRegenerateActionItemDetail({
      personaKey: 'risk_officer',
      originalQuestion: 'HLB 리스크는?',
      recoveredSummary: '복구 요약',
      committeeTurnId: 'turn-1',
    });
    expect(d.decisionContext?.originalQuestion).toContain('HLB');
    expect(d.sourceRefs?.some((r) => r.sourceType === 'committee_discussion')).toBe(true);
    expect(d.notTradeInstruction).toBe(true);
  });

  it('research report detail has research sourceRefs', () => {
    const d = buildResearchReportActionItemDetail({
      title: 'Report',
      requestId: 'req-1',
      sourceSummary: 'Summary',
    });
    expect(d.sourceRefs?.some((r) => r.sourceType === 'research_report')).toBe(true);
    expect(d.checklist?.some((c) => /evidence|summary|근거/i.test(c.label))).toBe(true);
  });

  it('daily review note detail maps checklist and source summary', () => {
    const d = buildDailyReviewNoteActionItemDetail({
      subjectType: 'holding',
      symbol: '028300',
      name: 'HLB',
      market: 'KR',
      noteSummary: '오늘 확인한 보유 평가',
      noteDetail: '',
      riskFlags: ['risk_review'],
      nextChecks: ['공시 확인', '권리 일정 확인'],
      doNotDo: ['자동 주문 없음'],
      evidenceNeeded: ['disclosure'],
      idempotencyKey: 'k1',
    });
    expect(d.whyCreated).toContain('Daily Review note');
    expect(d.decisionContext?.sourceSummary).toBe('오늘 확인한 보유 평가');
    expect(d.checklist?.map((c) => c.label)).toEqual(['공시 확인', '권리 일정 확인']);
    expect(d.recommendedNextLinks?.length).toBeGreaterThan(0);
  });
});
