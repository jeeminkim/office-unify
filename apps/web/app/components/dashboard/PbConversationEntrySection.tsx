"use client";

import Link from "next/link";

export function PbConversationEntrySection() {
  return (
    <section className="mb-4 rounded-xl border border-slate-900 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PB Conversation Entry</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">오늘 PB에게 말해볼 것</h2>
          <p className="mt-1 text-sm text-slate-600">
            오늘 투자 판단을 시작하려면 아래 중 하나를 선택하세요. 데이터 점검은 필요할 때만 아래에서 확인하면 됩니다.
          </p>
          <p className="mt-3 text-sm font-medium text-slate-800">오늘은 짧게 3가지만 말해도 됩니다.</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs leading-relaxed text-slate-600">
            <li>오늘 신경 쓰이는 종목/섹터</li>
            <li>지금 하고 싶은 행동</li>
            <li>그 이유와 불안한 점</li>
          </ol>
        </div>
        <div className="grid shrink-0 gap-2 text-sm sm:grid-cols-3 md:min-w-[460px]">
          <Link
            href="/private-banker?mode=daily_checkin"
            className="rounded border border-slate-900 bg-slate-900 px-3 py-2 text-center font-semibold text-white"
          >
            PB와 3문항 체크인
          </Link>
          <Link
            href="/private-banker?mode=freeform"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-center font-medium text-slate-800"
          >
            그냥 자유롭게 말하기
          </Link>
          <Link
            href="/private-banker?showMemory=1"
            className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-center font-medium text-emerald-950"
          >
            최근 기억 보고 시작
          </Link>
        </div>
      </div>
    </section>
  );
}
