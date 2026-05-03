import 'server-only';

import type { WebPortfolioWatchlistRow } from '@office-unify/supabase-access';

export type SectorRadarAnchorSeed = {
  symbol: string;
  name: string;
  sourceLabel: 'seed';
};

export type SectorRadarCategorySeed = {
  key: string;
  name: string;
  /** 관심종목 sector/메모 키워드와 매칭 (소문자 비교) */
  keywords: string[];
  anchors: SectorRadarAnchorSeed[];
};

export const SECTOR_RADAR_SHEET_NAME = process.env.SECTOR_RADAR_QUOTES_SHEET_NAME?.trim() || 'sector_radar_quotes';

/** 운영 중 수정 가능한 seed. 잘못된 티커는 시트 read-back에서 NO_DATA 처리. */
export const SECTOR_RADAR_CATEGORY_SEEDS: SectorRadarCategorySeed[] = [
  {
    key: 'semiconductor',
    name: '반도체',
    keywords: ['반도체', 'semiconductor', 'chip', '메모리'],
    anchors: [
      { symbol: '091160', name: 'KODEX 반도체', sourceLabel: 'seed' },
      { symbol: '381180', name: 'TIGER 미국필라델피아반도체나스닥', sourceLabel: 'seed' },
      { symbol: '396500', name: 'TIGER Fn반도체TOP10', sourceLabel: 'seed' },
    ],
  },
  {
    key: 'battery',
    name: '2차전지/배터리',
    keywords: ['2차전지', '배터리', 'battery', 'ev'],
    anchors: [
      { symbol: '305540', name: 'TIGER 2차전지테마', sourceLabel: 'seed' },
      { symbol: '364980', name: 'TIGER 2차전지TOP10', sourceLabel: 'seed' },
      { symbol: '462010', name: 'TIGER 2차전지소재Fn', sourceLabel: 'seed' },
    ],
  },
  {
    key: 'bio',
    name: '바이오/헬스케어',
    keywords: ['바이오', '헬스', 'bio', 'health', '제약'],
    anchors: [
      { symbol: '364970', name: 'TIGER 바이오TOP10', sourceLabel: 'seed' },
      { symbol: '266420', name: 'KODEX 헬스케어', sourceLabel: 'seed' },
      { symbol: '143860', name: 'TIGER 헬스케어', sourceLabel: 'seed' },
    ],
  },
  {
    key: 'nuclear_energy',
    name: '원전/SMR/에너지',
    keywords: ['원전', 'smr', '원자력', '에너지', 'nuclear'],
    anchors: [
      { symbol: '434730', name: 'HANARO 원자력iSelect', sourceLabel: 'seed' },
      { symbol: '433500', name: 'ACE 원자력테마딥서치', sourceLabel: 'seed' },
      { symbol: '442320', name: 'KODEX K-원자력액티브', sourceLabel: 'seed' },
    ],
  },
  {
    key: 'ai_power_infra',
    name: 'AI/전력인프라',
    keywords: ['ai', '전력', '인프라', '데이터센터', '인공지능'],
    anchors: [
      { symbol: '456600', name: 'TIMEFOLIO 글로벌AI인공지능액티브', sourceLabel: 'seed' },
      { symbol: '466920', name: 'SOL 조선TOP3플러스', sourceLabel: 'seed' },
    ],
  },
  {
    key: 'us_growth',
    name: '미국 성장/나스닥',
    keywords: ['나스닥', 's&p', '미국', 'nasdaq', 'sp500'],
    anchors: [
      { symbol: '133690', name: 'TIGER 미국나스닥100', sourceLabel: 'seed' },
      { symbol: '379810', name: 'KODEX 미국나스닥100TR', sourceLabel: 'seed' },
      { symbol: '360750', name: 'TIGER 미국S&P500', sourceLabel: 'seed' },
    ],
  },
  {
    key: 'crypto_infra',
    name: '코인/디지털자산 인프라',
    keywords: ['코인', 'crypto', '비트', '디지털자산', '블록체인'],
    anchors: [],
  },
  {
    key: 'defense_space',
    name: '방산/우주항공',
    keywords: ['방산', '우주', '항공', 'defense'],
    anchors: [
      { symbol: '449450', name: 'PLUS K방산', sourceLabel: 'seed' },
      { symbol: '463280', name: 'TIGER 우주방산', sourceLabel: 'seed' },
      { symbol: '442550', name: 'KODEX K-방산', sourceLabel: 'seed' },
    ],
  },
  {
    key: 'shipping',
    name: '조선/해운',
    keywords: ['조선', '해운', 'shipping', '해양'],
    anchors: [
      { symbol: '466920', name: 'SOL 조선TOP3플러스', sourceLabel: 'seed' },
      { symbol: '494670', name: 'TIGER 조선TOP10', sourceLabel: 'seed' },
      { symbol: '441540', name: 'HANARO Fn조선해운', sourceLabel: 'seed' },
    ],
  },
  {
    key: 'k_content',
    name: 'K-콘텐츠/미디어',
    keywords: ['콘텐츠', '미디어', '엔터', 'media', 'entertainment'],
    anchors: [
      { symbol: '228810', name: 'TIGER 미디어컨텐츠', sourceLabel: 'seed' },
      { symbol: '266360', name: 'KODEX 미디어&엔터테인먼트', sourceLabel: 'seed' },
      { symbol: '367770', name: 'RISE Fn컨택트대표', sourceLabel: 'seed' },
    ],
  },
];

export type MergedSectorRadarAnchor = {
  categoryKey: string;
  categoryName: string;
  symbol: string;
  name: string;
  googleTicker: string;
  sourceLabel: 'seed' | 'watchlist';
};

function padKrSymbol(symbol: string): string {
  const t = symbol.trim().toUpperCase();
  if (/^\d+$/.test(t)) return t.padStart(6, '0');
  return t;
}

function defaultGoogleTickerKr(symbol: string): string {
  return `KRX:${padKrSymbol(symbol)}`;
}

function watchlistTextBlob(row: WebPortfolioWatchlistRow): string {
  return [
    row.sector ?? '',
    row.name ?? '',
    row.investment_memo ?? '',
    row.interest_reason ?? '',
    row.observation_points ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

function categoryMatch(category: SectorRadarCategorySeed, blob: string): boolean {
  return category.keywords.some((k) => blob.includes(k.toLowerCase()));
}

/**
 * seed registry + KR 관심종목 중 키워드 매칭으로 custom anchor 병합.
 * 동일 category+symbol 은 한 번만 유지.
 */
export function buildMergedSectorRadarAnchors(watchlist: WebPortfolioWatchlistRow[]): MergedSectorRadarAnchor[] {
  const seen = new Set<string>();
  const out: MergedSectorRadarAnchor[] = [];

  const push = (row: MergedSectorRadarAnchor) => {
    const key = `${row.categoryKey}:${padKrSymbol(row.symbol)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  for (const cat of SECTOR_RADAR_CATEGORY_SEEDS) {
    for (const a of cat.anchors) {
      push({
        categoryKey: cat.key,
        categoryName: cat.name,
        symbol: padKrSymbol(a.symbol),
        name: a.name,
        googleTicker: defaultGoogleTickerKr(a.symbol),
        sourceLabel: 'seed',
      });
    }
  }

  for (const w of watchlist) {
    if (w.market !== 'KR') continue;
    const sym = padKrSymbol(w.symbol);
    if (!/^\d{6}$/.test(sym)) continue;
    const blob = watchlistTextBlob(w);
    const ticker = (w.google_ticker?.trim() || defaultGoogleTickerKr(sym)).toUpperCase();

    for (const cat of SECTOR_RADAR_CATEGORY_SEEDS) {
      if (!categoryMatch(cat, blob)) continue;
      push({
        categoryKey: cat.key,
        categoryName: cat.name,
        symbol: sym,
        name: (w.name ?? sym).trim() || sym,
        googleTicker: ticker,
        sourceLabel: 'watchlist',
      });
    }
  }

  return out;
}
