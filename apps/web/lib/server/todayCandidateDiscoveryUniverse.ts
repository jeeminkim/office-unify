import 'server-only';

import type { TodayStockCandidate } from '@/lib/todayCandidatesContract';
import { resolveWatchlistInstrument } from '@/lib/server/watchlistInstrumentResolve';

type ExistingInstrument = {
  market: string;
  symbol: string;
  name: string;
  sector?: string | null;
  google_ticker?: string | null;
  quote_symbol?: string | null;
};

export type DiscoveryUniverseDiagnostics = {
  status: 'ok' | 'partial' | 'empty' | 'degraded';
  generatedCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  krCount: number;
  usCount: number;
  topThemes: string[];
  unresolvedNames: string[];
  actionHint: string;
  writeAction: false;
};

const DISCOVERY_THEME_SEEDS: Array<{ theme: string; names: string[] }> = [
  { theme: 'AI 인프라', names: ['NVIDIA', 'ServiceNow', 'Palantir', 'SK하이닉스'] },
  { theme: '전력기기', names: ['LS', '일진전기', 'TIGER 코리아AI전력기기TOP3플러스'] },
  { theme: '데이터센터', names: ['Microsoft', 'NVIDIA', '삼성전자'] },
  { theme: '로봇', names: ['RISE 현대차고정피지컬AI ETF'] },
  { theme: '반도체 장비', names: ['SK하이닉스', '삼성전자', 'SMH', 'KODEX AI반도체핵심장비'] },
  { theme: 'K-원전', names: ['LS'] },
  { theme: '조선', names: ['한화오션'] },
  { theme: '방산', names: ['한화오션'] },
  { theme: '항공', names: ['항공 테마'] },
  { theme: '바이오', names: ['HLB', '리가켐바이오', '알테오젠', '파마리서치', '메지온'] },
  { theme: '콘텐츠/엔터', names: ['Netflix'] },
  { theme: '여름 시즌/휴가 시즌 콘텐츠', names: ['Netflix'] },
  { theme: '미디어/팬덤/스포츠', names: ['Netflix'] },
];

function scoreForMarket(market: string, idx: number): number {
  const base = market === 'US' ? 59 : 57;
  return Math.max(35, base - idx * 2);
}

function candidateFromResolve(input: {
  name: string;
  theme: string;
  index: number;
  resolved: NonNullable<ReturnType<typeof resolveWatchlistInstrument>['bestCandidate']>;
  alreadyInWatchlist: boolean;
}): TodayStockCandidate | null {
  const r = input.resolved;
  if (r.symbol === 'UNKNOWN' || r.confidence === 'low') return null;
  const isKr = r.market === 'KR';
  const isUs = r.market === 'US' || r.market === 'ETF';
  if (!isKr && !isUs) return null;
  const score = scoreForMarket(isUs ? 'US' : 'KR', input.index);
  return {
    candidateId: `discovery-${isKr ? 'KR' : 'US'}-${r.symbol}`,
    name: r.name,
    market: isKr ? (r.exchange === 'KOSDAQ' ? 'KOSDAQ' : 'KOSPI') : 'US',
    country: isKr ? 'KR' : 'US',
    symbol: `${isKr ? 'KR' : 'US'}:${r.symbol}`,
    stockCode: isKr ? r.stockCode ?? r.symbol : r.ticker ?? r.symbol,
    googleTicker: r.googleTicker,
    quoteSymbol: r.quoteSymbol,
    sector: r.sector ?? input.theme,
    source: 'trend_memory',
    score,
    confidence: r.confidence === 'high' ? 'medium' : 'low',
    riskLevel: 'medium',
    reasonSummary: `${input.theme} 관심 분야에서 resolve된 관찰 후보입니다.`,
    reasonDetails: [
      `입력 seed: ${input.name}`,
      `resolve source: ${r.sourceRefs.map((ref) => ref.source).join(', ') || 'registry'}`,
      '관심종목 자동 등록이나 후보 강제 편입은 수행하지 않습니다.',
    ],
    positiveSignals: [input.theme, 'discovery universe'],
    cautionNotes: ['관찰 후보이며 거래 실행 지시가 아닙니다.', '시세와 매핑 품질을 추가 확인해야 합니다.'],
    relatedUserContext: [input.theme],
    relatedWatchlistSymbols: [],
    isBuyRecommendation: false,
    alreadyInWatchlist: input.alreadyInWatchlist,
    scoreBreakdown: {
      baseScore: score,
      watchlistBoost: 0,
      sectorBoost: 0,
      usSignalBoost: 0,
      quoteQualityPenalty: r.googleTicker ? 0 : 10,
      repeatExposurePenalty: 0,
      corporateActionPenalty: 0,
      riskPenalty: 0,
      finalScore: r.googleTicker ? score : Math.max(0, score - 10),
    },
    dataQuality: {
      overall: r.googleTicker ? 'medium' : 'low',
      badges: ['Discovery Universe', isKr ? 'KR resolved' : 'US resolved'],
      reasons: [r.matchReason ?? 'Resolved from read-only ticker registry.'],
      warnings: r.warnings ?? [],
      quoteReady: Boolean(r.googleTicker || r.quoteSymbol),
      sectorConfidence: 'medium',
      usMarketDataAvailable: isUs,
    },
  };
}

export function buildTodayCandidateDiscoveryUniverse(input: {
  holdings: ExistingInstrument[];
  watchlist: ExistingInstrument[];
  maxCandidates?: number;
}): { candidates: TodayStockCandidate[]; diagnostics: DiscoveryUniverseDiagnostics } {
  const candidates: TodayStockCandidate[] = [];
  const unresolvedNames: string[] = [];
  const seen = new Set<string>();
  const topThemes = DISCOVERY_THEME_SEEDS.slice(0, 13).map((x) => x.theme);
  let generatedCount = 0;

  for (const theme of DISCOVERY_THEME_SEEDS) {
    for (const name of theme.names) {
      generatedCount += 1;
      const resolved = resolveWatchlistInstrument({
        query: name,
        marketHint: 'AUTO',
        holdings: input.holdings,
        watchlist: input.watchlist,
      });
      const best = resolved.bestCandidate;
      if (!best || resolved.status === 'not_found') {
        unresolvedNames.push(name);
        continue;
      }
      const alreadyInWatchlist = input.watchlist.some(
        (w) => w.market.toUpperCase() === best.market && w.symbol.toUpperCase() === best.symbol.toUpperCase(),
      );
      const candidate = candidateFromResolve({
        name,
        theme: theme.theme,
        index: candidates.length,
        resolved: best,
        alreadyInWatchlist,
      });
      if (!candidate) {
        unresolvedNames.push(name);
        continue;
      }
      if (seen.has(candidate.candidateId)) continue;
      seen.add(candidate.candidateId);
      candidates.push(candidate);
      if (candidates.length >= (input.maxCandidates ?? 8)) break;
    }
    if (candidates.length >= (input.maxCandidates ?? 8)) break;
  }

  const krCount = candidates.filter((c) => c.country === 'KR').length;
  const usCount = candidates.filter((c) => c.country === 'US').length;
  const unresolvedCount = unresolvedNames.length;
  const status: DiscoveryUniverseDiagnostics['status'] =
    candidates.length === 0 ? 'empty' : unresolvedCount > 0 ? 'partial' : 'ok';

  return {
    candidates,
    diagnostics: {
      status,
      generatedCount,
      resolvedCount: candidates.length,
      unresolvedCount,
      krCount,
      usCount,
      topThemes,
      unresolvedNames: Array.from(new Set(unresolvedNames)).slice(0, 12),
      actionHint:
        candidates.length > 0
          ? 'Discovery Universe는 watchlist가 아니며 자동 등록하지 않습니다. resolve된 이름만 관찰 후보 pool에 더합니다.'
          : '관심 분야 seed를 종목/ticker로 충분히 resolve하지 못했습니다. Smart Ticker Resolve 또는 수동 code/ticker 확인이 필요합니다.',
      writeAction: false,
    },
  };
}
