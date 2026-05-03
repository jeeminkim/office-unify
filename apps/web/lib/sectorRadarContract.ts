/** Sector Fear & Greed Radar — API/클라이언트 공유 계약 (서버 전용 import 불필요). */

export type SectorRadarZone =
  | "extreme_fear"
  | "fear"
  | "neutral"
  | "greed"
  | "extreme_greed"
  | "no_data";

export type SectorRadarActionHint =
  | "buy_watch"
  | "accumulate"
  | "hold"
  | "trim_watch"
  | "avoid_chase"
  | "no_data";

export type SectorRadarAnchorDataStatus = "ok" | "pending" | "empty" | "parse_failed";

export type SectorRadarSummaryAnchor = {
  symbol: string;
  name: string;
  googleTicker: string;
  sourceLabel: "seed" | "watchlist";
  price?: number;
  volume?: number;
  changePct?: number;
  high52?: number;
  low52?: number;
  volumeAvg?: number;
  dataStatus: SectorRadarAnchorDataStatus;
};

export type SectorRadarSummarySector = {
  key: string;
  name: string;
  score?: number;
  zone: SectorRadarZone;
  actionHint: SectorRadarActionHint;
  narrativeHint: string;
  anchors: SectorRadarSummaryAnchor[];
  components: {
    momentum?: number;
    volume?: number;
    drawdown?: number;
    trend?: number;
    risk?: number;
    /** crypto 전용 서브스코어(0~100 스케일 가중 평균용) */
    cryptoBtc?: number;
    cryptoAlt?: number;
    cryptoInfra?: number;
  };
  warnings: string[];
};

export type SectorRadarSummaryResponse = {
  ok: boolean;
  degraded?: boolean;
  generatedAt: string;
  sectors: SectorRadarSummarySector[];
  warnings: string[];
  fearCandidatesTop3: SectorRadarSummarySector[];
  greedCandidatesTop3: SectorRadarSummarySector[];
};

export type SectorRadarStatusRow = {
  categoryKey: string;
  market?: "KR" | "US";
  anchorSymbol: string;
  googleTicker: string;
  rawPrice?: string;
  parsedPrice?: number;
  rawVolume?: string;
  parsedVolume?: number;
  rawVolumeAvg?: string;
  parsedVolumeAvg?: number;
  rawChangePct?: string;
  parsedChangePct?: number;
  rowStatus: SectorRadarAnchorDataStatus;
  message: string;
};

/** Dossier 등에서 단일 픽 요약 (additive). */
export type PortfolioDossierRelatedSector = {
  key: string;
  name: string;
  score?: number;
  zone: SectorRadarZone;
  confidence: "low" | "medium" | "high";
  narrativeHint: string;
  anchors: SectorRadarSummaryAnchor[];
};

export type SectorRadarStatusResponse = {
  ok: boolean;
  total: number;
  okCount: number;
  pendingCount: number;
  emptyCount: number;
  rows: SectorRadarStatusRow[];
  warnings: string[];
};

export type SectorWatchlistCandidateReadinessLabel =
  | "watch_now"
  | "prepare"
  | "hold_watch"
  | "wait"
  | "no_data";

export type SectorWatchlistCandidateItem = {
  sectorKey: string;
  sectorName: string;
  sectorScore?: number;
  sectorZone: SectorRadarZone;
  symbol: string;
  market: string;
  name: string;
  priority?: string;
  interestReason?: string;
  observationPoints?: string;
  desiredBuyRange?: string;
  googleTicker?: string;
  quoteSymbol?: string;
  readinessScore: number;
  readinessLabel: SectorWatchlistCandidateReadinessLabel;
  reasons: string[];
  confidence: "low" | "medium" | "high";
};

export type SectorWatchlistCandidateResponse = {
  ok: boolean;
  generatedAt: string;
  candidates: SectorWatchlistCandidateItem[];
  warnings: string[];
};
