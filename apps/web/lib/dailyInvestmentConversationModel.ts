import type { PbDailyConversationSummary } from '@office-unify/shared-types';
import type { JuniorAnalystDailyBrief, JuniorAnalystPostPbFollowup } from '@/lib/server/juniorAnalystDailyBrief';
import type { DailyInvestmentActivitySummary } from '@/lib/server/dailyInvestmentActivitySummary';

export type DailyInvestmentConversationPhase =
  | 'not_started'
  | 'morning_brief_ready'
  | 'pb_checkin_started'
  | 'pb_checkin_completed'
  | 'analyst_followup_ready'
  | 'daily_summary_ready';

export type DailyInvestmentConversationState = {
  phase: DailyInvestmentConversationPhase;
  todayDate: string;
  morningBrief: {
    status: 'ready' | 'degraded' | 'empty';
    headline?: string;
    keySymbols: string[];
    keyThemes: string[];
    freshQuestion?: string;
  };
  pbCheckin: {
    started: boolean;
    completed: boolean;
    templateType?: string;
    actionCategory?: string;
    conversationId?: string;
    summary?: string;
  };
  juniorFollowup: {
    status: 'not_ready' | 'ready' | 'degraded';
    changedSinceMorning: boolean;
    updatedObservation?: string;
    updatedQuestion?: string;
    riskToEscalate?: string;
  };
  dailySummary: {
    status: 'not_ready' | 'ready';
    mainConcern?: string;
    decisionIntent?: string;
    confirmedThesis?: string[];
    weakenedThesis?: string[];
    deferredActions?: string[];
    nextCheckpoints?: string[];
    learning?: string;
  };
  guardrails: {
    notTradeInstruction: true;
    noAutomaticOrder: true;
    noAutomaticRebalancing: true;
  };
};

export function getKstDateKey(now: Date | string | number = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(now));
}

function uniq(values: string[], limit = 5): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

export function buildDailyInvestmentConversationState(input: {
  todayDate?: string;
  now?: Date | string | number;
  morningBrief?: JuniorAnalystDailyBrief | null;
  pbConversation?: (PbDailyConversationSummary & { id?: string }) | null;
  postPbFollowup?: JuniorAnalystPostPbFollowup | null;
  dailyActivitySummary?: DailyInvestmentActivitySummary | null;
}): DailyInvestmentConversationState {
  const todayDate = input.todayDate ?? getKstDateKey(input.now);
  const morning = input.morningBrief;
  const pb = input.pbConversation;
  const followup = input.postPbFollowup;
  const summary = input.dailyActivitySummary;
  const morningStatus: 'ready' | 'degraded' | 'empty' =
    !morning || morning.status === 'needs_pb_checkin' ? 'empty' : morning.status === 'ready' ? 'ready' : 'degraded';
  const phase: DailyInvestmentConversationPhase =
    summary?.status === 'ready'
      ? 'daily_summary_ready'
      : followup?.status === 'ready'
        ? 'analyst_followup_ready'
        : pb
          ? 'pb_checkin_completed'
          : morningStatus === 'ready'
            ? 'morning_brief_ready'
            : 'not_started';

  return {
    phase,
    todayDate,
    morningBrief: {
      status: morningStatus,
      headline: morning?.headline,
      keySymbols: uniq(pb?.symbols ?? []),
      keyThemes: uniq(pb?.themes ?? []),
      freshQuestion: morning?.freshQuestion,
    },
    pbCheckin: {
      started: Boolean(pb),
      completed: Boolean(pb),
      templateType: pb?.templateType,
      actionCategory: pb?.actionCategory,
      conversationId: pb?.id,
      summary: pb?.userIntent,
    },
    juniorFollowup: {
      status: followup?.status ?? 'not_ready',
      changedSinceMorning: followup?.changedSinceMorning ?? false,
      updatedObservation: followup?.updatedObservation,
      updatedQuestion: followup?.updatedQuestion,
      riskToEscalate: followup?.riskToEscalate,
    },
    dailySummary: {
      status: summary?.status === 'ready' ? 'ready' : 'not_ready',
      mainConcern: summary?.mainConcern,
      decisionIntent: summary?.intendedAction,
      confirmedThesis: summary?.thesisStatus.maintained,
      weakenedThesis: summary?.thesisStatus.weakened,
      deferredActions: summary?.deferredAction,
      nextCheckpoints: summary?.nextCheckpoints,
      learning: summary?.learningSummary,
    },
    guardrails: {
      notTradeInstruction: true,
      noAutomaticOrder: true,
      noAutomaticRebalancing: true,
    },
  };
}
