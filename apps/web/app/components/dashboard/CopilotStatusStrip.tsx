"use client";

import Link from 'next/link';
import type { CopilotPrimaryAction, CopilotStatusCard } from '@/lib/copilotStatusModel';
import { copilotActionHref, copilotActionLabelKo } from '@/lib/copilotStatusModel';

type Props = {
  status: CopilotStatusCard;
  busy?: boolean;
  onPrimaryAction: (action: CopilotPrimaryAction) => void;
};

function tone(level: CopilotStatusCard['statusLevel']): string {
  switch (level) {
    case 'ready':
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-950';
    case 'running':
      return 'border-sky-200 bg-sky-50 text-sky-950';
    case 'blocked_needs_input':
      return 'border-red-200 bg-red-50 text-red-950';
    case 'needs_attention':
    case 'degraded_but_usable':
    default:
      return 'border-amber-200 bg-amber-50 text-amber-950';
  }
}

function SecondaryAction({ action }: { action: CopilotPrimaryAction }) {
  const href = copilotActionHref(action);
  const label = copilotActionLabelKo(action);
  if (!href) return null;
  return (
    <Link href={href} className="rounded border border-current/30 bg-white/70 px-2 py-1 text-[11px] font-medium">
      {label}
    </Link>
  );
}

export function CopilotStatusStrip({ status, busy, onPrimaryAction }: Props) {
  const primaryHref = copilotActionHref(status.primaryAction);
  const primaryDisabled = busy || status.primaryAction === 'none';

  return (
    <section className={`mb-5 rounded-xl border p-4 shadow-sm ${tone(status.statusLevel)}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">AI Copilot Flow</p>
          <h2 className="mt-0.5 break-keep text-base font-semibold">{status.titleKo}</h2>
          <p className="mt-1 max-w-3xl break-words text-sm leading-relaxed opacity-90">{status.messageKo}</p>
          <p className="mt-2 text-[11px] opacity-80">{status.noTradeGuardrailKo}</p>
          {status.requiresConfirm ? (
            <p className="mt-1 text-[11px] opacity-80">실행은 사용자가 누를 때만 진행되며 확인 경계를 유지합니다.</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap md:justify-end">
          {primaryHref ? (
            <Link href={primaryHref} className="rounded border border-current bg-white px-3 py-2 text-center text-sm font-semibold">
              {status.primaryActionLabelKo}
            </Link>
          ) : (
            <button
              type="button"
              disabled={primaryDisabled}
              onClick={() => onPrimaryAction(status.primaryAction)}
              className="rounded border border-current bg-white px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? '진행 중' : status.primaryActionLabelKo}
            </button>
          )}
          {(status.secondaryActions ?? []).map((action) => (
            <SecondaryAction key={action} action={action} />
          ))}
        </div>
      </div>
    </section>
  );
}
