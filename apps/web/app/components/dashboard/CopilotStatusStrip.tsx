"use client";

import Link from 'next/link';
import type { CopilotPrimaryAction, CopilotStatusCard } from '@/lib/copilotStatusModel';
import { copilotActionHref, copilotActionLabelKo } from '@/lib/copilotStatusModel';

type Props = {
  status: CopilotStatusCard;
  busy?: boolean;
  onPrimaryAction: (action: CopilotPrimaryAction) => void;
  variant?: 'full' | 'compact';
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

export function CopilotStatusStrip({ status, busy, onPrimaryAction, variant = 'full' }: Props) {
  const primaryHref = copilotActionHref(status.primaryAction);
  const primaryDisabled = busy || status.primaryAction === 'none';
  const compact = variant === 'compact';

  return (
    <section className={`mb-4 rounded-lg border ${compact ? 'p-3 shadow-none' : 'p-4 shadow-sm'} ${tone(status.statusLevel)}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
            {compact ? '운영 상태 요약' : 'AI Copilot Flow'}
          </p>
          <h2 className={`${compact ? 'text-sm' : 'text-base'} mt-0.5 break-keep font-semibold`}>{status.titleKo}</h2>
          <p className={`${compact ? 'text-xs' : 'text-sm'} mt-1 max-w-3xl break-words leading-relaxed opacity-90`}>{status.messageKo}</p>
          {!compact ? <p className="mt-2 text-[11px] opacity-80">{status.noTradeGuardrailKo}</p> : null}
          {status.requiresConfirm ? (
            <p className="mt-1 text-[11px] opacity-80">실행은 사용자가 누를 때만 진행되며 확인 경계를 유지합니다.</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap md:justify-end">
          {primaryHref ? (
            <Link href={primaryHref} className={`rounded border border-current bg-white px-3 ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'} text-center font-semibold`}>
              {status.primaryActionLabelKo}
            </Link>
          ) : (
            <button
              type="button"
              disabled={primaryDisabled}
              onClick={() => onPrimaryAction(status.primaryAction)}
              className={`rounded border border-current bg-white px-3 ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'} font-semibold disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {busy ? '진행 중' : status.primaryActionLabelKo}
            </button>
          )}
          {(compact ? (status.secondaryActions ?? []).slice(0, 1) : (status.secondaryActions ?? [])).map((action) => (
            <SecondaryAction key={action} action={action} />
          ))}
        </div>
      </div>
    </section>
  );
}
