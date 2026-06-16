import type { PbDailyConversationSummary } from '@office-unify/shared-types';

export type UserInvestmentMemory = {
  title?: string;
  content?: string;
  memoryType?: string;
  relatedSymbols?: string[];
  relatedThemes?: string[];
};

export type JuniorAnalystDailyBrief = {
  status: 'ready' | 'needs_pb_checkin' | 'degraded';
  headline: string;
  keyObservation: string;
  freshQuestion: string;
  riskToEscalateToPb: string;
  oneLineOpinion: string;
  usedSources: string[];
  guardrail: {
    notTradeInstruction: true;
    noAutoOrder: true;
  };
};

export type JuniorAnalystPostPbFollowup = {
  status: 'ready' | 'degraded';
  changedSinceMorning: boolean;
  updatedObservation: string;
  updatedQuestion: string;
  riskToEscalate: string;
  oneLineOpinion: string;
  usedSources: string[];
  guardrail: {
    notTradeInstruction: true;
    noAutoOrder: true;
  };
};

function uniq(values: string[], limit = 4): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, limit);
}

function hasUnsafeDirective(text: string): boolean {
  return /매수하세요|팔아야\s*합니다|지금\s*들어가세요|자동\s*주문|자동\s*리밸런싱/i.test(text);
}

export function buildJuniorAnalystMorningBrief(input: {
  recentPbDailyConversations: PbDailyConversationSummary[];
  userInvestmentMemories: UserInvestmentMemory[];
  todayCandidatesSummary?: unknown;
  sectorRadarSummary?: unknown;
  openActionItems?: unknown[];
  researchFollowups?: unknown[];
}): JuniorAnalystDailyBrief {
  const latestPb = input.recentPbDailyConversations[0];
  const themes = uniq([
    ...(latestPb?.themes ?? []),
    ...input.userInvestmentMemories.flatMap((m) => m.relatedThemes ?? []),
  ]);
  const symbols = uniq([
    ...(latestPb?.symbols ?? []),
    ...input.userInvestmentMemories.flatMap((m) => m.relatedSymbols ?? []),
  ]);
  const usedSources = [
    input.recentPbDailyConversations.length ? 'pb_daily_conversations' : '',
    input.userInvestmentMemories.length ? 'user_investment_memory' : '',
    input.todayCandidatesSummary ? 'today_candidates' : '',
    input.sectorRadarSummary ? 'sector_radar' : '',
    input.openActionItems?.length ? 'action_items' : '',
    input.researchFollowups?.length ? 'research_followups' : '',
  ].filter(Boolean);

  if (!latestPb && input.userInvestmentMemories.length === 0) {
    return {
      status: 'needs_pb_checkin',
      headline: '오늘은 아직 대화 기록이 부족합니다.',
      keyObservation: 'PB 체크인을 하면 오늘의 관심 종목, 행동 의도, 불안 요인을 기준으로 요약할 수 있습니다.',
      freshQuestion: '오늘 가장 신경 쓰이는 종목이나 섹터는 무엇인가요?',
      riskToEscalateToPb: '데이터가 부족하므로 PB가 먼저 3문항 체크인으로 판단 맥락을 잡아야 합니다.',
      oneLineOpinion: '오늘은 짧은 체크인부터 시작하면 좋겠습니다.',
      usedSources,
      guardrail: { notTradeInstruction: true, noAutoOrder: true },
    };
  }

  const themeText = themes.length ? themes.join(', ') : '최근 관심 테마';
  const symbolText = symbols.length ? symbols.join(', ') : '관심 종목';
  const actionText = latestPb?.actionCategory === 'add_buy' ? '추가매수 유혹' : '행동 의도';
  const brief: JuniorAnalystDailyBrief = {
    status: usedSources.length ? 'ready' : 'degraded',
    headline: `오늘의 핵심은 ${themeText}와 ${actionText} 구분입니다.`,
    keyObservation: `최근 맥락은 ${symbolText}를 단기 가격보다 thesis와 확인 기준으로 보려는 흐름에 가깝습니다.`,
    freshQuestion: '지금 불안한 이유가 thesis 훼손 때문인지, 기회를 놓칠까 봐 생기는 조급함인지 나눠보면 어떨까요?',
    riskToEscalateToPb: '강한 테마 확신이 행동을 앞당길 수 있으니 PB가 확인 기준과 보류 조건을 먼저 잡아야 합니다.',
    oneLineOpinion: '오늘은 “살까 말까”보다 “내 thesis가 아직 살아있는지”를 확인하는 날에 가깝습니다.',
    usedSources,
    guardrail: { notTradeInstruction: true, noAutoOrder: true },
  };
  const joined = Object.values(brief).join('\n');
  if (hasUnsafeDirective(joined)) {
    return {
      ...brief,
      status: 'degraded',
      headline: '주니어 애널리스트 메모가 정책 점검으로 축약되었습니다.',
      oneLineOpinion: '오늘은 PB가 확인 기준을 먼저 정리해야 합니다.',
    };
  }
  return brief;
}

export const buildJuniorAnalystDailyBrief = buildJuniorAnalystMorningBrief;

export function buildJuniorAnalystPostPbFollowup(input: {
  morningBrief: JuniorAnalystDailyBrief;
  pbConversationSummary: PbDailyConversationSummary;
  promotedMemories: UserInvestmentMemory[];
  todayCandidatesSummary?: unknown;
  openActionItems?: unknown[];
}): JuniorAnalystPostPbFollowup {
  const themes = uniq([
    ...input.pbConversationSummary.themes,
    ...input.promotedMemories.flatMap((memory) => memory.relatedThemes ?? []),
  ]);
  const symbols = uniq([
    ...input.pbConversationSummary.symbols,
    ...input.promotedMemories.flatMap((memory) => memory.relatedSymbols ?? []),
  ]);
  const actionText = input.pbConversationSummary.actionCategory === 'add_buy'
    ? '추가매수 여부'
    : input.pbConversationSummary.actionCategory === 'research'
      ? '리서치 필요성'
      : '오늘의 행동 의도';
  const morningWasPriceFocused = /가격|하락|불안/.test(input.morningBrief.keyObservation);
  const changedSinceMorning =
    morningWasPriceFocused ||
    !input.morningBrief.keyObservation.includes(input.pbConversationSummary.userIntent.slice(0, 8));
  const usedSources = [
    'pb_daily_conversations',
    'junior_morning_brief',
    input.promotedMemories.length ? 'user_investment_memory' : '',
    input.todayCandidatesSummary ? 'today_candidates' : '',
    input.openActionItems?.length ? 'action_items' : '',
  ].filter(Boolean);
  const subject = themes[0] ?? symbols[0] ?? '오늘 관심 주제';
  const followup: JuniorAnalystPostPbFollowup = {
    status: usedSources.length ? 'ready' : 'degraded',
    changedSinceMorning,
    updatedObservation: changedSinceMorning
      ? `아침에는 가격/불안 관찰이 앞섰지만, PB 대화 후에는 ${subject}에서 ${actionText}를 확인 기준과 분리하는 쪽이 더 중요해 보입니다.`
      : `PB 대화 후에도 ${subject}에 대한 확인 기준 정리가 중심입니다.`,
    updatedQuestion: '오늘 행동을 바로 정하기보다, 어떤 조건이 확인되면 판단을 다시 열지 기준을 먼저 써볼까요?',
    riskToEscalate: '주니어 관찰은 PB 결론을 뒤집지 않으며, PB가 보류 조건과 다음 확인 항목을 최종 정리해야 합니다.',
    oneLineOpinion: '오늘은 결론보다 대화 전후로 무엇이 더 중요해졌는지를 남기는 날에 가깝습니다.',
    usedSources,
    guardrail: { notTradeInstruction: true, noAutoOrder: true },
  };
  const joined = Object.values(followup).join('\n');
  if (hasUnsafeDirective(joined)) {
    return {
      ...followup,
      status: 'degraded',
      updatedObservation: '후속 의견은 PB의 확인 기준 정리로 축약되었습니다.',
      oneLineOpinion: 'PB가 판단 구조를 먼저 정리해야 합니다.',
    };
  }
  return followup;
}
