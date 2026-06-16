import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailyConversationLoopSection } from './DailyConversationLoopSection';

describe('DailyConversationLoopSection', () => {
  it('keeps the first home card focused on daily conversation', () => {
    const html = renderToStaticMarkup(<DailyConversationLoopSection />);
    expect(html).toContain('오늘의 투자 대화');
    expect(html).toContain('PB와 3문항 체크인');
    expect(html).toContain('최근 기억');
    expect(html).toContain('주니어 의견');
    expect(html).toContain('오늘 요약');
    expect(html).not.toContain('Runbook step');
  });

  it('shows PB completed actions when a conversation exists', () => {
    const html = renderToStaticMarkup(
      <DailyConversationLoopSection
        state={{
          phase: 'pb_checkin_completed',
          todayDate: '2026-06-16',
          morningBrief: { status: 'ready', keySymbols: ['LS'], keyThemes: ['AI 전력'], headline: '관찰', freshQuestion: '질문' },
          pbCheckin: { started: true, completed: true, actionCategory: 'add_buy', summary: 'PB 대화 완료' },
          juniorFollowup: { status: 'not_ready', changedSinceMorning: false },
          dailySummary: { status: 'not_ready' },
          guardrails: { notTradeInstruction: true, noAutomaticOrder: true, noAutomaticRebalancing: true },
        }}
      />,
    );
    expect(html).toContain('PB 대화 보기');
    expect(html).toContain('주니어 후속 의견 보기');
  });
});
