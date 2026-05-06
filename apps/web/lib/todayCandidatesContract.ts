export type TodayCandidateSource =
  | 'user_context'
  | 'watchlist'
  | 'sector_radar'
  | 'trend_memory'
  | 'us_market_morning'
  | 'manual_rule'
  | 'fallback';

export type TodayCandidateRiskLevel = 'low' | 'medium' | 'high' | 'unknown';

export interface TodayCandidateDataQuality {
  overall: 'high' | 'medium' | 'low' | 'very_low';
  badges: string[];
  reasons: string[];
  summary?: string;
  quoteReady?: boolean;
  sectorConfidence?: 'high' | 'medium' | 'low' | 'very_low' | 'unknown';
  usMarketDataAvailable?: boolean;
  warnings: string[];
}

export interface TodayStockCandidate {
  candidateId: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ' | 'KONEX' | 'US' | 'UNKNOWN';
  country: 'KR' | 'US' | 'UNKNOWN';
  symbol?: string;
  stockCode?: string;
  googleTicker?: string;
  quoteSymbol?: string;
  sector?: string;
  source: TodayCandidateSource;
  score: number;
  confidence: 'high' | 'medium' | 'low' | 'very_low';
  riskLevel: TodayCandidateRiskLevel;
  reasonSummary: string;
  reasonDetails: string[];
  positiveSignals: string[];
  cautionNotes: string[];
  relatedUserContext: string[];
  relatedWatchlistSymbols: string[];
  relatedUsMarketSignals?: string[];
  isBuyRecommendation: false;
  alreadyInWatchlist?: boolean;
  watchlistItemId?: string;
  dataQuality?: TodayCandidateDataQuality;
}

export interface UsMarketMorningSummary {
  asOfKst: string;
  available: boolean;
  conclusion: 'risk_on' | 'risk_off' | 'mixed' | 'sector_rotation' | 'no_data';
  summary: string;
  signals: Array<{
    signalKey: string;
    label: string;
    direction: 'positive' | 'negative' | 'mixed' | 'neutral';
    confidence: 'high' | 'medium' | 'low';
    evidence: string[];
  }>;
  warnings: string[];
}

export interface TodayBriefWithCandidatesResponse {
  ok: boolean;
  generatedAt: string;
  lines: Array<{
    title: string;
    body: string;
    severity: 'info' | 'warn' | 'danger' | 'positive';
    source: string[];
  }>;
  badges: string[];
  degraded?: boolean;
  warnings?: string[];
  candidates?: {
    userContext: TodayStockCandidate[];
    usMarketKr: TodayStockCandidate[];
  };
  usMarketSummary?: UsMarketMorningSummary;
  disclaimer?: string;
  qualityMeta?: {
    todayCandidates: {
      generatedAt: string;
      userContextCount: number;
      usMarketKrCount: number;
      usMarketDataAvailable: boolean;
      highConfidenceCount?: number;
      mediumConfidenceCount?: number;
      lowConfidenceCount?: number;
      veryLowConfidenceCount?: number;
      postProcess?: {
        successCount: number;
        partialCount: number;
        failedCount: number;
        warnings: string[];
      };
      warnings: string[];
    };
  };
}
