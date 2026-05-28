import { describe, expect, it, vi } from 'vitest';
import { parseCommitteeLineRegenerateRequest, executeCommitteeLineRegenerate } from '@/lib/server/committeeLineRegenerate';
import { buildLongResponseFallback } from '@/lib/longResponseFallback';

vi.mock('@office-unify/ai-office-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@office-unify/ai-office-engine')>();
  return {
    ...actual,
    generatePersonaAssistantReply: vi.fn(),
    resolveWebPersona: vi.fn(() => ({
      key: 'hindenburg',
      displayName: 'Hindenburg',
      systemPrompt: 'test',
    })),
  };
});

vi.mock('@office-unify/supabase-access', () => ({
  listWebPortfolioHoldingsForUser: vi.fn(async () => []),
  listWebPortfolioWatchlistForUser: vi.fn(async () => []),
  selectPersonaLongTermSummary: vi.fn(async () => null),
}));

describe('parseCommitteeLineRegenerateRequest', () => {
  it('requires personaKey and originalQuestion', () => {
    expect(parseCommitteeLineRegenerateRequest({})).toBeNull();
    expect(
      parseCommitteeLineRegenerateRequest({ personaKey: 'hindenburg', originalQuestion: 'test' }),
    ).toMatchObject({ personaKey: 'hindenburg' });
  });
});

describe('executeCommitteeLineRegenerate', () => {
  it('returns a compact Korean card without fenced JSON on provider success', async () => {
    const { generatePersonaAssistantReply } = await import('@office-unify/ai-office-engine');
    vi.mocked(generatePersonaAssistantReply).mockResolvedValue({
      text: [
        '[결론]',
        '후회보다 당시 판단 기준을 복기해야 합니다.',
        '',
        '[핵심 근거]',
        '- 결과 편향이 판단을 흔들 수 있습니다.',
        '',
        '[다음 확인]',
        '- 섹터 집중도를 확인합니다.',
      ].join('\n'),
    } as never);

    const res = await executeCommitteeLineRegenerate({
      supabase: {} as never,
      userKey: 'test-user',
      geminiApiKey: 'g',
      openAiApiKey: 'o',
      request: {
        personaKey: 'hindenburg',
        originalQuestion: '반도체 비중?',
        previousLine: '{"displaySummary":"broken"',
        regenerateMode: 'repair_partial',
      },
    });

    expect(res.ok).toBe(true);
    expect(res.displayText).toContain('[결론]');
    expect(res.displayText).not.toContain('```');
    expect(res.displayText).not.toContain('"displaySummary"');
    expect(res.displayText.length).toBeLessThanOrEqual(1200);
    expect(res.qualityMeta.autoSaved).toBe(false);
    expect(res.qualityMeta.writeAction).toBe(false);
  });

  it('compacts malformed JSON provider output instead of previewing raw JSON', async () => {
    const { generatePersonaAssistantReply } = await import('@office-unify/ai-office-engine');
    vi.mocked(generatePersonaAssistantReply).mockResolvedValue({
      text: '{"displaySummary":"요약","keyReasons":["근거 1"],"riskFlags":["리스크"',
    } as never);

    const res = await executeCommitteeLineRegenerate({
      supabase: {} as never,
      userKey: 'test-user',
      geminiApiKey: 'g',
      openAiApiKey: 'o',
      request: {
        personaKey: 'hindenburg',
        originalQuestion: '반도체 비중?',
        previousLine: 'partial {',
        regenerateMode: 'repair_partial',
      },
    });

    expect(res.displayText).toContain('[결론]');
    expect(res.displayText).toContain('요약');
    expect(res.displayText).not.toContain('"keyReasons"');
  });

  it('returns fallback on provider error without throwing', async () => {
    const { generatePersonaAssistantReply } = await import('@office-unify/ai-office-engine');
    vi.mocked(generatePersonaAssistantReply).mockRejectedValue(new Error('timeout exceeded'));

    const res = await executeCommitteeLineRegenerate({
      supabase: {} as never,
      userKey: 'test-user',
      geminiApiKey: 'g',
      openAiApiKey: 'o',
      request: {
        personaKey: 'hindenburg',
        originalQuestion: '반도체 비중?',
        previousLine: 'partial {',
        regenerateMode: 'repair_partial',
      },
    });

    expect(res.ok).toBe(true);
    expect(res.status).toBe('timeout');
    expect(res.qualityMeta.autoSaved).toBe(false);
    expect(res.qualityMeta.writeAction).toBe(false);
    expect(res.displayText.length).toBeGreaterThan(10);
    expect(res.actionHints.length).toBeGreaterThan(0);
    expect(res.actionHints.some((h) => h.actionKey === 'open_research')).toBe(true);
  });

  it('uses long response fallback for very long raw text', () => {
    const long = 'a'.repeat(2500);
    const fb = buildLongResponseFallback(long);
    expect(fb.exceededLimit).toBe(true);
  });
});
