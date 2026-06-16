"use client";

import Link from "next/link";
import type { JuniorAnalystDailyBrief } from "@/lib/server/juniorAnalystDailyBrief";

type Props = {
  brief?: JuniorAnalystDailyBrief | null;
  fallbackHeadline?: string;
};

export function JuniorAnalystMemoSection({ brief, fallbackHeadline }: Props) {
  const text =
    brief?.headline ??
    fallbackHeadline ??
    "오늘은 아직 대화 기록이 부족합니다. PB 체크인을 하면 오늘의 요약과 신선한 질문을 남깁니다.";

  return (
    <details className="mb-4 rounded-lg border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm">
      <summary className="cursor-pointer list-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Junior Analyst</p>
          <h2 className="text-sm font-semibold text-slate-950">주니어 애널리스트 메모</h2>
          <p className="mt-0.5 text-xs text-slate-600">{text}</p>
          <p className="mt-1 text-[11px] text-slate-500">PB가 최종 균형을 잡고, 주니어는 질문과 관찰만 제공합니다.</p>
        </div>
        <Link href="/private-banker?mode=daily_checkin" className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-950">
          오늘 의견 듣기
        </Link>
      </div>
      </summary>
      {brief ? (
        <div className="mt-3 grid gap-2 border-t border-emerald-100 pt-3 text-xs text-slate-700 md:grid-cols-2">
          <p><span className="font-semibold text-slate-900">오늘 제가 본 핵심:</span> {brief.keyObservation}</p>
          <p><span className="font-semibold text-slate-900">제가 던지고 싶은 질문:</span> {brief.freshQuestion}</p>
          <p><span className="font-semibold text-slate-900">PB에게 넘길 리스크:</span> {brief.riskToEscalateToPb}</p>
          <p><span className="font-semibold text-slate-900">오늘의 한 줄 의견:</span> {brief.oneLineOpinion}</p>
          <p className="md:col-span-2 text-[11px] text-slate-500">근거: {brief.usedSources.join(" · ") || "PB 체크인 필요"} · 매매 지시/자동 주문 없음</p>
        </div>
      ) : null}
    </details>
  );
}
