import 'server-only';

type HoldingInput = {
  market: string;
  symbol: string;
};

export type HoldingQuote = {
  market: string;
  symbol: string;
  currentPrice?: number;
  currency?: string;
  stale: boolean;
  sourceSymbol?: string;
};

export type QuoteBundle = {
  quoteByHolding: Map<string, HoldingQuote>;
  usdKrwRate?: number;
  warnings: string[];
  quoteAvailable: boolean;
};

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=';
const STALE_MS = 24 * 60 * 60 * 1000;

type YahooQuoteResult = {
  symbol?: string;
  regularMarketPrice?: number;
  currency?: string;
  regularMarketTime?: number;
};

function holdingKey(market: string, symbol: string): string {
  return `${market}:${symbol.toUpperCase()}`;
}

function isNumericKrCode(symbol: string): boolean {
  return /^\d{6}$/.test(symbol.trim());
}

function buildYahooCandidates(market: string, symbol: string): string[] {
  const upper = symbol.trim().toUpperCase();
  if (market === 'KR') {
    if (!isNumericKrCode(upper)) return [upper];
    return [`${upper}.KS`, `${upper}.KQ`, upper];
  }
  return [upper];
}

async function fetchYahooQuotes(symbols: string[]): Promise<Map<string, YahooQuoteResult>> {
  if (symbols.length === 0) return new Map();
  const endpoint = `${YAHOO_QUOTE_URL}${encodeURIComponent(symbols.join(','))}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      next: { revalidate: 120 },
    });
    if (!res.ok) return new Map();
    const json = (await res.json()) as { quoteResponse?: { result?: YahooQuoteResult[] } };
    const rows = json.quoteResponse?.result ?? [];
    return new Map(rows.map((row) => [String(row.symbol ?? '').toUpperCase(), row]));
  } catch {
    return new Map();
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadHoldingQuotes(holdings: HoldingInput[]): Promise<QuoteBundle> {
  const warnings: string[] = [];
  const quoteByHolding = new Map<string, HoldingQuote>();

  const symbolCandidates = new Map<string, string[]>();
  holdings.forEach((holding) => {
    const key = holdingKey(holding.market, holding.symbol);
    symbolCandidates.set(key, buildYahooCandidates(holding.market, holding.symbol));
  });
  const yahooSymbols = Array.from(
    new Set([...symbolCandidates.values()].flat().concat(['KRW=X'])),
  );

  const quoteMap = await fetchYahooQuotes(yahooSymbols);
  if (quoteMap.size === 0) {
    warnings.push('quote_fetch_failed');
  }

  let matchedCount = 0;
  symbolCandidates.forEach((candidates, key) => {
    const [market, symbol] = key.split(':');
    const row = candidates.map((candidate) => quoteMap.get(candidate.toUpperCase())).find(Boolean);
    const price = Number(row?.regularMarketPrice ?? NaN);
    const marketTime = Number(row?.regularMarketTime ?? 0) * 1000;
    const stale = !marketTime || Date.now() - marketTime > STALE_MS;
    const valid = Number.isFinite(price) && price > 0;
    if (valid) matchedCount += 1;
    quoteByHolding.set(key, {
      market,
      symbol,
      currentPrice: valid ? price : undefined,
      currency: row?.currency,
      stale: valid ? stale : true,
      sourceSymbol: row?.symbol,
    });
  });

  const fx = quoteMap.get('KRW=X');
  const usdKrwRateRaw = Number(fx?.regularMarketPrice ?? NaN);
  const usdKrwRate = Number.isFinite(usdKrwRateRaw) && usdKrwRateRaw > 0 ? usdKrwRateRaw : undefined;
  if (!usdKrwRate) {
    warnings.push('usdkrw_rate_unavailable');
  }

  return {
    quoteByHolding,
    usdKrwRate,
    warnings,
    quoteAvailable: matchedCount > 0,
  };
}

