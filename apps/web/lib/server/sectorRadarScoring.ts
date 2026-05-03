import 'server-only';

import type {
  SectorRadarActionHint,
  SectorRadarAnchorDataStatus,
  SectorRadarSummaryAnchor,
  SectorRadarSummarySector,
  SectorRadarZone,
} from '@/lib/sectorRadarContract';

export type AnchorMetricRow = {
  symbol: string;
  name: string;
  googleTicker: string;
  sourceLabel: 'seed' | 'watchlist';
  changePct?: number;
  price?: number;
  volume?: number;
  high52?: number;
  low52?: number;
  volumeAvg?: number;
  dataStatus: SectorRadarAnchorDataStatus;
};

function zoneFromScore(score: number): SectorRadarZone {
  if (score <= 24) return 'extreme_fear';
  if (score <= 39) return 'fear';
  if (score <= 59) return 'neutral';
  if (score <= 74) return 'greed';
  return 'extreme_greed';
}

function actionHintFromZone(zone: SectorRadarZone): SectorRadarActionHint {
  switch (zone) {
    case 'extreme_fear':
      return 'buy_watch';
    case 'fear':
      return 'accumulate';
    case 'neutral':
      return 'hold';
    case 'greed':
      return 'trim_watch';
    case 'extreme_greed':
      return 'avoid_chase';
    default:
      return 'no_data';
  }
}

function narrativeFor(hint: SectorRadarActionHint): string {
  switch (hint) {
    case 'buy_watch':
      return '극단적 조정 구간으로 보입니다. 분할매수 검토·관찰 후보이며, 자동 매수 신호가 아닙니다.';
    case 'accumulate':
      return '조정 구간에 가깝습니다. 분할매수 검토를 고려하되, 판단은 본인 책임입니다.';
    case 'hold':
      return '중립 구간입니다. 관망·리밸런싱 여부만 점검하세요.';
    case 'trim_watch':
      return '과열에 가깝습니다. 비중 축소·분할매도 검토를 고려하세요.';
    case 'avoid_chase':
      return '과열 구간에 가깝습니다. 추격매수 주의, 비중 축소 검토를 권장합니다.';
    default:
      return '데이터가 부족해 온도를 계산하지 못했습니다. 시트 새로고침 후 30~90초 뒤 다시 확인하세요.';
  }
}

function momentumPointsFromChangePct(changePct: number | undefined): number | undefined {
  if (changePct == null || !Number.isFinite(changePct)) return undefined;
  if (changePct > 3) return 28;
  if (changePct > 0) return 20;
  if (changePct > -3) return 12;
  return 5;
}

function rangePosition(price?: number, high52?: number, low52?: number): number | undefined {
  if (price == null || high52 == null || low52 == null) return undefined;
  if (!Number.isFinite(price) || !Number.isFinite(high52) || !Number.isFinite(low52)) return undefined;
  const span = high52 - low52;
  if (span <= 0) return undefined;
  const p = (price - low52) / span;
  if (!Number.isFinite(p)) return undefined;
  return Math.min(1, Math.max(0, p));
}

function classifyDataStatus(
  raw: string | undefined,
  parsed: number | undefined,
  optional = false,
): SectorRadarAnchorDataStatus {
  if (parsed != null && Number.isFinite(parsed)) return 'ok';
  const r = (raw ?? '').trim();
  if (!r) return optional ? 'empty' : 'empty';
  const u = r.toUpperCase();
  if (u.includes('LOADING')) return 'pending';
  if (['#N/A', 'N/A'].includes(u)) return 'empty';
  if (u.startsWith('#')) return 'parse_failed';
  return 'pending';
}

/** 시트 raw + 파싱값으로 앵커 요약 행 생성 */
export function buildSummaryAnchors(rows: AnchorMetricRow[]): SectorRadarSummaryAnchor[] {
  return rows.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    googleTicker: r.googleTicker,
    sourceLabel: r.sourceLabel,
    price: r.price,
    volume: r.volume,
    changePct: r.changePct,
    high52: r.high52,
    low52: r.low52,
    volumeAvg: r.volumeAvg,
    dataStatus: r.dataStatus,
  }));
}

export function scoreSectorFromAnchors(
  categoryKey: string,
  categoryName: string,
  rows: AnchorMetricRow[],
): SectorRadarSummarySector {
  const warnings: string[] = [];

  if (rows.length === 0) {
    return {
      key: categoryKey,
      name: categoryName,
      zone: 'no_data',
      actionHint: 'no_data',
      narrativeHint: narrativeFor('no_data'),
      anchors: [],
      components: {},
      warnings: ['anchor_set_empty', '관심종목에 섹터 키워드가 맞는 ETF를 추가하면 custom anchor로 반영됩니다.'],
    };
  }

  const okPrice = rows.filter((r) => r.dataStatus === 'ok' && r.price != null && r.price > 0);
  if (okPrice.length === 0) {
    warnings.push('all_anchors_missing_price');
    return {
      key: categoryKey,
      name: categoryName,
      zone: 'no_data',
      actionHint: 'no_data',
      narrativeHint: narrativeFor('no_data'),
      anchors: buildSummaryAnchors(rows),
      components: {},
      warnings,
    };
  }

  const momentumPts = rows
    .map((r) => momentumPointsFromChangePct(r.changePct))
    .filter((v): v is number => v != null);
  const momentum = momentumPts.length ? momentumPts.reduce((a, b) => a + b, 0) / momentumPts.length : undefined;

  const rangePs = rows
    .map((r) => rangePosition(r.price, r.high52, r.low52))
    .filter((v): v is number => v != null);
  const avgRangeP = rangePs.length ? rangePs.reduce((a, b) => a + b, 0) / rangePs.length : undefined;

  const drawdown = avgRangeP != null ? 20 * avgRangeP : undefined;

  const trendPts = rows
    .map((r) => {
      if (r.changePct == null || !Number.isFinite(r.changePct)) return undefined;
      const t = (r.changePct + 6) / 14;
      return Math.min(20, Math.max(0, t * 20));
    })
    .filter((v): v is number => v != null);
  const trend = trendPts.length ? trendPts.reduce((a, b) => a + b, 0) / trendPts.length : 10;

  let volume: number | undefined;
  const volRatios = rows
    .map((r) => {
      if (r.volumeAvg == null || r.volumeAvg <= 0 || r.volume == null || r.volume <= 0) return undefined;
      return Math.min(2.5, r.volume / r.volumeAvg);
    })
    .filter((v): v is number => v != null);
  if (volRatios.length) {
    const avgR = volRatios.reduce((a, b) => a + b, 0) / volRatios.length;
    volume = Math.min(20, 8 * avgR);
  } else {
    volume = 10;
    warnings.push('volume_avg_unavailable_neutral_volume_score');
  }

  let risk = 10;
  const okAnchors = rows.filter((r) => r.dataStatus === 'ok');
  if (okAnchors.length < 2) risk -= 3;
  if (rows.some((r) => r.dataStatus === 'parse_failed')) risk -= 2;
  risk = Math.max(0, risk);

  const m = momentum ?? 15;
  const d = drawdown ?? 10;
  const v = volume ?? 10;
  const tr = trend;
  const score = Math.round(Math.min(100, Math.max(0, m + d + v + tr + risk)));
  const zone = zoneFromScore(score);
  const actionHint = actionHintFromZone(zone);

  return {
    key: categoryKey,
    name: categoryName,
    score,
    zone,
    actionHint,
    narrativeHint: narrativeFor(actionHint),
    anchors: buildSummaryAnchors(rows),
    components: {
      momentum,
      volume,
      drawdown,
      trend,
      risk,
    },
    warnings,
  };
}

export { classifyDataStatus };
