"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  ActionItemDetailJson,
  ActionItemDismissReason,
  ActionItemRecommendedLink,
  ActionItemRowDto,
  ActionItemStatus,
} from "@office-unify/shared-types";
import { parseActionItemDetailJson } from "@office-unify/shared-types";
import {
  buildJournalHrefFromActionItem,
  buildResearchHrefFromActionItem,
  buildRetrospectiveHrefFromActionItem,
} from "@/lib/actionItemLinks";
import { analyzeActionItemDetailCompleteness } from "@/lib/actionItemDetailCompleteness";
import { resolveActionItemSourceDisplay } from "@/lib/actionItemDisplayLabels";
import { ActionStepRunner } from "@/components/ActionStepRunner";
import { ActionIntentBadge } from "@/app/components/ActionIntentBadge";
import { PersonaCoachHint } from "@/app/components/PersonaCoachHint";

const DISMISS_OPTIONS: { value: ActionItemDismissReason; label: string }[] = [
  { value: "already_confirmed", label: "Already confirmed" },
  { value: "no_longer_relevant", label: "No longer relevant" },
  { value: "duplicate", label: "Duplicate" },
  { value: "insufficient_data", label: "Insufficient data" },
];

function statusBadge(status: ActionItemStatus): string {
  switch (status) {
    case "open":
      return "bg-sky-100 text-sky-900";
    case "in_progress":
      return "bg-indigo-100 text-indigo-900";
    case "done":
      return "bg-emerald-100 text-emerald-900";
    case "dismissed":
      return "bg-slate-200 text-slate-600";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function NavLink({ href, label, hint }: { href: string; label: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:min-w-[5rem]">
      <Link href={href} className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-center text-[10px]">
        {label}
      </Link>
      {hint ? <span className="text-[9px] text-slate-500">{hint}</span> : null}
    </div>
  );
}

function dedupeRecommendedLinks(links: ActionItemRecommendedLink[] | undefined): ActionItemRecommendedLink[] {
  const seen = new Set<string>();
  const out: ActionItemRecommendedLink[] = [];
  for (const link of links ?? []) {
    const key = link.actionKey ? `action:${link.actionKey}` : `href:${link.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link);
  }
  return out;
}

function DetailExpanded({
  detail,
  it,
  showMissingSteps,
  onStepDone,
}: {
  detail: ActionItemDetailJson;
  it: ActionItemRowDto;
  showMissingSteps: boolean;
  onStepDone?: (id: string, stepId: string) => void;
}) {
  return (
    <div className="mt-2 space-y-2 border-t pt-2 text-xs">
      {detail.decisionContext?.originalQuestion || detail.decisionContext?.sourceQuestion ? (
        <div>
          <p className="font-medium text-slate-800">??吏덈Ц</p>
          <p className="text-slate-600">
            {detail.decisionContext.originalQuestion ?? detail.decisionContext.sourceQuestion}
          </p>
        </div>
      ) : null}
      {detail.sourceRefs?.length ? (
        <div>
          <p className="font-medium text-slate-800">異쒖쿂</p>
          <ul className="mt-0.5 flex flex-wrap gap-1">
            {detail.sourceRefs.map((ref, i) => (
              <li key={i}>
                {ref.sourceHref ? (
                  <Link href={ref.sourceHref} className="rounded border bg-slate-50 px-1.5 py-0.5 text-[10px]">
                    {ref.label ?? ref.sourceType}
                    {ref.sourceId ? ` 쨌 ${ref.sourceId}` : ""}
                  </Link>
                ) : (
                  <span className="rounded border bg-slate-50 px-1.5 py-0.5 text-[10px]">
                    {ref.label ?? ref.sourceType}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {detail.confirmNow?.length ? (
        <div>
          <p className="font-medium text-slate-800">Confirm now</p>
          <ul className="mt-0.5 list-inside list-disc text-slate-700">
            {detail.confirmNow.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {detail.doNotDo?.length ? (
        <div>
          <p className="font-medium text-amber-950">Do not do</p>
          <p className="text-amber-900">{detail.doNotDo.join(" 쨌 ")}</p>
        </div>
      ) : null}
      {detail.guardrails?.length ? (
        <div>
          <p className="font-medium text-amber-950">하지 말아야 할 것</p>
          <ul className="mt-0.5 list-inside list-disc text-amber-900">
            {detail.guardrails.map((guardrail) => (
              <li key={guardrail.id}>
                <span>{guardrail.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {detail.evidenceNeeded?.length ? (
        <div>
          <p className="font-medium text-slate-800">?꾩슂??利앷굅</p>
          <p className="text-slate-600">{detail.evidenceNeeded.join(", ")}</p>
        </div>
      ) : null}
      {detail.decisionContext?.sourceSummary || detail.sourceSummary ? (
        <div>
          <p className="font-medium text-slate-800">?먮낯 ?붿빟</p>
          <p className="text-slate-600">{detail.decisionContext?.sourceSummary ?? detail.sourceSummary}</p>
        </div>
      ) : null}
      {detail.checklist?.length ? (
        <ul className="list-inside list-disc text-slate-700">
          {detail.checklist.map((c, i) => (
            <li key={i}>{c.label}</li>
          ))}
        </ul>
      ) : null}
      {showMissingSteps ? (
        <p className="text-[10px] text-amber-800">맥락 보강 필요 · 이 작업은 원본으로 돌아가 확인해야 합니다.</p>
      ) : null}
      <ActionStepRunner
        actionItemId={it.id}
        detail={detail}
        onStepDone={onStepDone ? (stepId) => onStepDone(it.id, stepId) : undefined}
      />
    </div>
  );
}

export function ActionItemCard({
  it,
  patchingId,
  onPatch,
  onStepDone,
}: {
  it: ActionItemRowDto;
  patchingId: string | null;
  onPatch: (id: string, status: ActionItemStatus, dismissReason?: ActionItemDismissReason) => void;
  onStepDone?: (id: string, stepId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const detail = parseActionItemDetailJson(it.detail_json);
  const completeness = analyzeActionItemDetailCompleteness(detail);
  const recommendedLinks = dedupeRecommendedLinks(detail.recommendedNextLinks);
  const sourceDisplay = resolveActionItemSourceDisplay(it, detail);
  const nextTask = detail.confirmNow?.[0] ?? detail.checklist?.[0]?.label ?? "?먮낯 留λ씫???뺤씤?⑸땲??";
  const showWeakBadge = completeness.level !== "full";
  const showMissingSteps =
    completeness.missingFields.includes("actionSteps") && (detail.actionSteps?.length ?? 0) === 0;

  const researchHref =
    recommendedLinks.find((l) => l.kind === "research")?.href ??
    buildResearchHrefFromActionItem({
      actionItemId: it.id,
      symbol: it.symbol ?? detail.symbol,
      name: detail.name,
      market: detail.market,
      question: detail.decisionContext?.originalQuestion ?? detail.decisionContext?.sourceQuestion,
      checklist: detail.checklist?.map((c) => c.label),
      riskFlags: detail.decisionContext?.riskFlags,
      seedNote: detail.whyCreated,
    });

  const journalHref =
    recommendedLinks.find((l) => l.kind === "journal")?.href ??
    buildJournalHrefFromActionItem({
      actionItemId: it.id,
      symbol: it.symbol ?? detail.symbol,
      market: detail.market,
      seedNote: detail.whyCreated,
    });

  const retroHref =
    recommendedLinks.find((l) => l.kind === "retrospective")?.href ??
    buildRetrospectiveHrefFromActionItem({
      actionItemId: it.id,
      symbol: it.symbol ?? detail.symbol,
      summary: detail.sourceSummary,
    });

  const portfolioHref =
    recommendedLinks.find((l) => l.kind === "portfolio")?.href ??
    (it.symbol ? `/portfolio/${encodeURIComponent(it.symbol)}` : "/portfolio");

  const pbHref = recommendedLinks.find((l) => l.kind === "pb")?.href ?? "/private-banker";
  const committeeHref =
    recommendedLinks.find((l) => l.kind === "committee")?.href ?? "/committee-discussion";

  const extraLinks = recommendedLinks.filter(
    (l) => !["research", "journal", "retrospective", "portfolio", "pb", "committee"].includes(l.kind),
  );

  return (
    <li className="w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{it.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
            <span className="shrink-0">{sourceDisplay}</span>
            {showWeakBadge ? (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-900">
                留λ씫 蹂닿컯 ?꾩슂
              </span>
            ) : null}
            {it.symbol ? <span className="shrink-0">쨌 {it.symbol}</span> : null}
            {detail.name && detail.name !== it.symbol ? (
              <span className="shrink-0">쨌 {detail.name}</span>
            ) : null}
            <span className="shrink-0">
              쨌 {it.priority} / {it.status}
            </span>
          </p>
          {detail.whyCreated ? <p className="mt-1 text-xs text-slate-600 line-clamp-2">{detail.whyCreated}</p> : null}
          <p className="mt-1 text-xs font-medium text-violet-900">?ㅼ쓬: {nextTask}</p>
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium ${statusBadge(it.status)}`}>
          {it.status}
        </span>
      </div>

      <button
        type="button"
        className="mt-2 text-[10px] font-medium text-violet-800 underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "Details"}
      </button>

      {open ? (
        <>
          <PersonaCoachHint role="action_secretary" className="mt-2" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ActionIntentBadge intent="navigate_only" compact />
            <ActionIntentBadge intent="save_to_inbox" compact />
            <ActionIntentBadge intent="feedback_update" compact />
          </div>
          <DetailExpanded detail={detail} it={it} showMissingSteps={showMissingSteps} onStepDone={onStepDone} />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <NavLink href={researchHref} label="Research" hint="Open context in Research" />
            <NavLink href={pbHref} label="PB" />
            <NavLink href={committeeHref} label="Committee" />
            <NavLink href={journalHref} label="Journal" />
            <NavLink href={retroHref} label="蹂듦린" />
            <Link href={portfolioHref} className="rounded border px-2 py-1 text-center text-[10px] sm:self-start">
              Portfolio
            </Link>
            {it.source_href && !detail.sourceRefs?.some((r) => r.sourceHref === it.source_href) ? (
              <Link href={it.source_href} className="rounded border px-2 py-1 text-center text-[10px] sm:self-start">
                ?먮낯 蹂닿린
              </Link>
            ) : null}
            {extraLinks?.map((l, i) => (
              <Link
                key={`extra-${i}`}
                href={l.href}
                className="rounded border px-2 py-1 text-center text-[10px] sm:self-start"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <div className="mt-2 flex flex-col gap-1 sm:flex-row">
        {it.status !== "done" ? (
          <button
            type="button"
            disabled={patchingId === it.id}
            className="rounded bg-emerald-700 px-3 py-1.5 text-[11px] text-white disabled:opacity-50"
            onClick={() => {
              if (window.confirm("???묒뾽???꾨즺濡??쒖떆?좉퉴?? 留ㅻℓ媛 ?ㅽ뻾?섏????딆뒿?덈떎.")) {
                onPatch(it.id, "done");
              }
            }}
          >
            ?꾨즺
          </button>
        ) : null}
        {it.status !== "dismissed" ? (
          <button
            type="button"
            disabled={patchingId === it.id}
            className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-50"
            onClick={() => setDismissOpen((v) => !v)}
          >
            蹂대쪟
          </button>
        ) : null}
      </div>

      {dismissOpen ? (
        <div className="mt-2 flex flex-col gap-1 rounded border bg-slate-50 p-2">
          {DISMISS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className="rounded border bg-white px-2 py-1 text-left text-[10px]"
              onClick={() => {
                onPatch(it.id, "dismissed", o.value);
                setDismissOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
