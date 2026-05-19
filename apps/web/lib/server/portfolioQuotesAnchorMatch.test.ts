import { describe, expect, it } from 'vitest';
import type { GoogleFinanceQuoteRow } from '@/lib/server/googleFinanceSheetQuoteService';
import {
  findSheetRowForAnchor,
  isPortfolioQuoteRowReadbackOk,
  missingRequiredAnchors,
  sheetRowMatchesAnchor,
} from '@/lib/server/portfolioQuotesAnchorMatch';
import { US_MARKET_SEED_ANCHORS } from '@/lib/server/usMarketMorningSummary';

function row(partial: Partial<GoogleFinanceQuoteRow> & { symbol: string; googleTicker: string }): GoogleFinanceQuoteRow {
  return {
    market: partial.market ?? 'US',
    symbol: partial.symbol,
    normalizedKey: partial.normalizedKey ?? `US:${partial.symbol}`,
    googleTicker: partial.googleTicker,
    price: partial.price,
    rawPrice: partial.rawPrice,
    rowStatus: partial.rowStatus,
    sheetStatus: partial.sheetStatus,
  };
}

describe('portfolioQuotesAnchorMatch', () => {
  const rows: GoogleFinanceQuoteRow[] = [
    row({ symbol: 'SPY', googleTicker: 'NYSEARCA:SPY', price: 500, rowStatus: 'ok' }),
    row({ symbol: 'QQQ', googleTicker: 'NASDAQ:QQQ', price: 400, rowStatus: 'ok' }),
    row({ symbol: 'TSLA', googleTicker: 'NASDAQ:TSLA', rawPrice: '250', sheetStatus: 'ok' }),
    row({ symbol: 'NVDA', googleTicker: 'NASDAQ:NVDA', price: 900, rowStatus: 'ok' }),
  ];

  it('matches anchor by symbol or prefixed google_ticker', () => {
    const spy = US_MARKET_SEED_ANCHORS.find((a) => a.quoteSymbol === 'SPY')!;
    expect(findSheetRowForAnchor(rows, spy)?.symbol).toBe('SPY');
    const tsla = US_MARKET_SEED_ANCHORS.find((a) => a.quoteSymbol === 'TSLA')!;
    expect(sheetRowMatchesAnchor(rows[2]!, tsla)).toBe(true);
    expect(findSheetRowForAnchor([row({ symbol: 'TSLA', googleTicker: 'TSLA', price: 1, rowStatus: 'ok' })], tsla)).toBeTruthy();
  });

  it('treats price or sheet status ok as readback ok', () => {
    expect(isPortfolioQuoteRowReadbackOk(rows[2]!)).toBe(true);
    expect(isPortfolioQuoteRowReadbackOk(row({ symbol: 'X', googleTicker: 'NASDAQ:X', price: 10, rowStatus: 'ok' }))).toBe(true);
  });

  it('lists missing required anchors', () => {
    const missing = missingRequiredAnchors(rows);
    expect(missing.some((m) => m.symbol === 'DIA')).toBe(true);
    expect(missing.some((m) => m.symbol === 'SPY')).toBe(false);
  });
});
