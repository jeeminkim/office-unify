export type InvestmentAssistantOutputQuality = {
  formatValid: boolean;
  missingSections: string[];
  normalized: boolean;
  warnings: string[];
};

const REQUIRED_SECTION_TITLES = [
  '행동 분류',
  '정보 상태',
  '핵심 근거',
  '주요 리스크',
  '지금 해야 할 행동',
  '하면 안 되는 행동',
  '다음 관찰 포인트',
] as const;

function hasSection(text: string, title: string): boolean {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|\\n)#{1,6}\\s*${escaped}\\b`, 'i');
  return re.test(text);
}

export function validateInvestmentAssistantOutput(text: string): InvestmentAssistantOutputQuality {
  const normalizedText = text.trim();
  const missingSections = REQUIRED_SECTION_TITLES.filter((title) => !hasSection(normalizedText, title));
  return {
    formatValid: missingSections.length === 0,
    missingSections,
    normalized: false,
    warnings: missingSections.length > 0 ? ['investment_output_sections_missing'] : [],
  };
}

export function normalizeInvestmentAssistantOutput(text: string): {
  text: string;
  quality: InvestmentAssistantOutputQuality;
} {
  const base = validateInvestmentAssistantOutput(text);
  if (base.formatValid) {
    return { text, quality: base };
  }

  const patches = base.missingSections
    .map((section) => `## ${section}\n- (형식 보정) 모델 응답에 해당 섹션이 누락되어 사용자가 직접 확인이 필요합니다.`)
    .join('\n\n');
  const merged = `${text.trim()}\n\n${patches}\n`;
  return {
    text: merged,
    quality: {
      ...base,
      normalized: true,
      warnings: [...base.warnings, 'investment_output_format_normalized'],
    },
  };
}

