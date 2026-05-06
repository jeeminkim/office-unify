import { describe, expect, it } from "vitest";
import { pickRulesFromUsSummary } from "./todayCandidateRules";

describe("todayCandidateRules", () => {
  it("maps semiconductor signal to KR candidates", () => {
    const rules = pickRulesFromUsSummary({
      asOfKst: new Date().toISOString(),
      available: true,
      conclusion: "risk_on",
      summary: "ok",
      warnings: [],
      signals: [{ signalKey: "us_semiconductor_strength", label: "semi", direction: "positive", confidence: "medium", evidence: [] }],
    });
    expect(rules.length > 0).toBe(true);
    expect(rules[0]?.krCandidates.some((x) => x.stockCode === "000660")).toBe(true);
  });
});
