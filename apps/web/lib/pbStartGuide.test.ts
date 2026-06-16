import { describe, expect, it } from 'vitest';
import { PB_INPUT_PLACEHOLDER, PB_START_ACTION_LABELS, PB_START_GUIDE_EXAMPLES } from './pbStartGuide';

describe('pbStartGuide', () => {
  it('keeps examples, action buttons, and placeholder focused on PB check-in', () => {
    expect(PB_START_GUIDE_EXAMPLES).toHaveLength(3);
    expect(PB_START_GUIDE_EXAMPLES.join('\n')).toContain('추가매수하고 싶은데 기준');
    expect(PB_START_GUIDE_EXAMPLES.join('\n')).toContain('포트폴리오에 더 맞는 선택');
    expect(PB_START_GUIDE_EXAMPLES.join('\n')).toContain('AI 전력 인프라 thesis');
    expect(PB_START_ACTION_LABELS).toEqual([
      '불안 점검',
      '추가매수 전 체크',
      '종목 비교',
      '리서치 요청',
      '그냥 생각 정리',
    ]);
    expect(PB_INPUT_PLACEHOLDER).toContain('오늘 신경 쓰이는 종목');
  });
});
