import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { InfographicSpec } from '@office-unify/shared-types';
import { ResponsiveInfographicView } from './ResponsiveInfographicView';

const spec: InfographicSpec = {
  title: 'AI 데이터센터 인프라',
  subtitle: '전력·냉각·반도체 공급망 요약',
  industry: 'AI infrastructure',
  summary: '모바일에서도 카드가 먼저 읽히도록 구성한 요약입니다.',
  zones: [
    {
      id: 'input',
      name: '투입',
      items: ['전력 장비와 냉각 장비 수요가 동시에 증가합니다.'],
      visualKeywords: [],
    },
    {
      id: 'production',
      name: '생산',
      items: ['데이터센터 사업자는 서버, 전력, 냉각 설비를 함께 증설합니다.'],
      visualKeywords: [],
    },
  ],
  flows: [{ from: 'input', to: 'production', type: 'energy', label: '전력 공급' }],
  lineup: [{ name: 'Vertiv', category: 'power and cooling', note: '데이터센터 인프라 장비' }],
  comparisons: [],
  risks: [{ title: '설비투자 둔화', description: '수요가 지연되면 장비 주문도 늦어질 수 있습니다.' }],
  charts: { bar: [], pie: [], line: [] },
  notes: ['정량 차트가 없어도 카드형 요약을 유지합니다.'],
  warnings: [],
  sourceMeta: {
    sourceType: 'text',
    generatedAt: '2026-06-08T00:00:00.000Z',
    confidence: 'medium',
    resultMode: 'industry_structure',
    extractionMode: 'semantic_fallback',
  },
};

describe('ResponsiveInfographicView', () => {
  it('uses card-first fallback when chart data is unavailable', () => {
    const html = renderToStaticMarkup(<ResponsiveInfographicView spec={spec} />);

    expect(html).toContain('차트 데이터가 부족해 카드형 요약으로 표시합니다.');
    expect(html).toContain('자료 구조는 생성됐지만 일부 수치가 없어 확인 필요로 표시합니다.');
    expect(html).toContain('grid-cols-1');
    expect(html).toContain('break-words');
    expect(/�|\?\?/.test(html)).toBe(false);
  });
});
