import 'server-only';

import { isKosdaqQuoteLikelyKr } from '@/lib/server/googleFinanceTickerResolver';

export type TickerSuggestConfidence = 'low' | 'medium' | 'high';

export type TickerSuggestion = {
  market: 'KR' | 'US';
  symbol: string;
  normalizedSymbol: string;
  name?: string;
  googleTicker?: string;
  quoteSymbol?: string;
  sector?: string;
  confidence: TickerSuggestConfidence;
  reasons: string[];
  warnings: string[];
};

export type TickerSuggestResponse = {
  ok: boolean;
  suggestion?: TickerSuggestion;
  error?: string;
};

type PortfolioNameRow = {
  market: string;
  symbol: string;
  name: string;
  sector?: string | null;
};

const SECTOR_RULES: { label: string; keys: string[] }[] = [
  { label: '원전/SMR', keys: ['원전', '원자력', 'smr', '핵융합'] },
  { label: '2차전지', keys: ['2차전지', '이차전지', '배터리', '소재', 'battery', 'lithium'] },
  { label: '반도체', keys: ['하이닉스', '반도체', 'hbm', 'chip', 'semiconductor', '파운드리'] },
  { label: '바이오/헬스케어', keys: ['바이오', '제약', '헬스케어', 'therapeutics', 'pharma', '신약'] },
  { label: 'AI/전력인프라', keys: ['ai', '전력', '인프라', '데이터센터', 'datacenter', 'grid'] },
  { label: '방산', keys: ['방산', '우주', '항공', 'defense'] },
  { label: '조선', keys: ['조선', '해운', 'lng선'] },
  { label: 'K-콘텐츠', keys: ['미디어', '콘텐츠', '엔터', 'ott', '게임'] },
];

function normNameKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function suggestSectorFromText(blob: string): { sector: string; confidence: TickerSuggestConfidence } | null {
  const b = blob.toLowerCase();
  for (const r of SECTOR_RULES) {
    if (r.keys.some((k) => b.includes(k.toLowerCase()))) {
      return { sector: r.label, confidence: 'medium' };
    }
  }
  return null;
}

function normalizeKrUsSymbol(market: 'KR' | 'US', symbol: string): string {
  const t = symbol.trim().toUpperCase();
  if (!t) return '';
  if (market === 'KR' && /^\d{1,6}$/.test(t)) return t.padStart(6, '0').slice(-6);
  return t;
}

function extractSixDigitKrCode(text: string): string | null {
  const m = text.match(/\d{6}/);
  return m ? m[0] : null;
}

function findSymbolByPortfolioName(
  market: 'KR' | 'US',
  nameQuery: string,
  holdings: PortfolioNameRow[],
  watchlist: PortfolioNameRow[],
): { symbol: string; name: string; sector?: string | null; match: 'exact' | 'fuzzy' } | null {
  const q = normNameKey(nameQuery);
  if (!q) return null;
  const pool = [...holdings, ...watchlist].filter((r) => r.market === market);
  const exact = pool.find((r) => normNameKey(r.name) === q);
  if (exact) {
    return { symbol: exact.symbol.trim().toUpperCase(), name: exact.name, sector: exact.sector, match: 'exact' };
  }
  const fuzzy = pool.find(
    (r) =>
      normNameKey(r.name).includes(q)
      || q.includes(normNameKey(r.name))
      || normNameKey(r.name).replace(/\s/g, '').includes(q.replace(/\s/g, '')),
  );
  if (fuzzy) {
    return { symbol: fuzzy.symbol.trim().toUpperCase(), name: fuzzy.name, sector: fuzzy.sector, match: 'fuzzy' };
  }
  return null;
}

function backfillNameFromSymbol(
  market: 'KR' | 'US',
  symbolNorm: string,
  holdings: PortfolioNameRow[],
  watchlist: PortfolioNameRow[],
): string | undefined {
  if (!symbolNorm) return undefined;
  const pool = [...holdings, ...watchlist].filter((r) => r.market === market);
  const symU = symbolNorm.trim().toUpperCase();
  const h = pool.find((r) => r.symbol.trim().toUpperCase() === symU);
  return h?.name?.trim() || undefined;
}

export function buildTickerSuggestionFromInput(params: {
  market: 'KR' | 'US';
  symbol: string;
  name: string;
  holdings: PortfolioNameRow[];
  watchlist: PortfolioNameRow[];
}): TickerSuggestResponse {
  const { market, holdings, watchlist } = params;
  let symbolIn = params.symbol.trim();
  const nameIn = params.name.trim();
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!symbolIn && !nameIn) {
    return { ok: false, error: 'symbol_or_name_required' };
  }

  let resolvedName = nameIn || undefined;
  let fromPortfolio: { symbol: string; name: string; sector?: string | null; match: 'exact' | 'fuzzy' } | null = null;

  if (!symbolIn && nameIn) {
    fromPortfolio = findSymbolByPortfolioName(market, nameIn, holdings, watchlist);
    if (fromPortfolio) {
      symbolIn = fromPortfolio.symbol;
      reasons.push(
        fromPortfolio.match === 'exact'
          ? '보유/관심 원장에서 종목명과 일치하는 심볼을 찾았습니다.'
          : '보유/관심 원장에서 유사 종목명으로 심볼을 추정했습니다.',
      );
      if (!resolvedName) resolvedName = fromPortfolio.name;
    } else {
      const six = market === 'KR' ? extractSixDigitKrCode(nameIn) : null;
      if (six) {
        symbolIn = six;
        reasons.push('종목명에서 6자리 숫자 코드를 추출했습니다.');
      }
    }
  }

  const normalizedSymbol = normalizeKrUsSymbol(market, symbolIn);
  if (!normalizedSymbol) {
    warnings.push('심볼을 확정하지 못했습니다. 심볼을 직접 입력하거나 종목명을 보정하세요.');
    const blob = `${nameIn} ${symbolIn}`;
    const secGuess = suggestSectorFromText(blob);
    return {
      ok: true,
      suggestion: {
        market,
        symbol: symbolIn,
        normalizedSymbol: '',
        name: resolvedName,
        sector: secGuess?.sector,
        confidence: 'low',
        reasons,
        warnings,
      },
    };
  }

  if (!resolvedName) {
    const back = backfillNameFromSymbol(market, normalizedSymbol, holdings, watchlist);
    if (back) {
      resolvedName = back;
      reasons.push('동일 심볼이 기존 보유/관심에 있어 종목명을 보정했습니다.');
    }
  }

  const sectorBlob = `${resolvedName ?? ''} ${nameIn} ${fromPortfolio?.sector ?? ''}`;
  const sectorGuess = suggestSectorFromText(sectorBlob);
  const sector = fromPortfolio?.sector?.trim() || sectorGuess?.sector;
  if (sectorGuess && !fromPortfolio?.sector?.trim()) {
    reasons.push('종목명·키워드 기반으로 섹터를 추천했습니다(확인 필요).');
  }

  let googleTicker: string | undefined;
  let quoteSymbol: string | undefined;
  let confidence: TickerSuggestConfidence = 'medium';

  if (market === 'US') {
    googleTicker = normalizedSymbol;
    quoteSymbol = normalizedSymbol;
    reasons.push('US: google_ticker·quote_symbol 기본값은 대문자 심볼과 동일합니다.');
    confidence = 'high';
  } else {
    const core6 = /^\d{6}$/.test(normalizedSymbol) ? normalizedSymbol : null;
    const sectorHintForQuote = sectorGuess?.sector ?? fromPortfolio?.sector ?? undefined;
    const kosdaqFromName = isKosdaqQuoteLikelyKr(resolvedName ?? nameIn, sectorHintForQuote, core6);
    const kosdaqFromCode = !!core6 && /^140/.test(core6);
    const kosdaqLikely = kosdaqFromName || kosdaqFromCode;
    googleTicker = `KRX:${normalizedSymbol}`;
    quoteSymbol = `${normalizedSymbol}.${kosdaqLikely ? 'KQ' : 'KS'}`;
    reasons.push(`KR: google_ticker 기본 ${googleTicker}, quote_symbol ${quoteSymbol}(추천·검증 필요).`);
    if (kosdaqLikely) {
      reasons.push(
        kosdaqFromName
          ? '종목명/섹터 키워드상 코스닥(.KQ) 가능성을 반영했습니다.'
          : '6자리 코드 패턴상 코스닥(.KQ) 후보를 우선했습니다(확인 필요).',
      );
    }
    if (!/^\d{6}$/.test(normalizedSymbol)) {
      warnings.push('숫자 6자리가 아닌 KR 심볼/혼합코드는 시트 검증으로 반드시 확인하세요.');
      confidence = 'low';
    } else if (fromPortfolio?.match === 'fuzzy') {
      confidence = 'low';
    } else if (sectorGuess && !fromPortfolio?.sector?.trim()) {
      confidence = 'medium';
    } else if (!(resolvedName ?? nameIn).trim()) {
      confidence = 'medium';
    } else {
      confidence = 'high';
    }
  }

  if (sector && sectorGuess && !fromPortfolio?.sector?.trim()) {
    warnings.push('섹터는 확정값이 아니라 추천값입니다.');
  }

  return {
    ok: true,
    suggestion: {
      market,
      symbol: symbolIn || normalizedSymbol,
      normalizedSymbol,
      name: resolvedName,
      googleTicker,
      quoteSymbol,
      sector: sector || undefined,
      confidence,
      reasons,
      warnings,
    },
  };
}
