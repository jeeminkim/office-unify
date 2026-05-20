import { describe, expect, it } from "vitest";
import { parseTodayBriefRouteRequest } from "./todayBriefRouteRequest";

const NOW = new Date("2026-05-20T03:04:05.000Z");

describe("todayBriefRouteRequest", () => {
  it("uses safe defaults for a plain route call", () => {
    const out = parseTodayBriefRouteRequest(undefined, NOW);
    expect(out.exposureDays).toBe(7);
    expect(out.forceRefresh).toBe(false);
    expect(out.includeDiagnostics).toBe(true);
    expect(out.requestId).toBe(`today_brief_${NOW.getTime()}`);
    expect(out.ymdKst).toMatch(/^\d{8}$/);
  });

  it("preserves x-request-id ahead of query requestId", () => {
    const req = new Request("http://localhost/api/dashboard/today-brief?requestId=query-id", {
      headers: { "x-request-id": "header-id" },
    });
    expect(parseTodayBriefRouteRequest(req, NOW).requestId).toBe("header-id");
  });

  it("parses query options with bounded fallbacks", () => {
    const req = new Request(
      "http://localhost/api/dashboard/today-brief?days=99&forceRefresh=1&includeDiagnostics=false",
    );
    const out = parseTodayBriefRouteRequest(req, NOW);
    expect(out.exposureDays).toBe(30);
    expect(out.forceRefresh).toBe(true);
    expect(out.includeDiagnostics).toBe(false);
  });

  it("falls back safely for invalid query values and performs no writes", () => {
    const req = new Request(
      "http://localhost/api/dashboard/today-brief?exposureDays=abc&forceRefresh=maybe&includeDiagnostics=maybe",
    );
    const out = parseTodayBriefRouteRequest(req, NOW);
    expect(out.exposureDays).toBe(7);
    expect(out.forceRefresh).toBe(false);
    expect(out.includeDiagnostics).toBe(true);
  });
});
