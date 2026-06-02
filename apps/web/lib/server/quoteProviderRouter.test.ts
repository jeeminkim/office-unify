import { describe, expect, it } from 'vitest';
import { buildQuoteProviderRouterSummary } from './quoteProviderRouter';

describe('quoteProviderRouter', () => {
  it('does not treat Google Sheets GOOGLEFINANCE as a primary realtime provider', () => {
    const out = buildQuoteProviderRouterSummary({
      googleFinanceConfigured: true,
      matchedQuoteCount: 0,
      missingSymbols: ['US:TSLA'],
    });
    expect(out.googleFinanceIsPrimaryRealtimeProvider).toBe(false);
    expect(out.fallbackProvider).toBe('google_sheets_googlefinance');
    expect(out.results.find((r) => r.provider === 'external_us_quote_provider_stub')).toMatchObject({
      configured: false,
      failureReasons: ['provider_not_configured'],
    });
    expect(out.results.find((r) => r.provider === 'google_sheets_googlefinance')?.failureReasons).toContain(
      'quote_not_returned',
    );
    expect(out.results.find((r) => r.provider === 'google_sheets_googlefinance')).toMatchObject({
      status: 'partial',
      providerType: 'formula_readback',
    });
    expect(out.writeAction).toBe(false);
  });

  it('uses fresh cache first when available and keeps Sheets as fallback', () => {
    const out = buildQuoteProviderRouterSummary({
      googleFinanceConfigured: true,
      matchedQuoteCount: 4,
      manualCacheFresh: true,
    });
    expect(out.primaryProvider).toBe('manual_cache');
    expect(out.results.find((r) => r.provider === 'manual_cache')).toMatchObject({
      used: true,
      status: 'ok',
      freshnessStatus: 'fresh',
    });
    expect(out.results.find((r) => r.provider === 'google_sheets_googlefinance')).toMatchObject({
      providerType: 'formula_readback',
      used: false,
    });
  });
});
