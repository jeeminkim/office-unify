import { describe, expect, it, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  logOpsEvent: vi.fn(),
  upsertOpsEventByFingerprint: vi.fn(),
  fetchResearchReportDiff: vi.fn(),
  listPendingRecommendations: vi.fn(),
  runSqlReadinessCheckWithSupabase: vi.fn(),
  getServiceSupabase: vi.fn(),
}));

vi.mock('@/lib/server/persona-chat-auth', () => ({
  requirePersonaChatAuth: vi.fn(async () => ({ ok: true as const, userKey: 'u-test' })),
}));

vi.mock('@/lib/server/supabase-service', () => ({
  getServiceSupabase: hoisted.getServiceSupabase,
}));

vi.mock('@/lib/server/opsEventLogger', () => ({
  logOpsEvent: hoisted.logOpsEvent,
}));

vi.mock('@/lib/server/upsertOpsEventByFingerprint', () => ({
  upsertOpsEventByFingerprint: hoisted.upsertOpsEventByFingerprint,
}));

vi.mock('@/lib/server/researchReportHistoryStore', () => ({
  fetchResearchReportDiff: hoisted.fetchResearchReportDiff,
}));

vi.mock('@/lib/server/watchlistRecommendationService', () => ({
  listPendingRecommendations: hoisted.listPendingRecommendations,
}));

vi.mock('@/lib/server/sqlReadinessCheck', () => ({
  runSqlReadinessCheckWithSupabase: hoisted.runSqlReadinessCheckWithSupabase,
}));

vi.mock('@/lib/server/sectorRadarSummaryService', () => ({
  buildSectorRadarSummaryForUser: vi.fn(async () => ({
    ok: true,
    degraded: false,
    generatedAt: new Date().toISOString(),
    sectors: [],
    warnings: [],
    fearCandidatesTop3: [],
    greedCandidatesTop3: [],
  })),
}));

function resetWriteMocks() {
  hoisted.logOpsEvent.mockReset();
  hoisted.logOpsEvent.mockResolvedValue(undefined);
  hoisted.upsertOpsEventByFingerprint.mockReset();
  hoisted.upsertOpsEventByFingerprint.mockResolvedValue(undefined);
}

function expectNoWrites() {
  expect(hoisted.logOpsEvent).not.toHaveBeenCalled();
  expect(hoisted.upsertOpsEventByFingerprint).not.toHaveBeenCalled();
}

describe('read-only GET route audit (no ops/DB writes)', () => {
  beforeEach(() => {
    resetWriteMocks();
    hoisted.getServiceSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    });
  });

  it('GET /api/system/sql-readiness — 0 ops writes', async () => {
    hoisted.runSqlReadinessCheckWithSupabase.mockResolvedValue({
      ok: true,
      summary: { total: 0, ready: 0, missing: 0, partial: 0, optionalMissing: 0, coreMissing: 0, recommendedMissing: 0, checkedAt: '2026-01-01T00:00:00.000Z' },
      groups: [],
      qualityMeta: { readOnly: true, checkedAt: '2026-01-01T00:00:00.000Z', source: 'postgrest_read_probe', warnings: [] },
    });
    const { GET } = await import('@/app/api/system/sql-readiness/route');
    const res = await GET();
    expect(res.ok).toBe(true);
    expectNoWrites();
  });

  it('GET /api/research-center/reports/diff — 0 ops writes', async () => {
    hoisted.fetchResearchReportDiff.mockResolvedValue({
      diff: { symbol: '028300', changed: false },
      tableMissing: false,
    });
    const { GET } = await import('@/app/api/research-center/reports/diff/route');
    const res = await GET(new Request('http://local/api/research-center/reports/diff?symbol=028300'));
    expect(res.ok).toBe(true);
    expectNoWrites();
    const j = (await res.json()) as { readOnly?: boolean };
    expect(j.readOnly).toBe(true);
  });

  it('GET /api/watchlist/recommendations — 0 ops writes', async () => {
    hoisted.listPendingRecommendations.mockResolvedValue([]);
    const { GET } = await import('@/app/api/watchlist/recommendations/route');
    const res = await GET();
    expect(res.ok).toBe(true);
    expectNoWrites();
    const j = (await res.json()) as { readOnly?: boolean };
    expect(j.readOnly).toBe(true);
  });

  it('GET /api/sector-radar/summary success — 0 ops writes', async () => {
    const { GET } = await import('@/app/api/sector-radar/summary/route');
    const res = await GET();
    expect(res.ok).toBe(true);
    expectNoWrites();
  });
});
