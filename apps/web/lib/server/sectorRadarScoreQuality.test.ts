import { describe, expect, it } from "vitest";
import {
  SECTOR_RADAR_SCORE_WARNING_CODES,
  sectorRadarOpsCodesForQuality,
} from "../sectorRadarScoreExplanation";

describe("sector radar score warning policies", () => {
  it("includes no_data and quote coverage warnings for weak coverage", () => {
    const codes = sectorRadarOpsCodesForQuality({
      quality: {
        sampleCount: 5,
        quoteOkCount: 1,
        quoteMissingCount: 4,
        quoteCoverageRatio: 0.2,
        dataReliability: "very_low",
        confidencePenalty: -10,
        warnings: [],
      },
      temperature: "NO_DATA",
    });
    expect(codes).toContain(SECTOR_RADAR_SCORE_WARNING_CODES.SCORE_NO_DATA);
    expect(codes).toContain(SECTOR_RADAR_SCORE_WARNING_CODES.SCORE_QUOTE_COVERAGE_LOW);
    expect(codes).toContain(SECTOR_RADAR_SCORE_WARNING_CODES.SCORE_VERY_LOW_CONFIDENCE);
  });

  it("includes overheated warning when temperature is 과열", () => {
    const codes = sectorRadarOpsCodesForQuality({
      quality: {
        sampleCount: 5,
        quoteOkCount: 5,
        quoteMissingCount: 0,
        quoteCoverageRatio: 1,
        dataReliability: "high",
        confidencePenalty: 0,
        warnings: [],
      },
      temperature: "과열",
    });
    expect(codes).toContain(SECTOR_RADAR_SCORE_WARNING_CODES.SCORE_OVERHEATED);
  });
});
