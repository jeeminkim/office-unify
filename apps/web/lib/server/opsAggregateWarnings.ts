export const OPS_AGGREGATE_WARNING_CODES = {
  SECTOR_RADAR_SUMMARY_BATCH_DEGRADED: "sector_radar_summary_batch_degraded",
  TODAY_CANDIDATES_SUMMARY_BATCH_DEGRADED: "today_candidates_summary_batch_degraded",
} as const;

export function buildSectorRadarSummaryBatchDegradedFingerprint(input: {
  userKey: string;
  ymdKst: string;
}): string {
  return `sector_radar:${input.userKey}:${input.ymdKst}:summary_batch_degraded`;
}

export function buildTodayCandidatesSummaryBatchDegradedFingerprint(input: {
  userKey: string;
  ymdKst: string;
}): string {
  return `today_candidates:${input.userKey}:${input.ymdKst}:summary_batch_degraded`;
}

export function shouldLogSectorRadarSummaryBatchDegraded(input: {
  noDataCount: number;
  quoteMissingSectors: number;
  veryLowConfidenceCount: number;
}): boolean {
  return (
    input.noDataCount >= 3 ||
    input.quoteMissingSectors >= 3 ||
    input.veryLowConfidenceCount >= 3
  );
}

export function shouldLogTodayCandidatesSummaryBatchDegraded(input: {
  usMarketDataAvailable: boolean;
  userContextCount: number;
  usMarketKrCount: number;
  lowConfidenceCount: number;
  veryLowConfidenceCount: number;
  totalCount: number;
}): boolean {
  if (!input.usMarketDataAvailable && input.userContextCount === 0 && input.usMarketKrCount === 0) {
    return true;
  }
  if (input.totalCount <= 0) return false;
  return input.lowConfidenceCount + input.veryLowConfidenceCount >= input.totalCount;
}
