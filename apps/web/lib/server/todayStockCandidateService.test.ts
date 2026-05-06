import { describe, expect, it } from "vitest";
import {
  buildTodayCandidatesSummaryBatchDegradedFingerprint,
  shouldLogTodayCandidatesSummaryBatchDegraded,
} from "./opsAggregateWarnings";

describe("today candidates summary aggregate logging", () => {
  it("builds stable degraded fingerprint", () => {
    const fp = buildTodayCandidatesSummaryBatchDegradedFingerprint({
      userKey: "user123",
      ymdKst: "20260507",
    });
    expect(fp).toBe("today_candidates:user123:20260507:summary_batch_degraded");
  });

  it("detects severe no-data degraded state", () => {
    const shouldLog = shouldLogTodayCandidatesSummaryBatchDegraded({
      usMarketDataAvailable: false,
      userContextCount: 0,
      usMarketKrCount: 0,
      lowConfidenceCount: 0,
      veryLowConfidenceCount: 0,
      totalCount: 0,
    });
    expect(shouldLog).toBe(true);
  });

  it("detects all-low confidence candidate batch", () => {
    const shouldLog = shouldLogTodayCandidatesSummaryBatchDegraded({
      usMarketDataAvailable: true,
      userContextCount: 1,
      usMarketKrCount: 2,
      lowConfidenceCount: 2,
      veryLowConfidenceCount: 1,
      totalCount: 3,
    });
    expect(shouldLog).toBe(true);
  });
});
