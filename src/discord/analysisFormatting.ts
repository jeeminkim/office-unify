import { logger } from '../../logger';
import type { PersonaKey } from '../../analysisTypes';
import type { ProviderGenerationResult } from '../../analysisTypes';
import { postProcessPersonaOutputForDiscord } from './personaResponsePostProcess';

export function detectFinancialIntent(query: string): boolean {
  return /(포트폴리오|비중|리스크|손익|평단|리밸런싱|투자 전략|종합 진단|현금버퍼|월 투자여력|자산배분)/i.test(query);
}

export function guessAnalysisTypeFromTrigger(triggerCustomId: string | undefined, userQuery: string): string {
  const t = triggerCustomId || '';
  if (t.includes('panel:portfolio:risk') || /(리스크|변동성|위험)/i.test(userQuery)) return 'portfolio_risk';
  if (t.includes('panel:ai:strategy')) return 'portfolio_strategy';
  if (t.includes('panel:ai:full')) return 'portfolio_full_diagnosis';
  if (t.includes('panel:trend:')) return `trend_${t.split(':').pop() || 'unknown'}`;
  if (t.includes('open_topic')) return 'open_topic';
  return detectFinancialIntent(userQuery) ? 'portfolio_financial' : 'open_topic';
}

export function toOpinionSummary(text: string, maxLen = 220): string {
  const t = (text || '').trim();
  if (!t) return '';
  return t.length <= maxLen ? t : t.slice(0, maxLen) + '…';
}

export function asGeminiResult(text: string): ProviderGenerationResult {
  return {
    text,
    provider: 'gemini',
    model: 'gemini-2.5-flash'
  };
}

export function normalizeProviderOutputForDiscord(params: { text: string; provider: string; personaKey: PersonaKey }): string {
  const provider = params.provider;
  const personaKey = params.personaKey;
  let t = String(params.text || '').replace(/\r\n/g, '\n').trim();
  if (!t) {
    logger.warn('UX', 'empty provider response handled', { provider, personaKey });
    t = '응답 생성이 불안정하여 핵심 요약으로 대체합니다. 잠시 후 다시 시도해 주세요.';
  }
  if (t.length < 40) {
    logger.warn('UX', 'too short provider response', { provider, personaKey, length: t.length });
  }
  if (t.length > 2600 && !t.startsWith('##')) {
    t = `## 핵심 요약\n${t.slice(0, 500)}\n\n## 상세 내용\n${t}`;
  }
  logger.info('UX', 'provider output normalized', {
    provider,
    personaKey,
    originalLength: String(params.text || '').length,
    normalizedLength: t.length
  });
  return postProcessPersonaOutputForDiscord(t);
}

export function personaKeyToPersonaName(personaKey: PersonaKey): string {
  switch (personaKey) {
    case 'RAY':
      return 'Ray Dalio (PB)';
    case 'HINDENBURG':
      return 'HINDENBURG_ANALYST';
    case 'JYP':
      return 'JYP (Analyst)';
    case 'SIMONS':
      return 'James Simons (Quant)';
    case 'DRUCKER':
      return 'Peter Drucker (COO)';
    case 'CIO':
      return 'Stanley Druckenmiller (CIO)';
    case 'TREND':
      return 'Trend Analyst';
    case 'OPEN_TOPIC':
      return 'Open Topic Analyst';
    case 'THIEL':
      return 'Peter Thiel (Data Center)';
    case 'HOT_TREND':
      return '전현무 · 핫 트렌드 분석';
    default:
      return 'Unknown';
  }
}
