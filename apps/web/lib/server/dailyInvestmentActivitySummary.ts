import type { PbDailyConversationSummary } from '@office-unify/shared-types';
import type { JuniorAnalystDailyBrief, JuniorAnalystPostPbFollowup, UserInvestmentMemory } from './juniorAnalystDailyBrief';

export type DailyInvestmentActivitySummary = {
  status: 'ready' | 'partial' | 'empty';
  headline: string;
  mainConcern?: string;
  discussedSymbols: string[];
  discussedThemes: string[];
  intendedAction?: string;
  deferredAction?: string[];
  thesisStatus: {
    maintained: string[];
    weakened: string[];
    unknown: string[];
  };
  nextCheckpoints: string[];
  completedActivities: string[];
  pendingActivities: string[];
  learningSummary?: string;
  usedSources: string[];
  guardrail: {
    notTradeInstruction: true;
    noAutomaticExecution: true;
  };
};

function uniq(values: string[], limit = 6): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

function actionLabel(action?: string): string | undefined {
  if (!action) return undefined;
  const map: Record<string, string> = {
    add_buy: '추가매수 전 확인',
    buy: '매수 전 확인',
    sell: '매도 전 점검',
    trim: '비중 축소 점검',
    hold: '관망',
    watch: '관찰',
    research: '리서치',
    review: '판단 정리',
    compare: '비교',
    no_action: '행동 없음',
  };
  return map[action] ?? action;
}

export function buildDailyInvestmentActivitySummary(input: {
  pbDailyConversation?: PbDailyConversationSummary | null;
  juniorMorningBrief?: JuniorAnalystDailyBrief | null;
  juniorFollowup?: JuniorAnalystPostPbFollowup | null;
  todayCandidateSummary?: unknown;
  openActionItems?: unknown[];
  completedActionItems?: unknown[];
  researchFollowups?: unknown[];
  promotedMemories?: UserInvestmentMemory[];
}): DailyInvestmentActivitySummary {
  const pb = input.pbDailyConversation;
  const usedSources = [
    pb ? 'pb_daily_conversations' : '',
    input.juniorMorningBrief ? 'junior_morning_brief' : '',
    input.juniorFollowup ? 'junior_post_pb_followup' : '',
    input.todayCandidateSummary ? 'today_candidates' : '',
    input.openActionItems?.length ? 'open_action_items' : '',
    input.completedActionItems?.length ? 'completed_action_items' : '',
    input.researchFollowups?.length ? 'research_followups' : '',
    input.promotedMemories?.length ? 'user_investment_memory' : '',
  ].filter(Boolean);

  if (!pb && usedSources.length === 0) {
    return {
      status: 'empty',
      headline: '오늘 기록이 아직 없습니다. PB와 짧은 체크인을 시작하면 오늘의 요약이 만들어집니다.',
      discussedSymbols: [],
      discussedThemes: [],
      thesisStatus: { maintained: [], weakened: [], unknown: [] },
      nextCheckpoints: [],
      completedActivities: [],
      pendingActivities: ['PB 3문항 체크인'],
      usedSources: [],
      guardrail: { notTradeInstruction: true, noAutomaticExecution: true },
    };
  }

  const symbols = uniq(pb?.symbols ?? []);
  const themes = uniq(pb?.themes ?? []);
  const intendedAction = actionLabel(pb?.actionCategory);
  const maintained = themes.length ? themes.map((theme) => `${theme} thesis 확인 필요`) : [];
  const deferredAction = pb?.actionCategory === 'add_buy' || pb?.actionCategory === 'buy' ? ['확인 기준 전 행동 보류'] : [];
  const nextCheckpoints = uniq(pb?.nextCheckpoints ?? []);

  return {
    status: pb ? 'ready' : 'partial',
    headline: pb
      ? `오늘의 판단 정리는 ${themes[0] ?? symbols[0] ?? '관심 주제'}와 ${intendedAction ?? '판단 정리'} 중심입니다.`
      : 'PB 대화 전 관찰과 열린 작업만으로 부분 요약했습니다.',
    mainConcern: pb?.userIntent,
    discussedSymbols: symbols,
    discussedThemes: themes,
    intendedAction,
    deferredAction,
    thesisStatus: {
      maintained,
      weakened: [],
      unknown: themes.length ? [] : ['오늘 핵심 thesis는 아직 명확하지 않습니다.'],
    },
    nextCheckpoints,
    completedActivities: pb ? ['PB daily conversation 정리'] : [],
    pendingActivities: [
      ...(nextCheckpoints.length ? nextCheckpoints.map((item) => `확인 필요: ${item}`) : []),
      ...((input.openActionItems?.length ?? 0) > 0 ? ['열린 Action Item 점검'] : []),
    ],
    learningSummary: pb
      ? '가격 하락, thesis 훼손, 행동 충동을 분리해서 확인 기준을 먼저 세웁니다.'
      : undefined,
    usedSources,
    guardrail: { notTradeInstruction: true, noAutomaticExecution: true },
  };
}
