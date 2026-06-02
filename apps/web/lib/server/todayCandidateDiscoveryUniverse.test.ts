import { describe, expect, it } from 'vitest';
import { buildTodayCandidateDiscoveryUniverse } from './todayCandidateDiscoveryUniverse';

describe('todayCandidateDiscoveryUniverse', () => {
  it('builds a read-only KR/US discovery universe from interest themes', () => {
    const out = buildTodayCandidateDiscoveryUniverse({
      holdings: [],
      watchlist: [],
      maxCandidates: 10,
    });
    expect(out.diagnostics.writeAction).toBe(false);
    expect(out.diagnostics.generatedCount).toBeGreaterThan(0);
    expect(out.diagnostics.resolvedCount).toBeGreaterThan(0);
    expect(out.diagnostics.krCount).toBeGreaterThan(0);
    expect(out.diagnostics.usCount).toBeGreaterThan(0);
    expect(out.diagnostics.topThemes).toEqual(
      expect.arrayContaining(['AI 인프라', '방산', '항공', '여름 시즌/휴가 시즌 콘텐츠', '미디어/팬덤/스포츠']),
    );
    expect(out.candidates.some((c) => c.symbol === 'US:NVDA' || c.symbol === 'US:PLTR')).toBe(true);
    expect(JSON.stringify(out)).not.toMatch(/매수|매도|자동\s*주문|자동\s*리밸런싱/);
  });

  it('keeps low-confidence ETF/theme name seeds out of the candidate pool and in diagnostics', () => {
    const out = buildTodayCandidateDiscoveryUniverse({
      holdings: [],
      watchlist: [],
      maxCandidates: 50,
    });
    expect(out.candidates.some((c) => c.name.includes('현대차고정피지컬AI'))).toBe(false);
    expect(out.diagnostics.unresolvedNames).toEqual(
      expect.arrayContaining([
        'RISE 현대차고정피지컬AI ETF',
        'TIGER 코리아AI전력기기TOP3플러스',
        'KODEX AI반도체핵심장비',
      ]),
    );
  });
});
