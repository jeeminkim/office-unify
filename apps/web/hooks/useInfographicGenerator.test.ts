import { describe, expect, it } from 'vitest';
import { formatFriendlyInfographicError } from '@/hooks/useInfographicGenerator';

describe('useInfographicGenerator error formatting', () => {
  it('does not expose raw AbortError copy', () => {
    const msg = formatFriendlyInfographicError(
      { error: 'This operation was aborted', requestId: 'info-test' },
      '원문 추출 실패',
    );

    expect(msg).toContain('URL 분석 시간이 초과되었습니다.');
    expect(msg).toContain('본문을 직접 붙여넣어 계속할 수 있습니다');
    expect(msg).toContain('info-test');
    expect(msg).not.toContain('This operation was aborted');
  });

  it('keeps server actionHint and requestId for degraded URL extraction', () => {
    const msg = formatFriendlyInfographicError(
      {
        error: 'URL 원문을 가져오지 못했습니다.',
        requestId: 'info-fetch',
        actionHint: '본문 붙여넣기 또는 Research Center 이동을 사용하세요.',
      },
      '원문 추출 실패',
    );

    expect(msg).toContain('URL 원문을 가져오지 못했습니다.');
    expect(msg).toContain('Research Center 이동');
    expect(msg).toContain('info-fetch');
  });
});
