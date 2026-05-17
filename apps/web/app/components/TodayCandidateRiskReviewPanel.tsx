"use client";

import Link from "next/link";
import { useState } from "react";
import type { TodayCandidateRiskReviewAction } from "@office-unify/shared-types";
import type { TodayStockCandidate } from "@/lib/todayCandidatesContract";
import { riskReviewChecklistItems } from "@/lib/todayCandidateUiCopy";

type Props = {
  candidate: TodayStockCandidate;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onRetroSaved?: (message: string) => void;
};

function findAction(c: TodayStockCandidate, key: TodayCandidateRiskReviewAction["actionKey"]) {
  return c.riskReviewActions?.find((a) => a.actionKey === key);
}

export function TodayCandidateRiskReviewPanel({ candidate, panelOpen, onTogglePanel, onRetroSaved }: Props) {
  const [retroBusy, setRetroBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  const reportHref =
    findAction(candidate, "view_report_history")?.href ??
    findAction(candidate, "generate_research_report")?.href;
  const journalHref = findAction(candidate, "create_trade_journal_seed")?.href;

  const saveRetro = async () => {
    if (!window.confirm("Today Candidate 리스크 점검 내용을 판단 복기 초안으로 저장할까요? (자동 주문 없음)")) {
      return;
    }
    setRetroBusy(true);
    setLocalMsg(null);
    try {
      const res = await fetch("/api/decision-retrospectives/from-today-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ candidate }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; deduped?: boolean };
      if (!res.ok) {
        setLocalMsg(j.error ?? "저장 실패");
        return;
      }
      const msg = j.deduped ? "이미 복기 항목이 있습니다." : "판단 복기 초안을 저장했습니다.";
      setLocalMsg(msg);
      onRetroSaved?.(msg);
    } catch (e: unknown) {
      setLocalMsg(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setRetroBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-950"
          onClick={onTogglePanel}
        >
          {panelOpen ? "리스크 점검 접기" : "리스크 점검하기"}
        </button>
        {reportHref ? (
          <Link
            href={reportHref}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-center text-[11px] text-slate-800"
          >
            리포트 확인
          </Link>
        ) : null}
        <button
          type="button"
          disabled={retroBusy}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 disabled:opacity-50"
          onClick={() => void saveRetro()}
        >
          {retroBusy ? "저장 중…" : "복기로 남기기"}
        </button>
        {journalHref ? (
          <Link
            href={journalHref}
            className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-center text-[11px] text-violet-950"
          >
            관찰 메모
          </Link>
        ) : null}
      </div>
      {localMsg ? <p className="text-[10px] text-emerald-800">{localMsg}</p> : null}
      {panelOpen ? (
        <div className="rounded border border-rose-200 bg-rose-50/60 p-2 text-[10px] text-rose-950">
          <p className="font-semibold">지금 확인할 것</p>
          {candidate.corporateActionRisk?.active ? (
            <p className="mt-1">{candidate.corporateActionRisk.headline}</p>
          ) : null}
          {(candidate.decisionTrace?.downgradeReasons ?? []).length > 0 ? (
            <p className="mt-1 text-rose-900">
              감점·주의:{" "}
              {(candidate.decisionTrace?.downgradeReasons ?? [])
                .slice(0, 4)
                .map((r) => r.labelKo)
                .join(" · ")}
            </p>
          ) : null}
          {(candidate.decisionTrace?.doNotDo ?? []).length > 0 ? (
            <p className="mt-1 font-medium">지금 하면 안 되는 것</p>
          ) : null}
          {(candidate.decisionTrace?.doNotDo ?? []).length > 0 ? (
            <ul className="mt-0.5 list-inside list-disc">
              {(candidate.decisionTrace?.doNotDo ?? []).map((x, i) => (
                <li key={`dnd-${i}`}>{x}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-1 font-medium">다음 확인 체크리스트</p>
          <ul className="mt-0.5 list-inside list-disc">
            {riskReviewChecklistItems(candidate).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1">
            {(candidate.riskReviewActions ?? [])
              .filter((a) => a.deferred)
              .map((a) => (
                <span
                  key={a.actionKey}
                  title={a.description}
                  className="cursor-not-allowed rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500"
                >
                  {a.label} (후속)
                </span>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
