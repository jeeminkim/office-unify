import { describe, expect, it } from 'vitest';
import {
  normalizeObservationCopy,
  riskReviewCardHeadline,
  scrubTodayCandidateUiCopy,
  TODAY_CANDIDATE_UI_DISCLAIMERS,
} from '@/lib/todayCandidateUiCopy';

describe('todayCandidateUiCopy', () => {
  it('removes banned phrases from display copy', () => {
    expect(scrubTodayCandidateUiCopy('강력 매수 신호')).not.toMatch(/강력 매수/i);
    expect(scrubTodayCandidateUiCopy('자동 주문 실행')).not.toMatch(/자동 주문/i);
  });

  it('keeps required disclaimers intact', () => {
    for (const disclaimer of TODAY_CANDIDATE_UI_DISCLAIMERS) {
      expect(normalizeObservationCopy(disclaimer)).toBe(disclaimer);
    }
  });

  it('replaces misleading phrases with observation-first copy', () => {
    expect(normalizeObservationCopy('오늘 추천 종목 3개')).toContain('관찰 후보');
    expect(normalizeObservationCopy('추천 후보 목록')).toContain('점검 후보');
  });

  it('risk review headline uses verification tone, not buy recommendation', () => {
    const headline = riskReviewCardHeadline({
      corporateActionRisk: { active: true },
    } as Parameters<typeof riskReviewCardHeadline>[0]);
    expect(headline).toContain('확인 후 판단');
    expect(headline).not.toMatch(/매수 추천|강력|확정/i);
  });
});
