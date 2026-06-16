export type SystemAnalystInsight = {
  severity: 'low' | 'medium' | 'high';
  area: 'home_ux' | 'data_readiness' | 'quote' | 'research' | 'pb_memory' | 'today_candidates' | 'mobile';
  userPain: string;
  evidence: string[];
  suspectedCause: string;
  recommendedFix: string;
  priority: number;
  sourceTypes: string[];
};

export type SystemAnalystDataCoverage = {
  sourceType:
    | 'web_ops_events'
    | 'quality_meta'
    | 'sql_readiness'
    | 'runbook_result'
    | 'user_feedback'
    | 'screen_flow'
    | 'pb_memory';
  status: 'available' | 'partial' | 'missing';
  itemCount?: number;
  latestAt?: string;
  limitation?: string;
};

export type SystemAnalystRecommendation = {
  id: string;
  title: string;
  priority: 'p0' | 'p1' | 'p2';
  area: string;
  userPain: string;
  evidence: string[];
  suggestedChange: string;
  expectedUserImpact: string;
  status: 'suggested';
  writeAction: false;
};

export function buildSystemAnalystInsights(input: {
  opsEventsSummary?: unknown;
  sqlReadinessSummary?: unknown;
  runbookStatus?: unknown;
  qualityMetaSnapshots?: unknown[];
  userFeedbackSignals?: unknown[];
  mobileUxSignals?: unknown[];
}): SystemAnalystInsight[] {
  const sourceTypes = [
    input.opsEventsSummary ? 'web_ops_events' : '',
    input.sqlReadinessSummary ? 'sql_readiness' : '',
    input.runbookStatus ? 'runbook_status' : '',
    input.qualityMetaSnapshots?.length ? 'qualityMeta' : '',
    input.userFeedbackSignals?.length ? 'user_feedback' : '',
    input.mobileUxSignals?.length ? 'mobile_ux' : '',
  ].filter(Boolean);

  const insights: SystemAnalystInsight[] = [
    {
      severity: 'medium',
      area: 'home_ux',
      userPain: '홈 첫 화면에서 PB 대화 진입점보다 운영 카드가 먼저 보이면 투자 콘솔이 아니라 복구 화면처럼 느껴집니다.',
      evidence: [
        'Copilot/Runbook/데이터 준비 카드가 PB 진입보다 앞서면 모바일 첫 화면 대부분을 차지함',
        'PB 대화 CTA가 첫 화면 primary action이 아니면 사용자가 오늘 무엇을 시작할지 놓치기 쉬움',
      ],
      suspectedCause: '운영 복구 흐름이 홈 IA의 상단 우선순위를 차지함',
      recommendedFix: 'PB 대화 시작, 개인화 요약, 주니어 애널리스트 메모를 먼저 배치하고 운영/Runbook은 접힘 상태로 낮춥니다.',
      priority: 1,
      sourceTypes: sourceTypes.length ? sourceTypes : ['mobile_ux', 'qualityMeta'],
    },
  ];

  if (input.sqlReadinessSummary || input.runbookStatus || input.opsEventsSummary) {
    insights.push({
      severity: 'low',
      area: 'data_readiness',
      userPain: '데이터 이슈는 필요할 때 확인하면 되지만, 투자 대화보다 먼저 강조되면 불안감을 줍니다.',
      evidence: ['SQL readiness, runbook status, web_ops_events는 운영 근거로만 사용', '데이터 제한 상태는 국내/테마 중심 확인으로 안내 가능'],
      suspectedCause: '헬스체크 메시지가 투자 판단 UX와 같은 우선순위로 노출됨',
      recommendedFix: '데이터 상태를 한 줄 summary와 자세히 보기로 축소하고, 복구 실행 CTA는 운영 점검 안에 둡니다.',
      priority: 2,
      sourceTypes: sourceTypes.length ? sourceTypes : ['sql_readiness', 'runbook_status', 'web_ops_events'],
    });
  }

  return insights.filter((insight) => insight.evidence.length > 0 && insight.sourceTypes.length > 0);
}

function countItems(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const numeric = ['count', 'total', 'openErrorCount', 'openErrors'].map((key) => record[key]).find((v) => typeof v === 'number');
    if (typeof numeric === 'number') return numeric;
  }
  return undefined;
}

export function buildSystemAnalystDataCoverage(input: {
  opsEventsSummary?: unknown;
  sqlReadinessSummary?: unknown;
  runbookStatus?: unknown;
  qualityMetaSnapshots?: unknown[];
  userFeedbackSignals?: unknown[];
  mobileUxSignals?: unknown[];
  pbMemorySignals?: unknown[];
}): SystemAnalystDataCoverage[] {
  return [
    {
      sourceType: 'web_ops_events',
      status: input.opsEventsSummary ? 'available' : 'missing',
      itemCount: countItems(input.opsEventsSummary),
      limitation: input.opsEventsSummary ? undefined : '최근 시스템 오류 기록이 없어 readiness와 화면 구조 중심으로 판단했습니다.',
    },
    {
      sourceType: 'quality_meta',
      status: input.qualityMetaSnapshots?.length ? 'available' : 'missing',
      itemCount: input.qualityMetaSnapshots?.length ?? 0,
      limitation: input.qualityMetaSnapshots?.length ? undefined : 'Today/Research 품질 스냅샷이 이번 분석 입력에 없습니다.',
    },
    {
      sourceType: 'sql_readiness',
      status: input.sqlReadinessSummary ? 'available' : 'missing',
      itemCount: countItems(input.sqlReadinessSummary),
    },
    {
      sourceType: 'runbook_result',
      status: input.runbookStatus ? 'available' : 'missing',
      limitation: input.runbookStatus ? undefined : '최근 Runbook 실행 결과는 사용하지 않았습니다.',
    },
    {
      sourceType: 'user_feedback',
      status: input.userFeedbackSignals?.length ? 'available' : 'missing',
      itemCount: input.userFeedbackSignals?.length ?? 0,
    },
    {
      sourceType: 'screen_flow',
      status: input.mobileUxSignals?.length ? 'available' : 'partial',
      itemCount: input.mobileUxSignals?.length ?? 0,
      limitation: '실제 클릭률/체류시간 데이터가 아니라 화면 구조와 모바일 흐름 신호 기준입니다.',
    },
    {
      sourceType: 'pb_memory',
      status: input.pbMemorySignals?.length ? 'partial' : 'missing',
      itemCount: input.pbMemorySignals?.length ?? 0,
      limitation: 'PB memory는 투자 성향 근거이므로 시스템 UX 판단에는 과도하게 사용하지 않습니다.',
    },
  ];
}

export function buildSystemAnalystRecommendations(insights: SystemAnalystInsight[]): SystemAnalystRecommendation[] {
  return insights.slice(0, 3).map((insight) => ({
    id: `sys-${insight.area}-${insight.priority}`,
    title: insight.area === 'home_ux' ? '홈 대화 흐름 우선순위 정리' : '운영 상태 compact 유지',
    priority: insight.priority === 1 ? 'p1' : 'p2',
    area: insight.area,
    userPain: insight.userPain,
    evidence: insight.evidence,
    suggestedChange: insight.recommendedFix,
    expectedUserImpact: '홈에서 투자 대화와 운영 점검을 혼동하지 않게 됩니다.',
    status: 'suggested',
    writeAction: false,
  }));
}
