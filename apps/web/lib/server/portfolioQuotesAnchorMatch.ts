import type { GoogleFinanceQuoteRow } from '@/lib/server/googleFinanceSheetQuoteService';
import { US_MARKET_SEED_ANCHORS } from '@/lib/server/usMarketMorningSummary';

export type PortfolioQuotesAnchorSeed = (typeof US_MARKET_SEED_ANCHORS)[number];

/** Repair·append 시 우선 보강할 US anchor (simplified portfolio_quotes). */
export const PORTFOLIO_QUOTES_REQUIRED_ANCHORS: Array<{ symbol: string; googleTicker: string }> = [
  { symbol: 'SPY', googleTicker: 'NYSEARCA:SPY' },
  { symbol: 'QQQ', googleTicker: 'NASDAQ:QQQ' },
  { symbol: 'DIA', googleTicker: 'NYSEARCA:DIA' },
  { symbol: 'SMH', googleTicker: 'NASDAQ:SMH' },
  { symbol: 'SOXX', googleTicker: 'NASDAQ:SOXX' },
  { symbol: 'AAPL', googleTicker: 'NASDAQ:AAPL' },
  { symbol: 'MSFT', googleTicker: 'NASDAQ:MSFT' },
  { symbol: 'NVDA', googleTicker: 'NASDAQ:NVDA' },
  { symbol: 'TSLA', googleTicker: 'NASDAQ:TSLA' },
  { symbol: 'NFLX', googleTicker: 'NASDAQ:NFLX' },
];

/** US registry + 필수 단일주 — append_missing_anchor_rows 대상 (symbol 기준 dedupe). */
export function buildRepairAppendAnchors(): Array<{ symbol: string; googleTicker: string }> {
  const bySymbol = new Map<string, { symbol: string; googleTicker: string }>();
  for (const a of US_MARKET_SEED_ANCHORS) {
    bySymbol.set(a.quoteSymbol, { symbol: a.quoteSymbol, googleTicker: a.googleTicker });
  }
  for (const a of PORTFOLIO_QUOTES_REQUIRED_ANCHORS) {
    if (!bySymbol.has(a.symbol)) bySymbol.set(a.symbol, a);
  }
  return [...bySymbol.values()];
}

const EXTRA_ANCHOR_TICKER_ALIASES: Record<string, string[]> = {
  SMH: ['NYSEARCA:SMH'],
  SOXX: ['NYSEARCA:SOXX'],
};

function normToken(v: string): string {
  return v.trim().toUpperCase();
}

/** symbol / google_ticker / exchange prefix 모두 매칭 키로 확장. */
export function collectQuoteRowMatchKeys(row: GoogleFinanceQuoteRow): Set<string> {
  const keys = new Set<string>();
  const add = (raw: string | undefined) => {
    const u = normToken(raw ?? '');
    if (!u) return;
    keys.add(u);
    if (u.includes(':')) {
      const tail = u.split(':').pop();
      if (tail) keys.add(tail);
    }
  };
  add(row.symbol);
  add(row.googleTicker);
  add(row.normalizedKey);
  if (row.market) add(row.market);
  return keys;
}

export function collectAnchorMatchKeys(anchor: PortfolioQuotesAnchorSeed): Set<string> {
  const keys = new Set<string>();
  const add = (raw: string) => {
    const u = normToken(raw);
    if (u) keys.add(u);
    if (u.includes(':')) {
      const tail = u.split(':').pop();
      if (tail) keys.add(tail);
    }
  };
  add(anchor.key);
  add(anchor.quoteSymbol);
  add(anchor.googleTicker);
  for (const extra of EXTRA_ANCHOR_TICKER_ALIASES[anchor.quoteSymbol] ?? []) {
    add(extra);
  }
  return keys;
}

export function sheetRowMatchesAnchor(row: GoogleFinanceQuoteRow, anchor: PortfolioQuotesAnchorSeed): boolean {
  const rowKeys = collectQuoteRowMatchKeys(row);
  const anchorKeys = collectAnchorMatchKeys(anchor);
  for (const k of anchorKeys) {
    if (rowKeys.has(k)) return true;
  }
  return false;
}

export function findSheetRowForAnchor(
  rows: GoogleFinanceQuoteRow[],
  anchor: PortfolioQuotesAnchorSeed,
): GoogleFinanceQuoteRow | null {
  for (const row of rows) {
    if (sheetRowMatchesAnchor(row, anchor)) return row;
  }
  return null;
}

/** status 컬럼·price 숫자·rowStatus 기준으로 anchor read-back OK 여부. */
export function isPortfolioQuoteRowReadbackOk(row: GoogleFinanceQuoteRow | null): boolean {
  if (!row) return false;
  const statusCol = normToken(row.sheetStatus ?? '');
  if (statusCol === 'OK') return true;
  if (row.rowStatus === 'ok') return true;
  if (row.price != null && row.price > 0) return true;
  const raw = (row.rawPrice ?? '').trim();
  if (raw && !raw.startsWith('#') && !/^N\/A$/i.test(raw)) {
    const n = Number(raw.replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return true;
  }
  return false;
}

export function existingSheetSymbolsFromRows(rows: GoogleFinanceQuoteRow[]): Set<string> {
  const out = new Set<string>();
  for (const row of rows) {
    for (const k of collectQuoteRowMatchKeys(row)) {
      if (/^[A-Z][A-Z0-9.\-]{0,11}$/.test(k) || /^\d{6}$/.test(k)) out.add(k);
    }
  }
  return out;
}

function toSeed(anchor: { symbol: string; googleTicker: string }): PortfolioQuotesAnchorSeed {
  return {
    key: anchor.symbol,
    quoteSymbol: anchor.symbol,
    googleTicker: anchor.googleTicker,
    label: anchor.symbol,
  } as PortfolioQuotesAnchorSeed;
}

export function missingRequiredAnchors(rows: GoogleFinanceQuoteRow[]): Array<{ symbol: string; googleTicker: string }> {
  const missing: Array<{ symbol: string; googleTicker: string }> = [];
  for (const anchor of buildRepairAppendAnchors()) {
    if (!findSheetRowForAnchor(rows, toSeed(anchor))) missing.push(anchor);
  }
  return missing;
}
