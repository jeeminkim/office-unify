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
  /** 서버 내부 경고 코드(snake_case 등). UI 기본 노출 금지 — displayWarnings 사용. */
  warnings: string[];
  /** 사용자용 짧은 문구(카드 하단 등). 없거나 raw가 섞이면 `getVisibleSectorRadarWarningsForSector`가 `warnings`를 변환해 사용. */
  displayWarnings?: string[];
  /** tooltip·상세용 긴 문구(displayWarnings와 동일 순서). */
  displayWarningDetails?: string[];
};

export type SectorRadarSummaryResponse = {
  ok: boolean;
  degraded?: boolean;
  generatedAt: string;
  sectors: SectorRadarSummarySector[];
  warnings: string[];
  displayWarnings?: string[];
  displayWarningDetails?: string[];
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
  displayWarnings?: string[];
  displayWarningDetails?: string[];
};
