import { describe, expect, it } from 'vitest';
import { classifyAnchorIssue } from '@/lib/server/googleFinanceAnchorIssue';

describe('classifyAnchorIssue', () => {
  it('numeric price → ok', () => {
    expect(
      classifyAnchorIssue({
        market: 'US',
        symbol: 'SPY',
        normalizedKey: 'US:SPY',
        googleTicker: 'NYSEARCA:SPY',
        price: 500,
        rowStatus: 'ok',
      }).issue,
    ).toBe('ok');
  });

  it('no row → no_row', () => {
    expect(classifyAnchorIssue(null).issue).toBe('no_row');
  });

  it('blank price with formula_pending → formula_pending or price_empty', () => {
    const r = classifyAnchorIssue({
      market: 'US',
      symbol: 'SPY',
      normalizedKey: 'US:SPY',
      googleTicker: 'NYSEARCA:SPY',
      rawPrice: '',
      rowStatus: 'formula_pending',
    });
    expect(['formula_pending', 'price_empty', 'no_formula']).toContain(r.issue);
  });
});
