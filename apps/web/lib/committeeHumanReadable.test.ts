import { describe, expect, it } from 'vitest';
import { containsRawSnakeCase, humanizeCommitteeText } from './committeeHumanReadable';

describe('committeeHumanReadable', () => {
  it('turns known snake_case artifacts into Korean primary text', () => {
    const text = humanizeCommitteeText('hindsight_bias와 lack_of_predefined_exit_criteria를 점검');
    expect(text).toContain('결과를 보고 과거 판단');
    expect(text).toContain('종료 기준이 부족');
    expect(text).not.toContain('hindsight_bias');
    expect(text).not.toContain('lack_of_predefined_exit_criteria');
  });

  it('uses the central reason contract for structured output failures', () => {
    const text = humanizeCommitteeText('structured_output_parse_failed');
    expect(text).toContain('모델 출력 형식');
    expect(text).not.toContain('structured_output_parse_failed');
  });

  it('does not expose unknown snake_case as raw primary text', () => {
    const text = humanizeCommitteeText('custom_internal_signal');
    expect(text).toBe('추가 확인 필요: custom internal signal');
    expect(containsRawSnakeCase(text)).toBe(false);
  });
});
