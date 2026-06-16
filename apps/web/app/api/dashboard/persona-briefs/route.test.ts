import { describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  countOpsEventsOpenError: vi.fn(),
  listActionItemsForUser: vi.fn(),
}));

vi.mock('@/lib/server/persona-chat-auth', () => ({
  requirePersonaChatAuth: vi.fn(async () => ({ ok: true as const, userKey: 'u-test' })),
}));

vi.mock('@/lib/server/supabase-service', () => ({
  getServiceSupabase: vi.fn(() => ({ from: hoisted.from })),
}));

vi.mock('@office-unify/supabase-access', () => ({
  countOpsEventsOpenError: hoisted.countOpsEventsOpenError,
  listActionItemsForUser: hoisted.listActionItemsForUser,
}));

function makeSelect(data: unknown[]) {
  const terminal = { limit: vi.fn(async () => ({ data, error: null })) };
  const afterEq = { order: vi.fn(() => terminal), limit: terminal.limit };
  const eq = { eq: vi.fn(() => afterEq) };
  return { select: vi.fn(() => eq), insert: hoisted.insert, update: hoisted.update, upsert: hoisted.upsert };
}

describe('GET /api/dashboard/persona-briefs', () => {
  it('returns daily loop data read-only and filters PB conversations by KST date', async () => {
    hoisted.countOpsEventsOpenError.mockResolvedValue(0);
    hoisted.listActionItemsForUser.mockResolvedValue([]);
    hoisted.from.mockImplementation((table: string) => {
      if (table === 'pb_daily_conversations') {
        return makeSelect([
          {
            id: 'today',
            created_at: '2026-06-15T15:30:00.000Z',
            summary_json: {
              templateType: 'daily_checkin',
              userIntent: '실적 확인 전 추가매수 여부',
              actionCategory: 'add_buy',
              symbols: ['LS'],
              themes: ['AI 전력 인프라'],
              thesisSnapshot: {},
              riskSnapshot: {},
              nextCheckpoints: ['수주 확인'],
              memoryCandidates: [],
            },
          },
          {
            id: 'yesterday',
            created_at: '2026-06-15T14:30:00.000Z',
            summary_json: {
              templateType: 'daily_checkin',
              userIntent: '전날 대화',
              actionCategory: 'review',
              symbols: ['OLD'],
              themes: ['OLD'],
              thesisSnapshot: {},
              riskSnapshot: {},
              nextCheckpoints: [],
              memoryCandidates: [],
            },
          },
        ]);
      }
      return makeSelect([]);
    });
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.ok).toBe(true);
    const json = (await res.json()) as {
      dailyConversation?: { todayDate?: string; pbCheckin?: { conversationId?: string } };
      dailyActivitySummary?: { discussedSymbols?: string[] };
      qualityMeta?: { readOnly?: boolean };
      systemAnalyst?: { dataCoverage?: Array<{ sourceType: string; status: string }> };
    };
    expect(json.qualityMeta?.readOnly).toBe(true);
    expect(json.dailyConversation?.todayDate).toBe('2026-06-16');
    expect(json.dailyConversation?.pbCheckin?.conversationId).toBe('today');
    expect(json.dailyActivitySummary?.discussedSymbols).toEqual(['LS']);
    expect(json.systemAnalyst?.dataCoverage?.some((item) => item.sourceType === 'runbook_result' && item.status === 'missing')).toBe(true);
    expect(hoisted.insert).not.toHaveBeenCalled();
    expect(hoisted.update).not.toHaveBeenCalled();
    expect(hoisted.upsert).not.toHaveBeenCalled();
  });
});
