import type { WebPortfolioWatchlistRow } from '@office-unify/supabase-access';

function onlyDigits(v: string | undefined | null): string {
  return String(v ?? '').replace(/\D/g, '');
}

function norm(v: string | undefined | null): string {
  return String(v ?? '').trim().toUpperCase();
}

export function isDuplicateWatchlistCandidate(
  existing: WebPortfolioWatchlistRow[],
  input: {
    market?: string;
    name?: string;
    stockCode?: string;
    symbol?: string;
    googleTicker?: string;
    quoteSymbol?: string;
  },
): boolean {
  const inputCode = onlyDigits(input.stockCode ?? input.symbol ?? input.quoteSymbol ?? input.googleTicker);
  const inputSymbol = norm(input.symbol);
  const inputGoogle = norm(input.googleTicker);
  const inputQuote = norm(input.quoteSymbol);
  const inputName = norm(input.name);
  const inputMarket = norm(input.market);

  return existing.some((row) => {
    const rowCode = onlyDigits(row.symbol ?? row.quote_symbol ?? row.google_ticker);
    const rowSymbol = norm(`${row.market}:${row.symbol}`);
    const rowGoogle = norm(row.google_ticker);
    const rowQuote = norm(row.quote_symbol);
    const rowName = norm(row.name);
    const rowMarket = row.market === 'KR' ? 'KR' : row.market;
    if (inputCode && rowCode && inputCode === rowCode) return true;
    if (inputSymbol && rowSymbol && inputSymbol === rowSymbol) return true;
    if (inputGoogle && rowGoogle && inputGoogle === rowGoogle) return true;
    if (inputQuote && rowQuote && inputQuote === rowQuote) return true;
    if (inputName && rowName && inputName === rowName && inputMarket && inputMarket === rowMarket) return true;
    return false;
  });
}
