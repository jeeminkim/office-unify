import type { GenerateResponse } from './types';
import { assessSchemaCoverage } from './prompts';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ConfidenceBadge = {
  level: ConfidenceLevel;
  /** HIGH_CONFIDENCE 등 식별자 */
  label: string;
  /** 배지에 표시할 짧은 한글 */
  badgeShortKo: string;
  detail: string;
};

function sqlConfidence(
  warnings: string[] | undefined,
  schemaContext: string
): ConfidenceBadge {
  if (warnings && warnings.length > 0) {
    return {
      level: 'MEDIUM',
      label: 'MEDIUM_CONFIDENCE',
      badgeShortKo: '중간 신뢰도',
      detail: '경고·가정이 있습니다. 스키마와 함께 검증하세요.',
    };
  }
  const cov = assessSchemaCoverage(schemaContext);
  if (cov === 'adequate') {
    return {
      level: 'HIGH',
      label: 'HIGH_CONFIDENCE',
      badgeShortKo: '높은 신뢰도',
      detail: '스키마 정보가 충분하고 경고가 없습니다.',
    };
  }
  return {
    level: 'LOW',
    label: 'LOW_CONFIDENCE',
    badgeShortKo: '낮은 신뢰도',
    detail: '스키마가 부족하거나 구조가 불명확할 수 있습니다.',
  };
}

function flowConfidence(result: GenerateResponse): ConfidenceBadge {
  if (result.warnings && result.warnings.length > 0) {
    return {
      level: 'MEDIUM',
      label: 'MEDIUM_CONFIDENCE',
      badgeShortKo: '중간 신뢰도',
      detail: '주의사항이 있습니다. 다이어그램과 함께 검증하세요.',
    };
  }
  const hasDiagram = Boolean(result.mermaidCode?.trim());
  const hasSummary = Boolean(result.content?.trim()) && result.content.trim().length >= 20;
  if (hasDiagram && hasSummary) {
    return {
      level: 'HIGH',
      label: 'HIGH_CONFIDENCE',
      badgeShortKo: '높은 신뢰도',
      detail: '요약·시각화가 모두 있습니다.',
    };
  }
  return {
    level: 'LOW',
    label: 'LOW_CONFIDENCE',
    badgeShortKo: '낮은 신뢰도',
    detail: '다이어그램 또는 요약이 부족할 수 있습니다.',
  };
}

function tsConfidence(result: GenerateResponse): ConfidenceBadge {
  if (result.warnings && result.warnings.length > 0) {
    return {
      level: 'MEDIUM',
      label: 'MEDIUM_CONFIDENCE',
      badgeShortKo: '중간 신뢰도',
      detail: '주의사항이 있습니다.',
    };
  }
  if (!result.content?.trim() || result.content.trim().length < 30) {
    return {
      level: 'LOW',
      label: 'LOW_CONFIDENCE',
      badgeShortKo: '낮은 신뢰도',
      detail: '생성 코드가 짧거나 불완전할 수 있습니다.',
    };
  }
  return {
    level: 'HIGH',
    label: 'HIGH_CONFIDENCE',
    badgeShortKo: '높은 신뢰도',
    detail: '경고 없이 코드가 생성되었습니다.',
  };
}

/**
 * SQL은 입력 시점의 schemaContext와 결과 warnings를 함께 봅니다.
 * Flow/TS는 결과 본문만으로 휴리스틱 판단합니다.
 */
export function computeResultConfidence(
  result: GenerateResponse,
  inputSchemaContext?: string
): ConfidenceBadge {
  switch (result.taskType) {
    case 'sql':
      return sqlConfidence(result.warnings, inputSchemaContext ?? '');
    case 'flow':
      return flowConfidence(result);
    case 'ts':
      return tsConfidence(result);
  }
}
