import { describe, expect, it } from 'vitest';
import { buildDashboardCopilotStatus, buildPortfolioQuoteCopilotStatus } from './copilotStatusModel';

describe('buildDashboardCopilotStatus', () => {
  it('offers quote recovery when US discovery fallback is active', () => {
    const status = buildDashboardCopilotStatus({
      todayBrief: {
        qualityMeta: {
          todayCandidates: {
            deckContract: {
              targetKrSlots: 2,
              filledKrSlots: 1,
              targetUsSlots: 1,
              filledUsSlots: 0,
              usDiagnosticSlotPresent: false,
              usDiscoverySlotPresent: true,
              deckContractStatus: 'degraded_with_discovery',
              actionHint: 'US discovery is shown read-only.',
            },
          },
        },
      } as Parameters<typeof buildDashboardCopilotStatus>[0]['todayBrief'],
      quoteRecovery: null,
      opsRunbookPlan: null,
    });

    expect(status.statusLevel).toBe('degraded_but_usable');
    expect(status.primaryAction).toBe('run_quote_recovery');
    expect(status.requiresConfirm).toBe(true);
    expect(status.isWriteAction).toBe(false);
    expect(status.noTradeGuardrailKo).toContain('자동주문');
  });

  it('never leaves an error state without a primary next action', () => {
    const status = buildDashboardCopilotStatus({
      todayBrief: null,
      quoteRecovery: null,
      opsRunbookPlan: null,
      errorMessage: 'network failed',
    });

    expect(status.statusLevel).toBe('blocked_needs_input');
    expect(status.primaryAction).not.toBe('none');
    expect(status.primaryActionLabelKo).toContain('점검');
  });

  it('guides portfolio quote gaps to one ticker action first', () => {
    const status = buildPortfolioQuoteCopilotStatus({
      missingTickerCount: 2,
      autoApplicableTickerCount: 0,
      quoteUsabilityStatus: 'failed',
    });

    expect(status.statusLevel).toBe('needs_attention');
    expect(status.primaryAction).toBe('run_quote_recovery');
    expect(status.primaryActionLabelKo).toBe('추천 ticker 찾기');
    expect(status.isWriteAction).toBe(false);
  });
});
