import { describe, expect, it } from "vitest";
import { isDuplicateWatchlistCandidate } from "./watchlistCandidateUtils";

describe("watchlist duplicate detection", () => {
  const rows = [
    {
      market: "KR",
      symbol: "005930",
      name: "삼성전자",
      google_ticker: "KRX:005930",
      quote_symbol: "005930.KS",
      sector: null,
      investment_memo: null,
      interest_reason: null,
      desired_buy_range: null,
      observation_points: null,
      priority: null,
    },
  ] as never;

  it("detects duplicate by stockCode and ticker", () => {
    expect(isDuplicateWatchlistCandidate(rows, { market: "KR", stockCode: "005930", name: "삼성전자" })).toBe(true);
    expect(isDuplicateWatchlistCandidate(rows, { market: "KR", googleTicker: "KRX:005930", name: "삼성전자" })).toBe(true);
    expect(isDuplicateWatchlistCandidate(rows, { market: "KR", quoteSymbol: "005930.KS", name: "삼성전자" })).toBe(true);
  });
});
