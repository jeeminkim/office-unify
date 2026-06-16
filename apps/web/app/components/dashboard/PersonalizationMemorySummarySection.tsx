"use client";

import Link from "next/link";
import type { CommandCenterPersonalizationSummary } from "@/lib/commandCenterPolicy";

type Props = {
  personalization?: CommandCenterPersonalizationSummary;
};

export function PersonalizationMemorySummarySection({ personalization }: Props) {
  const repeated = personalization?.repeatedPatternCount ?? personalization?.repeatedPatternsCount ?? 0;
  const open = personalization?.openActionItemCount ?? 0;
  const blockers = personalization?.dataBlockerCount ?? 0;

  return (
    <section className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-indigo-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">최근 개인화 맥락</h2>
          <p className="mt-0.5 text-xs">
            관심 테마는 PB 기억과 최근 대화에서 보강됩니다 · 반복 패턴 {repeated} · 열린 작업 {open} · blocker {blockers}
          </p>
          <p className="mt-1 text-[11px] text-indigo-800">
            추천 강화가 아니라 리스크 확인과 복기 관점에만 사용됩니다.
          </p>
        </div>
        <Link href="/private-banker?showMemory=1" className="rounded border border-indigo-200 bg-white px-2 py-1 text-xs font-medium">
          최근 기억 보기
        </Link>
      </div>
    </section>
  );
}
