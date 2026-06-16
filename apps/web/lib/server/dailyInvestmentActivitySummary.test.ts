import { describe, expect, it } from 'vitest';
import { buildDailyInvestmentActivitySummary } from './dailyInvestmentActivitySummary';

describe('buildDailyInvestmentActivitySummary', () => {
  it('returns empty state when there is no daily context', () => {
    const summary = buildDailyInvestmentActivitySummary({});
    expect(summary.status).toBe('empty');
    expect(summary.guardrail.noAutomaticExecution).toBe(true);
  });

  it('summarizes PB conversation as activity, not a trade instruction', () => {
    const summary = buildDailyInvestmentActivitySummary({
      pbDailyConversation: {
        templateType: 'daily_checkin',
        userIntent: 'AI 전력 인프라 확인',
        actionCategory: 'add_buy',
        symbols: ['LS'],
        themes: ['AI 전력 인프라'],
        thesisSnapshot: {},
        riskSnapshot: {},
        nextCheckpoints: ['수주', '실적'],
        memoryCandidates: [],
      },
    });
    const text = JSON.stringify(summary);
    expect(summary.status).toBe('ready');
    expect(summary.deferredAction).toContain('확인 기준 전 행동 보류');
    expect(summary.usedSources).toContain('pb_daily_conversations');
    expect(text).not.toMatch(/매수하세요|팔아야 합니다|지금 들어가세요|자동 주문|자동 리밸런싱/);
  });
});
