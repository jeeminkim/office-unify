import { describe, expect, it } from 'vitest';
import type { InfographicSpec } from '@office-unify/shared-types';
import { buildInfographicDisplayModel } from './infographicDisplayModel';

const spec: InfographicSpec = {
  title: 'AI 데이터센터 인프라',
  subtitle: '전력과 냉각 공급망',
  industry: 'AI infrastructure',
  summary: '데이터센터 투자가 전력, 냉각, 반도체 장비로 확산됩니다.',
  zones: [
    { id: 'input', name: '전력', items: ['전력 수요가 증가합니다.'], visualKeywords: [] },
    { id: 'production', name: '냉각', items: ['냉각 설비 중요도가 높아집니다.'], visualKeywords: [] },
  ],
  flows: [{ from: 'input', to: 'production', type: 'energy', label: '전력 공급' }],
  lineup: [{ name: 'Vertiv', category: 'power/cooling', note: '데이터센터 설비' }],
  comparisons: [],
  risks: [{ title: '투자 둔화', description: '설비투자가 늦어질 수 있습니다.' }],
  charts: { bar: [], pie: [], line: [] },
  notes: [],
  warnings: [],
  sourceMeta: { sourceType: 'text', generatedAt: '2026-06-08T00:00:00.000Z', confidence: 'medium' },
};

describe('buildInfographicDisplayModel', () => {
  it('keeps a card-first model when charts are unavailable', () => {
    const model = buildInfographicDisplayModel(spec);

    expect(model.hasChartData).toBe(false);
    expect(model.chartFallbackMessage).toContain('카드형 요약');
    expect(model.industryChanges.length).toBeGreaterThan(0);
    expect(model.nextQuestions.length).toBeGreaterThan(0);
  });
});
