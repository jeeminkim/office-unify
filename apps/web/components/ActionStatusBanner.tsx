"use client";

import type { ActionLogEntry, ActionPhase } from "@/lib/client/submitLock";

function phaseColor(phase: ActionPhase): string {
  switch (phase) {
    case "running":
      return "border-blue-200 bg-blue-50 text-blue-950";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "error":
      return "border-red-200 bg-red-50 text-red-950";
    case "clicked":
      return "border-violet-200 bg-violet-50 text-violet-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

export function ActionStatusBanner(props: {
  statusMessage: string | null;
  duplicateMessage: string | null;
  logs: ActionLogEntry[];
}) {
  const { statusMessage, duplicateMessage, logs } = props;
  if (!statusMessage && !duplicateMessage && logs.length === 0) return null;

  return (
    <div className="mt-2 space-y-2 text-xs">
      {statusMessage ? (
        <p className="rounded border border-slate-200 bg-white px-2 py-1.5 text-slate-800">{statusMessage}</p>
      ) : null}
      {duplicateMessage ? (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-950">{duplicateMessage}</p>
      ) : null}
      {logs.length > 0 ? (
        <div className="rounded border border-slate-200 bg-white p-2">
          <p className="font-medium text-slate-700">최근 액션</p>
          <ul className="mt-1 space-y-1.5">
            {logs.map((log) => (
              <li key={`${log.at}-${log.actionKey}`} className={`rounded border px-2 py-1 ${phaseColor(log.phase)}`}>
                <p className="font-medium">{log.actionLabel}</p>
                <p className="text-[10px] opacity-90">{new Date(log.at).toLocaleTimeString("ko-KR")} · {log.message}</p>
                {log.nextHint ? <p className="mt-0.5 text-[10px]">{log.nextHint}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
