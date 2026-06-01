import { describe, expect, it } from 'vitest';
import { humanizeCommitteeText, containsRawSnakeCase } from './committeeHumanReadable';

describe('committeeHumanReadable', () => {
  it('turns known snake_case artifacts into Korean primary text', () => {
    const text = humanizeCommitteeText('hindsight_bias와 lack_of_predefined_exit_criteria를 점검');
    expect(text).toContain('결과를 보고 과거 판단을 과도하게 후회할 위험');
    expect(text).toContain('사전에 정한 종료 기준 부족');
    expect(text).not.toContain('hindsight_bias');
    expect(text).not.toContain('lack_of_predefined_exit_criteria');
  });

  it('does not expose unknown snake_case as raw primary text', () => {
    const text = humanizeCommitteeText('custom_internal_signal');
    expect(text).toBe('추가 확인 필요: custom internal signal');
    expect(containsRawSnakeCase(text)).toBe(false);
  });
});
