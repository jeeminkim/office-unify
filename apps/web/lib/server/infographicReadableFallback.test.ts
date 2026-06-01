import { describe, expect, it } from 'vitest';
import { buildReadableInfographicFallbackSpec } from './infographicReadableFallback';

describe('infographic readable fallback', () => {
  it('keeps a readable summary when source text exists but draft generation is degraded', () => {
    const spec = buildReadableInfographicFallbackSpec({
      industryName: '로봇',
      sourceTitle: '로봇주 블로그 정리',
      rawText: [
        '이 블로그는 알에스오토메이션 로봇주 상승 배경을 설명한다.',
        '다만 투자 판단에는 수주, 실적, 밸류에이션 확인이 더 필요하다.',
        '산업 관점에서는 자동화 수요와 설비투자 사이클을 함께 봐야 한다.',
        '숫자 근거가 부족하면 주장을 검증된 사실로 단정해서는 안 된다.',
      ].join('\n'),
      reason: 'structured_analysis_failed',
    });

    expect(spec.sourceMeta.extractionMode).toBe('degraded_fallback');
    expect(spec.summary).toContain('알에스오토메이션');
    expect(spec.zones.some((z) => z.name === '핵심 주장')).toBe(true);
    expect(spec.subtitle).toContain('요약은 사용할 수 있습니다');
    expect(JSON.stringify(spec)).not.toMatch(/즉시\s*매수|주문\s*실행|자동\s*리밸런싱/);
  });
});
