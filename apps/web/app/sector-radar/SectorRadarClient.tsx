"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  SectorRadarSummaryResponse,
  SectorRadarSummarySector,
  SectorRadarStatusResponse,
  SectorRadarZone,
} from "@/lib/sectorRadarContract";

const jsonHeaders: HeadersInit = { "Content-Type": "application/json" };

function zoneLabel(zone: SectorRadarZone): string {
  switch (zone) {
    case "extreme_fear":
      return "극공포";
    case "fear":
      return "공포";
    case "neutral":
      return "중립";
    case "greed":
      return "탐욕";
    case "extreme_greed":
      return "과열";
    default:
      return "NO_DATA";
  }
}

function zoneCardClass(zone: SectorRadarZone): string {
  switch (zone) {
    case "extreme_fear":
      return "border-slate-400 bg-slate-100";
    case "fear":
      return "border-blue-200 bg-blue-50";
    case "neutral":
      return "border-slate-200 bg-slate-50";
    case "greed":
      return "border-orange-200 bg-orange-50";
    case "extreme_greed":
      return "border-red-200 bg-red-50";
    default:
      return "border-slate-200 bg-white";
  }
}

export function SectorRadarClient() {
  const [summary, setSummary] = useState<SectorRadarSummaryResponse | null>(null);
  const [status, setStatus] = useState<SectorRadarStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const res = await fetch("/api/sector-radar/summary", { credentials: "same-origin" });
      const data = (await res.json()) as SectorRadarSummaryResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSummary(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "요약 로드 실패");
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const runRefresh = useCallback(async () => {
    setRefreshBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sector-radar/refresh", {
        method: "POST",
        headers: jsonHeaders,
        credentials: "same-origin",
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string; warnings?: string[] };
      if (!res.ok && res.status !== 200) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.ok === false) {
        setError(data.message ?? "새로고침 요청이 완료되지 않았습니다.");
      }
      await loadSummary();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "새로고침 실패");
    } finally {
      setRefreshBusy(false);
    }
  }, [loadSummary]);

  const runStatus = useCallback(async () => {
    setStatusBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sector-radar/status", { credentials: "same-origin" });
      const data = (await res.json()) as SectorRadarStatusResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatus(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "상태 로드 실패");
    } finally {
      setStatusBusy(false);
    }
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6 text-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">섹터 온도계</h1>
          <p className="mt-1 text-sm text-slate-600">
            Sector Fear &amp; Greed Radar — 관심 분야별 <strong>한국 상장 ETF anchor</strong>를 기준으로 조정·과열 정도를 점수화합니다.{" "}
            <strong>자동 매매·주문 실행 없음</strong>. 판단 보조이며 실제 체결은 외부에서 하세요.
          </p>
        </div>
        <Link href="/" className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
          ← 홈
        </Link>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        시세는 Google Sheets의 <code className="rounded bg-amber-100 px-1">GOOGLEFINANCE</code> read-back이며 지연·누락·
        <code className="rounded bg-amber-100 px-1">#N/A</code>가 날 수 있습니다. 원장(Supabase)과 다른 ETF seed는 운영 중 보정하세요.
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={loadingSummary}
          onClick={() => void loadSummary()}
        >
          {loadingSummary ? "불러오는 중…" : "요약 불러오기"}
        </button>
        <button
          type="button"
          className="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={refreshBusy}
          onClick={() => void runRefresh()}
        >
          {refreshBusy ? "Syncing quotes…" : "데이터 새로고침"}
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 disabled:opacity-50"
          disabled={statusBusy}
          onClick={() => void runStatus()}
        >
          {statusBusy ? "확인 중…" : "상태 확인"}
        </button>
        <Link href="/portfolio" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800">
          포트폴리오와 연결 보기
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {summary?.degraded ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          일부 데이터가 비어 있거나 Sheets 설정이 없어 <strong>degraded</strong> 모드입니다.{" "}
          {(summary.warnings ?? []).join(" · ") || "warnings 참고"}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {(summary?.sectors ?? []).map((s: SectorRadarSummarySector) => (
          <div key={s.key} className={`rounded-lg border p-4 text-sm ${zoneCardClass(s.zone)}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-slate-900">{s.name}</p>
              <p className="text-xs font-medium text-slate-600">
                {s.score != null ? `${Math.round(s.score)}점` : "NO_DATA"} · {zoneLabel(s.zone)}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-700">{s.narrativeHint}</p>
            {s.components.momentum != null ? (
              <p className="mt-2 text-[11px] text-slate-600">
                모멘텀 {s.components.momentum.toFixed(1)} · 거래량 {s.components.volume?.toFixed(1) ?? "—"} · 52주위치{" "}
                {s.components.drawdown?.toFixed(1) ?? "—"} · 추세 {s.components.trend?.toFixed(1) ?? "—"} · 품질{" "}
                {s.components.risk?.toFixed(1) ?? "—"}
              </p>
            ) : null}
            {s.anchors.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px] text-slate-700">
                {s.anchors.slice(0, 5).map((a) => (
                  <li key={`${s.key}-${a.symbol}`}>
                    {a.name} <span className="font-mono text-slate-500">{a.symbol}</span> · {a.dataStatus}
                    {a.changePct != null ? ` · ${a.changePct.toFixed(2)}%` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {(s.warnings ?? []).length > 0 ? (
              <p className="mt-2 text-[11px] text-amber-800">{(s.warnings ?? []).join(" · ")}</p>
            ) : null}
          </div>
        ))}
      </div>

      {status?.rows?.length ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <p className="font-semibold text-slate-800">시트 진단</p>
          <p className="mt-1 text-slate-600">
            ok {status.okCount} · pending {status.pendingCount} · empty {status.emptyCount} / 총 {status.total}
          </p>
          <div className="mt-2 max-h-48 overflow-auto">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-1 text-left">섹터</th>
                  <th className="py-1 text-left">심볼</th>
                  <th className="py-1 text-left">상태</th>
                  <th className="py-1 text-left">메모</th>
                </tr>
              </thead>
              <tbody>
                {status.rows.slice(0, 24).map((r) => (
                  <tr key={`${r.categoryKey}-${r.anchorSymbol}`} className="border-b border-slate-100">
                    <td className="py-1">{r.categoryKey}</td>
                    <td className="py-1 font-mono">{r.anchorSymbol}</td>
                    <td className="py-1">{r.rowStatus}</td>
                    <td className="py-1 text-slate-600">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
