import { describe, expect, it } from 'vitest';
import { buildJuniorAnalystDailyBrief, buildJuniorAnalystPostPbFollowup } from './juniorAnalystDailyBrief';

describe('buildJuniorAnalystDailyBrief', () => {
  it('asks for PB check-in when there is no daily context', () => {
    const brief = buildJuniorAnalystDailyBrief({
      recentPbDailyConversations: [],
      userInvestmentMemories: [],
    });
    expect(brief.status).toBe('needs_pb_checkin');
    expect(brief.headline).toContain('대화 기록이 부족');
    expect(brief.guardrail.noAutoOrder).toBe(true);
  });

  it('summarizes fresh questions without trade directives', () => {
    const brief = buildJuniorAnalystDailyBrief({
      recentPbDailyConversations: [
        {
          templateType: 'daily_checkin',
          userIntent: 'AI 전력 인프라 thesis 점검',
          actionCategory: 'add_buy',
          symbols: ['LS', '일진전기'],
          themes: ['AI 전력 인프라'],
          confidenceLevel: 'unknown',
          thesisSnapshot: {},
          riskSnapshot: {},
          nextCheckpoints: ['수주 확인'],
          memoryCandidates: [],
        },
      ],
      userInvestmentMemories: [],
      openActionItems: [{}],
    });
    const text = Object.values(brief).join('\n');
    expect(brief.status).toBe('ready');
    expect(brief.usedSources).toContain('pb_daily_conversations');
    expect(text).toContain('AI 전력 인프라');
    expect(text).not.toMatch(/매수하세요|팔아야 합니다|지금 들어가세요|자동 주문|자동 리밸런싱/);
  });

  it('builds a post-PB follow-up that explains what changed without overriding PB', () => {
    const morningBrief = {
      status: 'ready' as const,
      headline: '아침 관찰',
      keyObservation: '가격 하락이 주요 불안으로 보인다.',
      freshQuestion: 'thesis 훼손 때문인지 가격 때문인지 나눠볼까요?',
      riskToEscalateToPb: '추가매수 유혹',
      oneLineOpinion: '확인 기준이 우선입니다.',
      usedSources: ['today_candidates'],
      guardrail: { notTradeInstruction: true as const, noAutoOrder: true as const },
    };
    const followup = buildJuniorAnalystPostPbFollowup({
      morningBrief,
      pbConversationSummary: {
        templateType: 'daily_checkin',
        userIntent: '실적 확인 전 추가매수 여부가 더 중요함',
        actionCategory: 'add_buy',
        symbols: ['LS'],
        themes: ['AI 전력 인프라'],
        confidenceLevel: 'unknown',
        thesisSnapshot: {},
        riskSnapshot: {},
        nextCheckpoints: ['실적 확인'],
        memoryCandidates: [],
      },
      promotedMemories: [],
    });
    const text = Object.values(followup).join('\n');
    expect(followup.changedSinceMorning).toBe(true);
    expect(followup.updatedObservation).toContain('PB 대화 후');
    expect(followup.riskToEscalate).toContain('PB 결론을 뒤집지');
    expect(text).not.toMatch(/매수하세요|팔아야 합니다|지금 들어가세요|자동 주문|자동 리밸런싱/);
  });
});
