"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CandidateDisplaySlot } from "@office-unify/shared-types";
import { ActionIntentBadge } from "@/app/components/ActionIntentBadge";
import { buildDiagnosticDisplaySlotFromReason, type DiagnosticDisplaySlotViewModel } from "@/lib/actionReasonContract";

type Props = {
  children: ReactNode;
  deckContract?: {
    targetKrSlots?: number;
    filledKrSlots?: number;
    targetUsSlots?: number;
    filledUsSlots?: number;
    usDiagnosticSlotPresent?: boolean;
    usDiscoverySlotPresent?: boolean;
    usSlotFallbackReason?: string;
    krSlotFallbackReason?: string;
    deckContractStatus?: "ok" | "partial" | "degraded" | "degraded_with_discovery";
    actionHint?: string;
  };
  displaySlots?: CandidateDisplaySlot[];
};

const STATUS_LABEL: Record<NonNullable<Props["deckContract"]>["deckContractStatus"] & string, string> = {
  ok: "3-slot 정상",
  partial: "진단 카드 포함",
  degraded: "데이터 점검 필요",
  degraded_with_discovery: "관찰 후보 fallback",
};

function kindLabel(kind: CandidateDisplaySlot["kind"]): string {
  switch (kind) {
    case "candidate":
      return "관찰 후보";
    case "low_confidence_candidate":
      return "낮은 신뢰도";
    case "risk_review":
      return "리스크 점검";
    case "data_check":
      return "데이터 점검";
    case "us_diagnostic":
      return "미국 점검";
    case "insufficient_candidate":
      return "후보 부족";
    default:
      return "슬롯";
  }
}

function centralSlotView(slot: CandidateDisplaySlot): DiagnosticDisplaySlotViewModel | null {
  return slot.reasonCode
    ? buildDiagnosticDisplaySlotFromReason(slot.reasonCode, { title: slot.title, subtitle: slot.subtitle })
    : null;
}

function slotActionIntent(
  slot: CandidateDisplaySlot,
):
  | "local_only"
  | "read_only_check"
  | "navigate_only"
  | "disabled"
  | "external_manual_check"
  | "copy_only"
  | "confirmed_write"
  | "feedback_update"
  | "save_to_inbox"
  | "save_note" {
  if (!slot.reasonCode) return slot.primaryAction === "none" ? "local_only" : "read_only_check";
  return centralSlotView(slot)?.actionIntent ?? "read_only_check";
}

export function TodayCandidatesSection({ children, deckContract, displaySlots }: Props) {
  const targetKr = deckContract?.targetKrSlots ?? 2;
  const targetUs = deckContract?.targetUsSlots ?? 1;
  const filledKr = deckContract?.filledKrSlots ?? 0;
  const filledUs = deckContract?.filledUsSlots ?? 0;
  const status = deckContract?.deckContractStatus;
  const slots = displaySlots?.slice(0, 3) ?? [];

  return (
    <div id="today-candidates" className="today-candidates-section">
      <p className="mt-3 text-xs font-semibold text-violet-950">Today observation slots</p>
      <p className="mt-0.5 text-[10px] text-violet-800/90">
        오늘의 가격 데이터가 완전하지 않아도 관찰면을 비우지 않습니다. 후보를 강제로 만들지 않고 실제 후보,
        낮은 신뢰도 후보, 데이터 점검 카드, 리스크 점검 후보, 미국 관찰 후보를 구분해서 보여드립니다.
      </p>

      {deckContract ? (
        <div className="mt-2 rounded border border-violet-200 bg-white/80 p-2 text-[11px] text-violet-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              국내 {targetKr} + 미국 {targetUs} 슬롯 · 현재 국내 {filledKr} + 미국 {filledUs} · 카드 {slots.length}
            </p>
            {status ? <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px]">{STATUS_LABEL[status]}</span> : null}
          </div>
          <p className="mt-1 text-[10px] text-violet-900">
            {deckContract.actionHint ?? "후보가 부족하면 강제로 만들지 않고 진단 카드로 다음 확인 행동을 표시합니다."}
          </p>
          {filledUs < targetUs ? (
            <p className="mt-1 text-[10px] text-violet-900">
              미국 가격 후보가 부족합니다. 시세 상태, ticker mapping, US feed/provider를 확인하고, 부족하면 읽기 전용 미국 관찰 후보를 표시합니다.
            </p>
          ) : null}
          {deckContract.usDiscoverySlotPresent ? (
            <p className="mt-1 text-[10px] text-violet-900">
              미국 관찰 후보는 시세 미확인 상태이며 매수 추천이 아닙니다. 가격 판단 전에 최근 1주일 상승률,
              거래량 변화, 관련 뉴스, 한국장 연결 테마, 시세 확인 후 재평가를 차례로 확인하세요.
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
            <Link href="/ops/google-finance-setup" className="rounded border border-violet-200 bg-white px-2 py-1 text-violet-950">
              시세 상태 확인
            </Link>
            <Link href="/sector-radar" className="rounded border border-violet-200 bg-white px-2 py-1 text-violet-950">
              테마 보기
            </Link>
            <Link href="/research-center" className="rounded border border-violet-200 bg-white px-2 py-1 text-violet-950">
              Research로 이어가기
            </Link>
          </div>
          {slots.length > 0 ? (
            <div className="mt-2 grid gap-1 md:grid-cols-3">
              {slots.map((slot) => {
                const central = centralSlotView(slot);
                const title = central?.title ?? slot.title;
                const subtitle = central?.subtitle ?? slot.subtitle;
                const reasonLabel = central?.reasonLabelKo ?? slot.reasonLabelKo;
                const actionHint = central?.actionHintKo ?? slot.actionHintKo;
                const actionLabel = central?.primaryActionLabelKo ?? slot.primaryActionLabelKo;
                return (
                  <div key={slot.slotId} className="rounded border border-violet-100 bg-violet-50/70 px-2 py-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{title}</p>
                      <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[9px] text-violet-800">
                        {kindLabel(slot.kind)}
                      </span>
                    </div>
                    {subtitle ? <p className="mt-0.5 text-[10px] text-violet-900">{subtitle}</p> : null}
                    <p className="mt-1 text-[10px] text-violet-800">
                      {reasonLabel} · {actionHint}
                    </p>
                    <p className="mt-0.5 text-[9px] text-violet-700">
                      다음 행동: {actionLabel} · 거래 후보: {slot.isTradeCandidate ? "예" : "아니오"}
                    </p>
                    <div className="mt-1">
                      <ActionIntentBadge intent={slotActionIntent(slot)} compact />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}
