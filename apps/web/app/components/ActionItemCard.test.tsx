import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionItemCard } from '@/app/components/ActionItemCard';
import type { ActionItemRowDto } from '@office-unify/shared-types';

function baseItem(): ActionItemRowDto {
  return {
    id: 'a1',
    user_key: 'u1',
    title: '[리스크 점검] HLB',
    description: null,
    status: 'open',
    priority: 'high',
    source_type: 'today_candidate',
    source_id: 'cand-hlb',
    source_label: 'today_candidate',
    source_href: '/?todayCandidate=cand-hlb',
    symbol: '028300',
    links_json: {},
    detail_json: {
      notTradeInstruction: true,
      whyCreated: '리스크 점검 후보에서 저장됨',
      confirmNow: ['공시·기업 이벤트 확인'],
      doNotDo: ['매수·매도·자동 주문 금지'],
      sourceSummary: '기업 이벤트 리스크를 먼저 확인합니다.',
      actionSteps: [
        { stepId: 's1', label: '공시 확인', category: 'checklist', status: 'open' },
        { stepId: 's2', label: '리스크 점검 완료', category: 'risk_review', status: 'open' },
        { stepId: 's3', label: '판단 복기', category: 'retrospective', status: 'open' },
        { stepId: 's4', label: '자동 주문 금지', category: 'do_not_do', status: 'open' },
      ],
    },
    idempotency_key: null,
    dedupe_title_norm: 'hlb',
    created_at: '2026-05-31T00:00:00.000Z',
    updated_at: '2026-05-31T00:00:00.000Z',
    completed_at: null,
  };
}

describe('ActionItemCard', () => {
  it('renders Korean mobile-facing labels without mojibake', () => {
    const html = renderToStaticMarkup(
      <ActionItemCard it={baseItem()} patchingId={null} onPatch={() => undefined} />,
    );

    expect(html).toContain('상세 보기');
    expect(html).toContain('다음: 공시·기업 이벤트 확인');
    expect(html).toContain('완료');
    expect(html).toContain('보류');
    expect(html).toContain('열림');
    expect(/�|留|蹂|怨|寃|援|醫|湲|遺|諛|吏|媛|鍮|珥|쒕|먮|떎|뱀|궗|쫙|끗|跡/.test(html)).toBe(false);
    expect(html).not.toContain('Details');
  });
});
