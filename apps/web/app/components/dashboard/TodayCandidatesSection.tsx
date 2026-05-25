"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Dashboard keeps candidate composition; this section only owns the section framing. */
export function TodayCandidatesSection({ children }: Props) {
  return (
    <div className="today-candidates-section">
      <p className="mt-3 text-xs font-semibold text-violet-950">오늘 확인할 후보</p>
      <p className="mt-0.5 text-[10px] text-violet-800/90">
        관찰 후보와 신규 판단 전 확인 필요한 리스크를 구분해 봅니다.
      </p>
      {children}
    </div>
  );
}
