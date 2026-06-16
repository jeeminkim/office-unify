import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TodayCoreSummarySection } from './TodayCoreSummarySection';

describe('TodayCoreSummarySection', () => {
  it('renders a compact core card for usable data', () => {
    const html = renderToStaticMarkup(
      <TodayCoreSummarySection title="관심 후보" summary="확인 기준을 먼저 점검합니다." sourceLabel="Today Brief" />,
    );
    expect(html).toContain('오늘의 핵심');
    expect(html).toContain('확인 기준을 먼저 점검합니다.');
    expect(html).toContain('#today-brief');
  });

  it('does not render a placeholder when usable data is absent', () => {
    expect(renderToStaticMarkup(<TodayCoreSummarySection />)).toBe('');
  });
});
