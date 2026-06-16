"use client";

import Link from "next/link";
import type { DailyInvestmentConversationState } from "@/lib/dailyInvestmentConversationModel";
import type { DailyInvestmentActivitySummary } from "@/lib/server/dailyInvestmentActivitySummary";
import type { JuniorAnalystDailyBrief, JuniorAnalystPostPbFollowup } from "@/lib/server/juniorAnalystDailyBrief";

type Props = {
  state?: DailyInvestmentConversationState | null;
  morningBrief?: JuniorAnalystDailyBrief | null;
  postPbFollowup?: JuniorAnalystPostPbFollowup | null;
  activitySummary?: DailyInvestmentActivitySummary | null;
  memorySummary?: {
    repeatedPatternCount?: number;
    repeatedPatternsCount?: number;
    openActionItemCount?: number;
    dataBlockerCount?: number;
  };
};

function phaseCopy(
  state?: DailyInvestmentConversationState | null,
  morningBrief?: JuniorAnalystDailyBrief | null,
  postPbFollowup?: JuniorAnalystPostPbFollowup | null,
) {
  if (!state || state.phase === "not_started") {
    return {
      eyebrow: "Daily Conversation",
      title: "오늘 아직 투자 대화를 시작하지 않았습니다.",
      body: "주니어 애널리스트가 오늘의 관찰 포인트를 준비했습니다. PB에게 현재 생각과 불안한 점을 말하면 오늘의 판단 메모로 정리됩니다.",
    };
  }
  if (state.phase === "morning_brief_ready") {
    return {
      eyebrow: "오늘 주니어 관찰",
      title: morningBrief?.headline ?? "오늘의 관찰 포인트가 준비되었습니다.",
      body: morningBrief?.freshQuestion ?? state.morningBrief.freshQuestion ?? "현재 불안이 thesis 훼손 때문인지, 가격 하락 때문인지 구분해볼 필요가 있습니다.",
    };
  }
  if (state.phase === "daily_summary_ready") {
    return {
      eyebrow: "오늘의 판단 정리",
      title: state.dailySummary.mainConcern ?? "오늘의 판단 메모가 정리되었습니다.",
      body: [
        state.dailySummary.confirmedThesis?.length ? `확인한 것: ${state.dailySummary.confirmedThesis.join(" · ")}` : "",
        state.dailySummary.deferredActions?.length ? `보류한 것: ${state.dailySummary.deferredActions.join(" · ")}` : "",
        state.dailySummary.nextCheckpoints?.length ? `다음 확인: ${state.dailySummary.nextCheckpoints.join(" · ")}` : "",
        state.dailySummary.learning ? `오늘의 학습: ${state.dailySummary.learning}` : "",
      ].filter(Boolean).join("\n"),
    };
  }
  return {
    eyebrow: state.phase === "analyst_followup_ready" ? "주니어 후속 의견 준비" : "오늘 PB 대화 정리 완료",
    title: state.pbCheckin.summary ?? "오늘 PB 대화가 정리되었습니다.",
    body: [
      state.morningBrief.keySymbols.length ? `관심: ${state.morningBrief.keySymbols.join(" · ")}` : "",
      state.morningBrief.keyThemes.length ? `테마: ${state.morningBrief.keyThemes.join(" · ")}` : "",
      state.pbCheckin.actionCategory ? `행동 의도: ${state.pbCheckin.actionCategory}` : "",
      postPbFollowup?.updatedObservation ?? "주니어 애널리스트가 대화 전후 관점 변화를 정리하고 있습니다.",
    ].filter(Boolean).join("\n"),
  };
}

export function DailyConversationLoopSection({ state, morningBrief, postPbFollowup, activitySummary, memorySummary }: Props) {
  const copy = phaseCopy(state, morningBrief, postPbFollowup);
  const repeated = memorySummary?.repeatedPatternCount ?? memorySummary?.repeatedPatternsCount ?? 0;
  const open = memorySummary?.openActionItemCount ?? 0;
  const blockers = memorySummary?.dataBlockerCount ?? 0;

  return (
    <section id="daily-conversation" className="mb-4 rounded-xl border border-slate-900 bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{copy.eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">오늘의 투자 대화</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-800">{copy.title}</p>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{copy.body}</p>
        </div>
        <div className="grid shrink-0 gap-2 text-sm sm:grid-cols-3 md:min-w-[460px]">
          {state?.phase === "daily_summary_ready" ? (
            <>
              <Link href="#today-brief" className="rounded border border-slate-900 bg-slate-900 px-3 py-2 text-center font-semibold text-white">오늘 기록 자세히</Link>
              <Link href="/private-banker?showMemory=1" className="rounded border border-slate-300 bg-white px-3 py-2 text-center font-medium text-slate-800">내일 이어서 보기</Link>
              <Link href="/decision-journal" className="rounded border border-violet-200 bg-violet-50 px-3 py-2 text-center font-medium text-violet-950">복기 보기</Link>
            </>
          ) : state?.pbCheckin.completed ? (
            <>
              <Link href="/private-banker" className="rounded border border-slate-900 bg-slate-900 px-3 py-2 text-center font-semibold text-white">PB 대화 보기</Link>
              <Link href="#daily-conversation-followup" className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-center font-medium text-emerald-950">주니어 후속 의견 보기</Link>
              <Link href="/research-center" className="rounded border border-slate-300 bg-white px-3 py-2 text-center font-medium text-slate-800">Research로 이어가기</Link>
            </>
          ) : (
            <>
              <Link href="#daily-conversation-followup" className="rounded border border-slate-300 bg-white px-3 py-2 text-center font-medium text-slate-800">오늘의 관찰 먼저 보기</Link>
              <Link href="/private-banker?mode=daily_checkin" className="rounded border border-slate-900 bg-slate-900 px-3 py-2 text-center font-semibold text-white">PB와 3문항 체크인</Link>
              <Link href="/private-banker?mode=freeform" className="rounded border border-slate-300 bg-white px-3 py-2 text-center font-medium text-slate-800">자유롭게 말하기</Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
        <Link href="/private-banker?showMemory=1" className="rounded border border-indigo-100 bg-indigo-50 px-3 py-2 text-indigo-950">
          <span className="font-semibold">최근 기억</span>
          <span className="mt-0.5 block text-indigo-800">반복 {repeated} · 열린 작업 {open} · blocker {blockers}</span>
        </Link>
        <details id="daily-conversation-followup" className="rounded border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-950">
          <summary className="cursor-pointer font-semibold">주니어 의견</summary>
          <p className="mt-1 text-emerald-900">
            {postPbFollowup?.updatedObservation ?? morningBrief?.keyObservation ?? "PB 체크인을 하면 대화 전후 관점 차이를 남깁니다."}
          </p>
        </details>
        <Link href="#today-brief" className="rounded border border-violet-100 bg-violet-50 px-3 py-2 text-violet-950">
          <span className="font-semibold">오늘 요약</span>
          <span className="mt-0.5 block text-violet-800">{activitySummary?.headline ?? "오늘 기록이 아직 없습니다."}</span>
        </Link>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        이 흐름은 판단 구조화와 복기용입니다. 자동매매, 자동주문, 자동 리밸런싱, 관심종목 자동 등록은 하지 않습니다.
      </p>
    </section>
  );
}
