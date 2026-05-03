"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  domain: string;
  component?: string;
  className?: string;
};

export function OpsFeedbackButton({ domain, component, className }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const submit = useCallback(async () => {
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/ops/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          eventType: "improvement",
          severity: "info",
          domain,
          component: component ?? pathname ?? undefined,
          message: text,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMessage("");
      setOpen(false);
      setToast("개선 메모가 저장되었습니다.");
      setTimeout(() => setToast(null), 4000);
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }, [message, domain, component, pathname]);

  return (
    <div className={className}>
      {toast ? <p className="mb-1 text-[11px] text-emerald-800">{toast}</p> : null}
      {!open ? (
        <button
          type="button"
          className="rounded border border-dashed border-slate-400 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          onClick={() => setOpen(true)}
        >
          개선 메모 남기기
        </button>
      ) : (
        <div className="flex max-w-md flex-col gap-1 rounded border border-slate-200 bg-slate-50/80 p-2">
          <textarea
            className="min-h-[72px] w-full rounded border border-slate-300 px-2 py-1 text-xs"
            placeholder="이 화면에서 개선하면 좋을 점을 적어주세요."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex gap-1">
            <button
              type="button"
              disabled={busy || !message.trim()}
              className="rounded bg-slate-800 px-2 py-1 text-[11px] text-white disabled:opacity-50"
              onClick={() => void submit()}
            >
              {busy ? "…" : "저장"}
            </button>
            <button type="button" className="rounded border border-slate-300 px-2 py-1 text-[11px]" onClick={() => setOpen(false)}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
