"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  SectorRadarSummaryResponse,
  SectorRadarSummarySector,
  SectorRadarStatusResponse,
  SectorRadarZone,
  SectorWatchlistCandidateItem,
  SectorWatchlistCandidateResponse,
} from "@/lib/sectorRadarContract";
import {
  formatSectorRadarWarningDetail,
  formatSectorRadarWarningShort,
} from "@/lib/sectorRadarWarningMessages";

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

function readinessShort(label: SectorWatchlistCandidateItem["readinessLabel"]): string {
  switch (label) {
    case "watch_now":
      return "지금 관찰";
    case "prepare":
      return "준비";
    case "hold_watch":
      return "유지·관찰";
    case "wait":
      return "대기";
    default:
      return "NO_DATA";
  }
}

export function SectorRadarClient() {
  const queueSectionRef = useRef<HTMLDivElement | null>(null);
  const [summary, setSummary] = useState<SectorRadarSummaryResponse | null>(null);
  const [candidates, setCandidates] = useState<SectorWatchlistCandidateResponse | null>(null);
  const [status, setStatus] = useState<SectorRadarStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [showSectorRadarRawWarnings, setShowSectorRadarRawWarnings] = useState(false);

  const bySectorKey = useMemo(() => {
    const m = new Map<string, SectorWatchlistCandidateItem[]>();
    for (const c of candidates?.candidates ?? []) {
      if (c.sectorKey === "unlinked") continue;
      const arr = m.get(c.sectorKey) ?? [];
      arr.push(c);
      m.set(c.sectorKey, arr);
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => b.readinessScore - a.readinessScore);
    }
    return m;
  }, [candidates]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const [sumRes, candRes] = await Promise.all([
        fetch("/api/sector-radar/summary", { credentials: "same-origin" }),
        fetch("/api/sector-radar/watchlist-candidates", { credentials: "same-origin" }),
      ]);
      const sumData = (await sumRes.json()) as SectorRadarSummaryResponse & { error?: string };
      const candData = (await candRes.json()) as SectorWatchlistCandidateResponse & { error?: string };
      if (!sumRes.ok) throw new Error(sumData.error ?? `HTTP ${sumRes.status}`);
      setSummary(sumData);
      if (candRes.ok && Array.isArray(candData?.candidates)) setCandidates(candData);
      else setCandidates(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "요약 로드 실패");
      setSummary(null);
      setCandidates(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const scrollToQueue = useCallback(() => {
    queueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
            Sector Fear &amp; Greed Radar — 관심 분야별 <strong>한국 상장 ETF·(코인) US 티커 anchor</strong>를 기준으로 조정·과열 정도를 점수화합니다.{" "}
            <strong>자동 매매·주문 실행 없음</strong>. 판단 보조이며 실제 체결은 외부에서 하세요.
          </p>
        </div>
        <Link href="/" className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
          ← 홈
        </Link>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
        <p className="font-medium">관심종목 큐 안내</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>매수 추천이 아니라 관찰 우선순위입니다.</li>
          <li>섹터가 공포 구간이어도 개별 종목 thesis 확인이 필요합니다.</li>
          <li>과열 구간에서는 추격매수보다 관망이 우선입니다.</li>
        </ul>
        <p className="mt-2 text-sky-900/90">
          관심종목은 <Link href="/portfolio-ledger" className="underline underline-offset-2">원장(/portfolio-ledger)</Link>에서 편집합니다.
        </p>
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
        <button
          type="button"
          className="rounded-md border border-violet-400 bg-violet-50 px-4 py-2 text-sm text-violet-950 disabled:opacity-50"
          disabled={!candidates?.candidates?.length}
          onClick={() => scrollToQueue()}
        >
          전체 후보 보기
        </button>
        <Link href="/portfolio" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800">
          포트폴리오와 연결 보기
        </Link>
        {process.env.NODE_ENV === "development" ? (
          <button
            type="button"
            className="rounded-md border border-dashed border-slate-400 px-3 py-2 text-xs text-slate-600"
            onClick={() => setShowSectorRadarRawWarnings((v) => !v)}
          >
            {showSectorRadarRawWarnings ? "raw warnings 숨기기" : "raw warnings (개발)"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {summary?.degraded ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          일부 데이터가 비어 있거나 Sheets 설정이 없어 <strong>degraded</strong> 모드입니다.{" "}
          {(summary.displayWarnings ?? (summary.warnings ?? []).map((w) => formatSectorRadarWarningShort(w))).join(" · ") ||
            "자세한 내용은 아래 섹터 카드의 안내를 참고하세요."}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {(summary?.sectors ?? []).map((s: SectorRadarSummarySector) => {
          const related = (bySectorKey.get(s.key) ?? []).slice(0, 3);
          return (
            <div key={s.key} className={`rounded-lg border p-4 text-sm ${zoneCardClass(s.zone)}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-slate-900">{s.name}</p>
                <p className="text-xs font-medium text-slate-600">
                  {s.score != null ? `${Math.round(s.score)}점` : "NO_DATA"} · {zoneLabel(s.zone)}
                </p>
              </div>
              <p className="mt-2 text-xs text-slate-700">{s.narrativeHint}</p>
              {s.key === "crypto" && (s.components.cryptoBtc != null || s.components.cryptoAlt != null || s.components.cryptoInfra != null) ? (
                <p className="mt-2 text-[11px] text-slate-600">
                  BTC군 {s.components.cryptoBtc?.toFixed(0) ?? "—"} · 알트/ETH {s.components.cryptoAlt?.toFixed(0) ?? "—"} · 인프라{" "}
                  {s.components.cryptoInfra?.toFixed(0) ?? "—"} (가중 45/25/30)
                </p>
              ) : s.components.momentum != null ? (
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
              <div className="mt-3 border-t border-slate-200/80 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">관련 관심종목</p>
                {related.length === 0 ? (
                  <p className="mt-1 text-[11px] text-slate-500">이 섹터와 연결된 관심종목이 없습니다.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-[11px] text-slate-800">
                    {related.map((c) => (
                      <li key={`${s.key}-${c.market}-${c.symbol}`}>
                        <span className="font-medium">{c.name}</span>{" "}
                        <span className="font-mono text-slate-600">
                          {c.market}:{c.symbol}
                        </span>{" "}
                        · {c.readinessScore}점 · {readinessShort(c.readinessLabel)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {(s.displayWarnings?.length ?? s.warnings?.length ?? 0) > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-amber-800">
                  {(s.displayWarnings ?? (s.warnings ?? []).map((w) => formatSectorRadarWarningShort(w))).map((line, wi) => {
                    const details =
                      s.displayWarningDetails ?? (s.warnings ?? []).map((w) => formatSectorRadarWarningDetail(w));
                    const tip = details[wi] ?? line;
                    return (
                      <li key={`${s.key}-warn-${wi}`} title={tip}>
                        {line}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {showSectorRadarRawWarnings && (s.warnings ?? []).length > 0 ? (
                <pre className="mt-1 max-h-24 overflow-auto rounded bg-slate-900/90 p-2 font-mono text-[9px] text-slate-100">
                  {(s.warnings ?? []).join("\n")}
                </pre>
              ) : null}
            </div>
          );
        })}
      </div>

      <div ref={queueSectionRef} className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-violet-950">섹터 조정 시 볼 관심종목 큐</h2>
          <p className="text-[11px] text-violet-900">GET /api/sector-radar/watchlist-candidates</p>
        </div>
        <p className="mt-1 text-xs text-violet-900/90">ETF 섹터 온도 + 원장 관심종목 메타로 관찰 우선순위만 정렬합니다.</p>
        {(candidates?.candidates ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-slate-600">관심종목이 없거나 아직 로드되지 않았습니다.</p>
        ) : (
          <div className="mt-3 max-h-96 overflow-auto rounded border border-violet-100 bg-white">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="border-b border-violet-100 text-left text-violet-800">
                  <th className="px-2 py-1">섹터</th>
                  <th className="px-2 py-1">종목</th>
                  <th className="px-2 py-1">심볼</th>
                  <th className="px-2 py-1">점수</th>
                  <th className="px-2 py-1">라벨</th>
                  <th className="px-2 py-1">신뢰도</th>
                </tr>
              </thead>
              <tbody>
                {(candidates?.candidates ?? []).map((c) => (
                  <tr key={`${c.market}-${c.symbol}-${c.sectorKey}`} className="border-b border-slate-100">
                    <td className="px-2 py-1 text-slate-700">{c.sectorName}</td>
                    <td className="px-2 py-1 font-medium text-slate-900">{c.name}</td>
                    <td className="px-2 py-1 font-mono text-slate-600">
                      {c.market}:{c.symbol}
                    </td>
                    <td className="px-2 py-1">{c.readinessScore}</td>
                    <td className="px-2 py-1">{readinessShort(c.readinessLabel)}</td>
                    <td className="px-2 py-1">{c.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
