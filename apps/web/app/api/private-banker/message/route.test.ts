import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  runPb: vi.fn(),
}));

vi.mock('@/lib/server/persona-chat-auth', () => ({
  requirePersonaChatAuth: vi.fn(async () => ({ ok: true as const, userKey: 'u-test' })),
}));

vi.mock('@/lib/server/supabase-service', () => ({
  getServiceSupabase: vi.fn(() => ({})),
}));

vi.mock('@/lib/server/runPrivateBankerMessage', () => ({
  buildPrivateBankerContentHash: vi.fn(() => 'hash-pb-message'),
  runPrivateBankerMessageWithDbIdempotency: hoisted.runPb,
}));

vi.mock('@/lib/server/investorProfile', () => ({
  getInvestorProfileForUser: vi.fn(async () => ({ ok: true as const, profileStatus: 'missing' as const, profile: null })),
}));

vi.mock('@/lib/server/concentrationRisk', () => ({
  buildConcentrationRiskPromptSection: vi.fn(() => '(concentration)'),
  getPortfolioExposureSnapshotForUser: vi.fn(async () => ({})),
}));

vi.mock('@/lib/server/suitabilityAssessment', () => ({
  buildInvestorProfilePromptContext: vi.fn(() => '(profile)'),
}));

vi.mock('@/lib/server/investmentAssistantOutputFormat', () => ({
  normalizeInvestmentAssistantOutput: vi.fn((text: string) => ({
    text,
    quality: { formatValid: true, missingSections: [], normalized: false, warnings: [] },
  })),
}));

describe('POST /api/private-banker/message', () => {
  beforeEach(() => {
    hoisted.runPb.mockReset();
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    vi.stubEnv('GEMINI_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps PB fields and adds warning-only output contract meta', async () => {
    hoisted.runPb.mockResolvedValue({
      kind: 'ok',
      deduplicated: false,
      body: {
        userMessage: { id: 'u1', content: 'q' },
        assistantMessage: {
          id: 'a1',
          content: [
            '[정보 상태] 근거 요약',
            '[리스크 플래그] 리스크 점검',
            '[하면 안 되는 행동] 자동 주문은 실행되지 않습니다.',
            '[다음 확인 체크리스트] 공시 확인',
            '매수 추천이 아닙니다.',
          ].join('\n'),
        },
      },
    });

    const { POST } = await import('./route');
    const res = await POST(
      new Request('http://local/api/private-banker/message', {
        method: 'POST',
        body: JSON.stringify({ content: 'PB 확인', idempotencyKey: 'idem-1' }),
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      assistantMessage?: { id?: string };
      deduplicated?: boolean;
      dailyConversationProgress?: { phase?: string; saved?: boolean; nextActions?: Array<{ key: string }> };
      qualityMeta?: { privateBanker?: { outputContract?: { status?: string; unsafeDirectiveCount?: number } } };
    };
    expect(json.assistantMessage?.id).toBe('a1');
    expect(json.deduplicated).toBe(false);
    expect(json.qualityMeta?.privateBanker?.outputContract).toMatchObject({
      status: 'ok',
      unsafeDirectiveCount: 0,
    });
    expect(json.dailyConversationProgress).toMatchObject({
      phase: 'pb_checkin_completed',
      saved: false,
    });
    expect(json.dailyConversationProgress?.nextActions?.map((action) => action.key)).toContain('home_summary');
  });

  it('reports unsafe PB language without blocking the response', async () => {
    hoisted.runPb.mockResolvedValue({
      kind: 'ok',
      deduplicated: false,
      body: {
        userMessage: { id: 'u2', content: 'q' },
        assistantMessage: { id: 'a2', content: '지금 매수하세요.' },
      },
    });
    const { POST } = await import('./route');
    const res = await POST(
      new Request('http://local/api/private-banker/message', {
        method: 'POST',
        body: JSON.stringify({ content: 'PB 확인', idempotencyKey: 'idem-2' }),
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      assistantMessage?: { id?: string };
      qualityMeta?: { privateBanker?: { outputContract?: { status?: string; unsafeDirectiveCount?: number } } };
    };
    expect(json.assistantMessage?.id).toBe('a2');
    expect(json.qualityMeta?.privateBanker?.outputContract?.status).toBe('failed');
    expect(json.qualityMeta?.privateBanker?.outputContract?.unsafeDirectiveCount).toBeGreaterThan(0);
  });
});
