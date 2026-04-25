/**
 * Portfolio/accounts 계열 HTTP API용 최소 DTO (DB snake_case와 분리).
 */
export type AccountSummaryDto = {
  id: string;
  accountName: string;
  accountType: string;
};

/** GET …/api/portfolio/accounts 응답 본문 */
export type PortfolioAccountsResponseBody = {
  accounts: AccountSummaryDto[];
};

/** 시세 없이 DB 행만으로 만든 최소 요약(읽기 전용 스냅샷이 아님) */
export type PortfolioSummaryDto = {
  positionCount: number;
  generatedAt: string;
};

/** GET …/api/portfolio/summary 응답 본문 */
export type PortfolioSummaryResponseBody = {
  summary: PortfolioSummaryDto;
};

/** 개인 투자 콘솔 확장 요약 응답 */
export type PortfolioSummaryEnhancedResponseBody = {
  ok: boolean;
  generatedAt: string;
  totalPositions: number;
  totalCostKrw?: number;
  totalValueKrw?: number;
  totalPnlKrw?: number;
  totalPnlRate?: number;
  cashKrw?: number;
  cashWeight?: number;
  topPositions: Array<{
    symbol: string;
    displayName?: string;
    market?: string;
    currency?: string;
    quantity?: number;
    avgPrice?: number;
    currentPrice?: number;
    valueKrw?: number;
    weight?: number;
    pnlRate?: number;
    stale?: boolean;
  }>;
  exposures?: {
    byMarket?: Array<{ key: string; valueKrw: number; weight: number }>;
    byCurrency?: Array<{ key: string; valueKrw: number; weight: number }>;
    bySector?: Array<{ key: string; valueKrw: number; weight: number }>;
  };
  warnings: Array<{
    code: string;
    severity: 'info' | 'warn' | 'danger';
    message: string;
  }>;
  dataQuality: {
    quoteAvailable: boolean;
    staleQuoteCount: number;
    missingMetadataCount: number;
    source: string;
  };
};
