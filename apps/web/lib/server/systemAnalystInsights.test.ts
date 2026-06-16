import { describe, expect, it } from 'vitest';
import { buildSystemAnalystDataCoverage, buildSystemAnalystInsights, buildSystemAnalystRecommendations } from './systemAnalystInsights';

describe('buildSystemAnalystInsights', () => {
  it('always includes transparent sources and evidence', () => {
    const insights = buildSystemAnalystInsights({
      opsEventsSummary: { openErrors: 1 },
      sqlReadinessSummary: { missing: 1 },
      runbookStatus: { status: 'partial' },
      qualityMetaSnapshots: [{ todayCandidates: { status: 'degraded' } }],
      mobileUxSignals: [{ area: 'home' }],
    });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.evidence.length).toBeGreaterThan(0);
      expect(insight.sourceTypes.length).toBeGreaterThan(0);
      expect(insight.userPain).not.toBe('그냥 개선이 필요합니다');
    }
  });

  it('marks missing data honestly and keeps recommendations read-only', () => {
    const coverage = buildSystemAnalystDataCoverage({
      mobileUxSignals: [{ area: 'home' }],
      pbMemorySignals: [{ theme: 'AI 전력' }],
    });
    expect(coverage.find((item) => item.sourceType === 'runbook_result')?.status).toBe('missing');
    expect(coverage.find((item) => item.sourceType === 'screen_flow')?.limitation).toContain('클릭률');
    expect(coverage.find((item) => item.sourceType === 'pb_memory')?.limitation).toContain('과도하게 사용하지');
    const recommendations = buildSystemAnalystRecommendations(buildSystemAnalystInsights({ mobileUxSignals: [{}] }));
    expect(recommendations[0].writeAction).toBe(false);
    expect(JSON.stringify(recommendations)).not.toMatch(/매수|매도/);
  });
});
