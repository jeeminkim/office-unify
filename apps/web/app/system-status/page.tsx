"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StatusSection = {
  key: string;
  title: string;
  status: "ok" | "warn" | "error" | "not_configured";
  message: string;
  details?: string[];
  actionHint?: string;
};

function tone(status: StatusSection["status"]): string {
  if (status === "ok") return "border-emerald-200 bg-emerald-50";
  if (status === "warn") return "border-amber-200 bg-amber-50";
  if (status === "error") return "border-red-200 bg-red-50";
  return "border-slate-200 bg-slate-50";
}

export default function SystemStatusPage() {
  const [sections, setSections] = useState<StatusSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/system/status", { credentials: "same-origin" });
        const data = (await res.json()) as { sections?: StatusSection[]; generatedAt?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setSections(data.sections ?? []);
        setGeneratedAt(String(data.generatedAt ?? ""));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "status fetch failed");
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6 text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">시스템 상태 진단</h1>
        <Link href="/" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs">← 투자 홈</Link>
      </div>
      {generatedAt ? <p className="mb-3 text-xs text-slate-500">generatedAt: {generatedAt}</p> : null}
      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.key} className={`rounded border p-3 ${tone(section.status)}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{section.title}</p>
              <span className="rounded bg-white/80 px-2 py-0.5 text-[10px] font-semibold">{section.status}</span>
            </div>
            <p className="mt-1 text-xs text-slate-700">{section.message}</p>
            {section.details?.length ? (
              <ul className="mt-1 list-disc pl-4 text-[11px] text-slate-600">
                {section.details.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
            ) : null}
            {section.actionHint ? <p className="mt-1 text-[11px] text-slate-600">hint: {section.actionHint}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

