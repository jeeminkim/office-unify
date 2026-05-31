"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Dashboard keeps candidate composition; this section only owns the section framing. */
export function TodayCandidatesSection({ children }: Props) {
  return (
    <div className="today-candidates-section">
      <p className="mt-3 text-xs font-semibold text-violet-950">오늘의 관찰 큐</p>
      <p className="mt-0.5 text-[10px] text-violet-800/90">
        관찰 후보, 리스크 점검, 데이터 점검, 모니터링을 구분해 봅니다.
      </p>
      {children}
    </div>
  );
}
