import { describe, expect, it } from 'vitest';
import {
  buildReadableSummaryFromStructured,
  contentLooksLikeRawJson,
  resolveLineDisplayContent,
} from '@/lib/committeeStructuredDisplay';
import type { PersonaStructuredOutput } from '@office-unify/shared-types';

const sampleStructured: PersonaStructuredOutput = {
  role: 'risk',
  stance: 'review',
  confidence: 'medium',
  keyReasons: ['data_check'],
  riskFlags: ['volatility'],
  opportunityDrivers: ['조건이 확인되면 관찰 가치가 있습니다'],
  missingEvidence: ['근거 보강 필요'],
  contradictions: [],
  doNotDo: ['즉시 실행 금지'],
  nextChecks: ['비중 확인'],
  displaySummary: '요약 본문',
};

describe('committeeStructuredDisplay', () => {
  it('detects raw JSON content', () => {
    expect(contentLooksLikeRawJson('{"displaySummary":"x","keyReasons":[]}')).toBe(true);
  });

  it('prefers structured report over raw JSON', () => {
    const { readable, rawForDebug } = resolveLineDisplayContent({
      slug: 'hindenburg',
      displayName: 'H',
      content: '{"displaySummary":"hidden"}',
      structuredOutput: sampleStructured,
    });
    expect(readable).toContain('요약 본문');
    expect(readable).not.toContain('"displaySummary"');
    expect(rawForDebug).toBeTruthy();
  });

  it('keeps raw JSON out of the primary body when structured output is missing', () => {
    const { readable, rawForDebug } = resolveLineDisplayContent({
      slug: 'hindenburg',
      displayName: 'H',
      content: '{"displaySummary":"hidden","keyReasons":["raw"]',
    });
    expect(readable).not.toContain('"keyReasons"');
    expect(rawForDebug).toContain('"keyReasons"');
  });

  it('turns partial plain text into a multi-section report shell', () => {
    const { readable } = resolveLineDisplayContent({
      slug: 'cio',
      displayName: 'CIO',
      content: '리스크만 말하고 중간 조건이 빠진 발언입니다.',
    });
    expect(readable).toContain('리스크');
    expect(readable).toContain('확인');
  });

  it('humanizes snake_case artifacts in the primary body', () => {
    const readable = buildReadableSummaryFromStructured({
      ...sampleStructured,
      keyReasons: ['hindsight_bias', 'systematic_model_enhancement'],
      riskFlags: ['lack_of_predefined_exit_criteria'],
      nextChecks: ['custom_internal_signal'],
    });
    expect(readable).toContain('결과를 보고 과거 판단');
    expect(readable).toContain('판단 기준을 더 체계화');
    expect(readable).toContain('종료 기준이 부족');
    expect(readable).toContain('추가 확인 필요: custom internal signal');
    expect(readable).not.toContain('hindsight_bias');
  });
});
