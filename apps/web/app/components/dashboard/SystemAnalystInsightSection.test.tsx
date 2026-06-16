import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SystemAnalystInsightSection } from './SystemAnalystInsightSection';

describe('SystemAnalystInsightSection', () => {
  it('shows source transparency for the system analyst persona', () => {
    const html = renderToStaticMarkup(
      <SystemAnalystInsightSection
        dataIssueCount={1}
        repeatedPatternCount={3}
        blockerCount={0}
        insights={[{
          severity: 'medium',
          area: 'home_ux',
          userPain: 'PB 진입점보다 운영 카드가 앞서 보입니다.',
          evidence: ['모바일 첫 화면 카드 밀도'],
          suspectedCause: '운영 카드 우선순위',
          recommendedFix: 'PB 카드를 최상단에 둡니다.',
          priority: 1,
          sourceTypes: ['mobile_ux'],
        }]}
        dataCoverage={[
          { sourceType: 'web_ops_events', status: 'available', itemCount: 1 },
          { sourceType: 'quality_meta', status: 'available', itemCount: 1 },
          { sourceType: 'sql_readiness', status: 'available' },
          { sourceType: 'runbook_result', status: 'missing', limitation: '최근 실행 없음' },
          { sourceType: 'screen_flow', status: 'partial', limitation: '모바일 화면 구조 기준' },
        ]}
        recommendations={[{
          id: 'sys-home-1',
          title: '홈 대화 흐름 우선순위 정리',
          priority: 'p1',
          area: 'home_ux',
          userPain: 'PB 진입점보다 운영 카드가 앞서 보입니다.',
          evidence: ['모바일 첫 화면 카드 밀도'],
          suggestedChange: 'PB 카드를 최상단에 둡니다.',
          expectedUserImpact: '대화 시작이 쉬워집니다.',
          status: 'suggested',
          writeAction: false,
        }]}
      />,
    );
    expect(html).toContain('시스템 담당자 의견 보기');
    expect(html).toContain('web_ops_events');
    expect(html).toContain('quality_meta');
    expect(html).toContain('sql_readiness');
    expect(html).toContain('runbook_result');
    expect(html).toContain('모바일 첫 화면 카드 밀도');
    expect(html).toContain('mobile_ux');
    expect(html).toContain('runbook_result');
    expect(html).toContain('최근 실행 없음');
    expect(html).toContain('Action Inbox에 저장');
  });
});
