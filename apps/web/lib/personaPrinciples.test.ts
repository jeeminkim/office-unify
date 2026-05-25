import { describe, expect, it } from "vitest";
import {
  buildActionBoundaryKo,
  buildCheckDoNotDoNextChecksInstructionKo,
  buildNoTradeCaveatKo,
  containsForbiddenPersonaPhrase,
  containsUnsafeDirective,
  isSafeNegatedCaveat,
  summarizePersonaPrincipleCoverage,
} from "@/lib/personaPrinciples";

describe("personaPrinciples", () => {
  it("allows safe negated Korean caveats", () => {
    expect(isSafeNegatedCaveat("자동 주문은 실행되지 않습니다")).toBe(true);
    expect(containsUnsafeDirective("자동 주문은 실행되지 않습니다")).toBe(false);
    expect(isSafeNegatedCaveat("자동매매를 하지 않습니다")).toBe(true);
    expect(containsUnsafeDirective("자동매매를 하지 않습니다")).toBe(false);
    expect(isSafeNegatedCaveat("매수 추천이 아닙니다")).toBe(true);
    expect(containsUnsafeDirective("매수 추천이 아닙니다")).toBe(false);
  });

  it("detects unsafe Korean directives", () => {
    expect(containsUnsafeDirective("지금 매수하세요")).toBe(true);
    expect(containsUnsafeDirective("반드시 사세요")).toBe(true);
    expect(containsUnsafeDirective("수익을 보장합니다")).toBe(true);
  });

  it("detects English directives and allows negated caveats", () => {
    expect(containsUnsafeDirective("buy now")).toBe(true);
    expect(containsUnsafeDirective("automatic trading is not supported")).toBe(false);
    expect(isSafeNegatedCaveat("automatic trading is not supported")).toBe(true);
    expect(containsUnsafeDirective("auto rebalance this portfolio")).toBe(true);
  });

  it("handles mixed sentences sentence-by-sentence", () => {
    expect(containsUnsafeDirective("자동 주문은 실행되지 않습니다. But buy now.")).toBe(true);
    expect(containsForbiddenPersonaPhrase("점검용이며 guaranteed profit은 금지입니다")).toBe(true);
  });

  it("builds reusable principle snippets", () => {
    expect(buildNoTradeCaveatKo()).toContain("매수/매도 지시가 아니라");
    expect(buildActionBoundaryKo()).toContain("자동매매");
    expect(buildCheckDoNotDoNextChecksInstructionKo()).toContain("확인할 것");
  });

  it("summarizes principle coverage without touching API shapes", () => {
    expect(
      summarizePersonaPrincipleCoverage({
        hasNoTradeCaveat: true,
        hasNoAutoExecution: true,
        hasCheckDoNotDoNextChecks: false,
      }),
    ).toEqual({
      status: "partial",
      missing: ["check_do_not_do_next_checks", "personalization_context", "action_bridge"],
    });
  });
});
