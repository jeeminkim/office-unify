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
  reasonSummary: '湲곗뾽 ?대깽??由ъ뒪???먭?',
  briefDeckSlot: 'risk_review',
  decisionTrace: {
    riskFlags: [{ code: 'corporate_action' }],
    nextChecks: ['怨듭떆 ?뺤씤'],
    doNotDo: ['?뺣? 湲덉?'],
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
      title: '?먭?',
      doNotDo: ['留ㅼ닔쨌留ㅻ룄쨌?먮룞 二쇰Ц 吏?쒓? ?꾨떃?덈떎.'],
    });
    expect(d.notTradeInstruction).toBe(true);
    expect(d.checklist?.length).toBeGreaterThan(0);
  });

  it('committee roadmap maps buckets', () => {
    const d = buildCommitteeRoadmapItemDetail({
      title: '二쇨컙 ?먭?',
      reason: '?댁쑀',
      bucket: 'doThisWeek',
    });
    expect(d.checklist?.[0]?.label).toContain('二쇨컙');
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
    expect(d.whyCreated).not.toMatch(/吏湲?s*留ㅼ닔|留ㅼ닔\s*異붿쿇/);
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
      title: '理쒖냼 ?붿껌 ?뚯뒪????ぉ',
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
      title: 'PB ?붿빟',
      sourceSummary: '由ъ뒪???붿빟',
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
      title: 'Trend ?붿빟',
      fallback: {
        displayText: '?몃젋???듭떖 ?붿빟',
        copyableCompactText: '- 洹쇨굅 ?뺤씤\n- 怨쇱뿴 ?먭?',
      },
    });
    expect(req.sourceType).toBe('manual');
    expect(req.sourceLabel).toBe('trend_report');
    expect(req.detailJson?.sourceLabel).toBe('trend_report');
  });

  it('committee regenerate has originalQuestion and sourceRefs', () => {
    const d = buildCommitteeLineRegenerateActionItemDetail({
      personaKey: 'risk_officer',
      originalQuestion: 'HLB 由ъ뒪?щ뒗?',
      recoveredSummary: '蹂듦뎄 ?붿빟',
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
      noteSummary: '?ㅻ뒛 ?뺤씤??蹂댁쑀 ?먭?',
      noteDetail: '',
      riskFlags: ['risk_review'],
      nextChecks: ['怨듭떆 ?뺤씤', '沅뚮━ ?쇱젙 ?뺤씤'],
      doNotDo: ['?먮룞 二쇰Ц ?놁쓬'],
      evidenceNeeded: ['disclosure'],
      idempotencyKey: 'k1',
    });
    expect(d.whyCreated).toContain('Daily Review note');
    expect(d.decisionContext?.sourceSummary).toBe('?ㅻ뒛 ?뺤씤??蹂댁쑀 ?먭?');
    expect(d.checklist?.map((c) => c.label)).toEqual(['怨듭떆 ?뺤씤', '沅뚮━ ?쇱젙 ?뺤씤']);
    expect(d.recommendedNextLinks?.length).toBeGreaterThan(0);
  });
});
