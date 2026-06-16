import { describe, expect, it } from 'vitest';
import { buildDailyInvestmentConversationState, getKstDateKey } from './dailyInvestmentConversationModel';

const pb = {
  templateType: 'daily_checkin' as const,
  userIntent: 'AI 전력 인프라 thesis 점검',
  actionCategory: 'add_buy' as const,
  symbols: ['LS'],
  themes: ['AI 전력 인프라'],
  thesisSnapshot: {},
  riskSnapshot: {},
  nextCheckpoints: ['수주 확인'],
  memoryCandidates: [],
};

describe('dailyInvestmentConversationModel', () => {
  it('uses KST date boundaries', () => {
    expect(getKstDateKey('2026-06-15T15:30:00.000Z')).toBe('2026-06-16');
    expect(getKstDateKey('2026-06-15T14:30:00.000Z')).toBe('2026-06-15');
  });

  it('moves through daily conversation phases', () => {
    expect(buildDailyInvestmentConversationState({ todayDate: '2026-06-16' }).phase).toBe('not_started');
    const morningBrief = {
      status: 'ready' as const,
      headline: '오늘 주니어 관찰',
      keyObservation: '가격 하락이 주요 불안으로 보입니다.',
      freshQuestion: 'thesis 훼손인지 가격 불안인지 나눠볼까요?',
      riskToEscalateToPb: '추가매수 유혹',
      oneLineOpinion: '확인 기준이 먼저입니다.',
      usedSources: ['today_candidates'],
      guardrail: { notTradeInstruction: true as const, noAutoOrder: true as const },
    };
    expect(buildDailyInvestmentConversationState({ todayDate: '2026-06-16', morningBrief }).phase).toBe('morning_brief_ready');
    expect(buildDailyInvestmentConversationState({ todayDate: '2026-06-16', morningBrief, pbConversation: pb }).phase).toBe('pb_checkin_completed');
    expect(buildDailyInvestmentConversationState({
      todayDate: '2026-06-16',
      morningBrief,
      pbConversation: pb,
      postPbFollowup: {
        status: 'ready',
        changedSinceMorning: true,
        updatedObservation: '실제 사용자는 실적 확인 전 추가매수 여부를 더 중요하게 봤습니다.',
        updatedQuestion: '확인 기준은 무엇인가요?',
        riskToEscalate: '행동 보류 기준',
        oneLineOpinion: 'PB 기준 정리가 우선입니다.',
        usedSources: ['pb_daily_conversations'],
        guardrail: { notTradeInstruction: true, noAutoOrder: true },
      },
    }).phase).toBe('analyst_followup_ready');
  });
});
