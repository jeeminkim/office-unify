"use client";

import { useState } from "react";
import type { PersonaCoachRole } from "@/lib/personaCoachGuidance";
import { getPersonaCoachGuidance } from "@/lib/personaCoachGuidance";

export type PersonaCoachHintVariant = "default" | "compact";

function DismissButton({
  dismissKey,
  onDismiss,
}: {
  dismissKey: string;
  onDismiss: () => void;
}) {
  return (
    <button
      type="button"
      className="shrink-0 text-[10px] underline"
      onClick={() => {
        try {
          localStorage.setItem(dismissKey, "1");
        } catch {
          /* local guidance dismiss must never block the page */
        }
        onDismiss();
      }}
    >
      오늘은 숨기기
    </button>
  );
}

export function PersonaCoachHint({
  role,
  className = "",
  variant = "default",
}: {
  role: PersonaCoachRole;
  className?: string;
  variant?: PersonaCoachHintVariant;
}) {
  const guidance = getPersonaCoachGuidance(role);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(guidance.dismissKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  if (variant === "compact") {
    return (
      <aside className={`rounded border border-sky-200 bg-sky-50/70 p-2 text-[11px] text-sky-950 ${className}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{guidance.title}</p>
            <p className="mt-0.5 leading-snug">{guidance.oneLinePurpose}</p>
          </div>
          <DismissButton dismissKey={guidance.dismissKey} onDismiss={() => setDismissed(true)} />
        </div>
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] font-medium">역할 안내</summary>
          <p className="mt-1 leading-relaxed">
            지금 {guidance.whatYouCanDoNow.slice(0, 2).join(" · ")}
          </p>
        </details>
      </aside>
    );
  }

  return (
    <aside className={`rounded border border-sky-200 bg-sky-50/70 p-2 text-[11px] text-sky-950 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{guidance.title}</p>
          <p className="mt-0.5">{guidance.oneLinePurpose}</p>
        </div>
        <DismissButton dismissKey={guidance.dismissKey} onDismiss={() => setDismissed(true)} />
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-[10px] font-medium">자세히</summary>
        <div className="mt-1 grid gap-1 sm:grid-cols-3">
          <p>지금 {guidance.whatYouCanDoNow.slice(0, 3).join(" · ")}</p>
          <p>저장 {guidance.whatWillBeSaved.slice(0, 2).join(" · ")}</p>
          <p>주의 {guidance.whatNotToDo.slice(0, 2).join(" · ")}</p>
        </div>
      </details>
    </aside>
  );
}
