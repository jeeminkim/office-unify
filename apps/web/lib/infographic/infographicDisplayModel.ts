import type { InfographicSpec } from '@office-unify/shared-types';

export type InfographicDisplayModel = {
  title: string;
  conclusion: string;
  industryChanges: string[];
  valueChain: string[];
  relatedNames: string[];
  keySignals: string[];
  risks: string[];
  nextQuestions: string[];
  hasChartData: boolean;
  chartFallbackMessage: string;
  structureFallbackMessage?: string;
};

function compact(values: Array<string | null | undefined>, limit: number): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)).slice(0, limit);
}

export function hasUsableChartData(spec: InfographicSpec): boolean {
  return [...spec.charts.bar, ...spec.charts.pie, ...spec.charts.line].some(
    (chart) => typeof chart.value === 'number' && Number.isFinite(chart.value),
  );
}

export function buildInfographicDisplayModel(spec: InfographicSpec): InfographicDisplayModel {
  const zoneItems = spec.zones.flatMap((zone) => zone.items.map((item) => `${zone.name}: ${item}`));
  const relatedNames = compact(
    [
      ...spec.lineup.map((item) => `${item.name} (${item.category})`),
      ...spec.comparisons.map((item) => item.label),
    ],
    6,
  );
  const keySignals = compact(
    [
      ...spec.flows.map((flow) => `${flow.from} -> ${flow.to}: ${flow.label || flow.type}`),
      ...spec.notes,
      ...spec.warnings,
    ],
    6,
  );
  const risks = compact(spec.risks.map((risk) => `${risk.title}: ${risk.description}`), 5);
  const nextQuestions = compact(
    [
      '자료의 수치 근거가 충분한가?',
      '관련 기업의 실적, 수주, 가격 데이터를 확인했는가?',
      '리스크가 특정 기업 또는 산업 전체에 집중되는가?',
    ],
    3,
  );
  const hasChartData = hasUsableChartData(spec);

  return {
    title: spec.title,
    conclusion: spec.summary || spec.subtitle || '핵심 결론을 카드형 요약으로 표시합니다.',
    industryChanges: compact(zoneItems, 3),
    valueChain: compact(spec.zones.map((zone) => zone.name), 5),
    relatedNames,
    keySignals,
    risks,
    nextQuestions,
    hasChartData,
    chartFallbackMessage: '차트 데이터가 부족해 카드형 요약으로 표시합니다.',
    structureFallbackMessage: hasChartData
      ? undefined
      : '자료 구조는 생성됐지만 일부 수치가 없어 확인 필요로 표시합니다.',
  };
}
