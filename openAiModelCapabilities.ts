/**
 * OpenAI Responses API(`responses.create`) 기준 모델별 지원 파라미터.
 * 미등록 모델은 보수적으로 temperature 등을 허용(기존 동작 유지); gpt-5* 계열은 temperature 미지원이 일반적.
 */

export type OpenAiModelCapabilities = {
  supportsTemperature: boolean;
  supportsMaxOutputTokens: boolean;
  /** 향후 reasoning_effort 등 확장용 */
  supportsReasoningEffort: boolean;
};

const DEFAULT_CAPS: OpenAiModelCapabilities = {
  supportsTemperature: true,
  supportsMaxOutputTokens: true,
  supportsReasoningEffort: false
};

/**
 * 정규화: provider 접두사 제거 후 소문자 — `openai/gpt-5-mini` 등도 gpt-5* 로 인식.
 */
export function normalizeOpenAiModelId(model: string): string {
  let m = String(model || '').trim().toLowerCase();
  const slash = m.lastIndexOf('/');
  if (slash >= 0) m = m.slice(slash + 1);
  return m;
}

function capsForNormalizedId(norm: string): OpenAiModelCapabilities {
  if (norm.startsWith('gpt-5') || /^o[0-9]/.test(norm) || norm.startsWith('o1') || norm.startsWith('o3')) {
    return {
      supportsTemperature: false,
      supportsMaxOutputTokens: true,
      supportsReasoningEffort: false
    };
  }
  return { ...DEFAULT_CAPS };
}

export function getOpenAiModelCapabilities(model: string): OpenAiModelCapabilities {
  const norm = normalizeOpenAiModelId(model);
  return capsForNormalizedId(norm);
}
