import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TodayCandidatesSection } from '@/app/components/dashboard/TodayCandidatesSection';

describe('TodayCandidatesSection', () => {
  it('surfaces the KR 2 + US 1 deck contract when slots are missing', () => {
    const html = renderToStaticMarkup(
      <TodayCandidatesSection
        deckContract={{
          targetKrSlots: 2,
          filledKrSlots: 1,
          targetUsSlots: 1,
          filledUsSlots: 0,
          usDiagnosticSlotPresent: true,
          usSlotFallbackReason: 'quote_quality_low',
          krSlotFallbackReason: 'insufficient_kr_candidates',
          deckContractStatus: 'partial',
          actionHint: '미국 후보 대신 진단 카드로 대체했습니다.',
        }}
      >
        <div>후보 본문</div>
      </TodayCandidatesSection>,
    );

    expect(html).toContain('국내 2 + 미국 1 슬롯');
    expect(html).toContain('현재 국내 1 + 미국 0');
    expect(html).toContain('강제로 만들지 않고');
    expect(html).toContain('시세 상태 확인');
    expect(/자동 주문|자동 리밸런싱|매도 지시|매수 지시/.test(html)).toBe(false);
  });

  it('explains read-only US discovery fallback', () => {
    const html = renderToStaticMarkup(
      <TodayCandidatesSection
        deckContract={{
          targetKrSlots: 2,
          filledKrSlots: 0,
          targetUsSlots: 1,
          filledUsSlots: 0,
          usDiagnosticSlotPresent: false,
          usDiscoverySlotPresent: true,
          deckContractStatus: 'degraded_with_discovery',
          actionHint: '테마 기반 미국 관찰 후보를 읽기 전용으로 표시합니다.',
        }}
      >
        <div>후보 본문</div>
      </TodayCandidatesSection>,
    );

    expect(html).toContain('관찰 후보 fallback');
    expect(html).toContain('미국 관찰 후보');
    expect(html).toContain('시세 미확인 상태');
    expect(html).toContain('Research로 이어가기');
  });
});
