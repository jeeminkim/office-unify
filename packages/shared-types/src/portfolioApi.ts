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
