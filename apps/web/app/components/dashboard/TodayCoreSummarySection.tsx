"use client";

import Link from "next/link";

type Props = {
  title?: string;
  summary?: string;
  sourceLabel?: string;
};

export function TodayCoreSummarySection({ title, summary, sourceLabel }: Props) {
  if (!title || !summary) return null;

  return (
    <section className="mb-4 rounded-lg border border-violet-100 bg-violet-50/50 px-4 py-3 text-sm text-violet-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Today Core</p>
          <h2 className="text-sm font-semibold">오늘의 핵심 · {title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-violet-900">{summary}</p>
          {sourceLabel ? <p className="mt-1 text-[11px] text-violet-700">근거: {sourceLabel}</p> : null}
        </div>
        <Link href="#today-brief" className="rounded border border-violet-200 bg-white px-2 py-1 text-xs font-medium">
          자세히 보기
        </Link>
      </div>
    </section>
  );
}
