import { describe, expect, it } from 'vitest';
import { getSqlReadinessRegistry } from '@/lib/server/sqlReadinessRegistry';

describe('sqlReadinessRegistry', () => {
  const registry = getSqlReadinessRegistry();

  it('has non-zero entries', () => {
    expect(registry.length).toBeGreaterThan(0);
  });

  it('includes APPLY_ORDER §8 items 17–20', () => {
    const files = registry.map((r) => r.sqlFile);
    expect(files).toContain('append_today_candidate_impressions.sql');
    expect(files).toContain('append_sector_radar_snapshots.sql');
    expect(files).toContain('append_research_report_history.sql');
    expect(files).toContain('append_watchlist_recommendation_candidates.sql');
    for (const order of [17, 18, 19, 20]) {
      const item = registry.find((r) => r.order === order);
      expect(item).toBeDefined();
      expect(item?.purpose?.length).toBeGreaterThan(0);
      expect(item?.degradedSymptoms.length).toBeGreaterThan(0);
      expect(item?.actionHint.length).toBeGreaterThan(0);
    }
  });

  it('each entry has sqlFile, purpose, degradedSymptoms, actionHint', () => {
    for (const row of registry) {
      expect(row.sqlFile).toMatch(/\.sql$/);
      expect(row.purpose.length).toBeGreaterThan(0);
      expect(row.degradedSymptoms.length).toBeGreaterThan(0);
      expect(row.actionHint.length).toBeGreaterThan(0);
    }
  });
});
