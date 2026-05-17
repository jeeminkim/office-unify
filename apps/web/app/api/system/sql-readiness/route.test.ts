import { describe, expect, it, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  runSqlReadinessCheckWithSupabase: vi.fn(),
  getServiceSupabase: vi.fn(),
}));

vi.mock('@/lib/server/persona-chat-auth', () => ({
  requirePersonaChatAuth: vi.fn(async () => ({ ok: true as const, userKey: 'u-test' })),
}));

vi.mock('@/lib/server/supabase-service', () => ({
  getServiceSupabase: hoisted.getServiceSupabase,
}));

vi.mock('@/lib/server/sqlReadinessCheck', () => ({
  runSqlReadinessCheckWithSupabase: hoisted.runSqlReadinessCheckWithSupabase,
}));

describe('GET /api/system/sql-readiness', () => {
  beforeEach(() => {
    hoisted.getServiceSupabase.mockReset();
    hoisted.runSqlReadinessCheckWithSupabase.mockReset();
  });

  it('returns read-only response without secrets', async () => {
    hoisted.getServiceSupabase.mockReturnValue({});
    hoisted.runSqlReadinessCheckWithSupabase.mockResolvedValue({
      ok: true,
      summary: {
        total: 2,
        ready: 2,
        missing: 0,
        partial: 0,
        optionalMissing: 0,
        coreMissing: 0,
        recommendedMissing: 0,
        checkedAt: '2026-01-01T00:00:00.000Z',
      },
      groups: [],
      qualityMeta: {
        readOnly: true,
        checkedAt: '2026-01-01T00:00:00.000Z',
        source: 'postgrest_read_probe',
        warnings: [],
      },
    });

    const { GET } = await import('./route');
    const res = await GET();
    const text = await res.text();
    expect(text).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|sk-[a-zA-Z0-9]/);
    const j = JSON.parse(text) as { qualityMeta?: { readOnly?: boolean } };
    expect(j.qualityMeta?.readOnly).toBe(true);
  });
});
