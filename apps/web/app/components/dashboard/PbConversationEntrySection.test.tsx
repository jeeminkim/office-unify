import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PbConversationEntrySection } from './PbConversationEntrySection';

describe('PbConversationEntrySection', () => {
  it('renders PB as the home primary entry with three CTAs', () => {
    const html = renderToStaticMarkup(<PbConversationEntrySection />);
    expect(html).toContain('PB Conversation Entry');
    expect(html).toContain('오늘 PB에게 말해볼 것');
    expect(html).toContain('PB와 3문항 체크인');
    expect(html).toContain('그냥 자유롭게 말하기');
    expect(html).toContain('최근 기억 보고 시작');
    expect(/미국 데이터 준비 실행/.test(html)).toBe(false);
  });
});
