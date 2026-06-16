import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JuniorAnalystMemoSection } from './JuniorAnalystMemoSection';

describe('JuniorAnalystMemoSection', () => {
  it('keeps the junior analyst compact and non-directive', () => {
    const html = renderToStaticMarkup(<JuniorAnalystMemoSection />);
    expect(html).toContain('주니어 애널리스트 메모');
    expect(html).toContain('PB 체크인');
    expect(/매수하세요|팔아야 합니다|지금 들어가세요|자동 주문|자동 리밸런싱/.test(html)).toBe(false);
  });

  it('shows structured observations and transparent sources when ready', () => {
    const html = renderToStaticMarkup(
      <JuniorAnalystMemoSection
        brief={{
          status: 'ready',
          headline: '오늘의 핵심',
          keyObservation: '관찰 내용',
          freshQuestion: '확인 질문',
          riskToEscalateToPb: 'PB 이관 리스크',
          oneLineOpinion: '한 줄 의견',
          usedSources: ['pb_daily_conversations', 'action_items'],
          guardrail: { notTradeInstruction: true, noAutoOrder: true },
        }}
      />,
    );
    expect(html).toContain('관찰 내용');
    expect(html).toContain('확인 질문');
    expect(html).toContain('pb_daily_conversations');
    expect(html).toContain('자동 주문 없음');
  });
});
