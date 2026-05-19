"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SaveToActionInboxButton } from "@/components/SaveToActionInboxButton";
import {
  buildGoogleFinanceSetupActionItemDetail,
  type GoogleFinanceSetupActionItemInput,
} from "@/lib/actionItemDetailBuilders";

type TabProbe = {
  name: string;
  role: string;
  status: string;
  note?: string;
};

type SetupPayload = {
  readOnly: boolean;
  status: string;
  generatedAt: string;
  overallQuoteSource: string;
  expectedTabs: string[];
  sqlVsSheetsNote: string;
  statusNarrative: string;
  tabGuide: {
    primaryTab: string;
    fallbackTabs: string[];
    legacyTabs: string[];
    probeOrder: string[];
    probes: TabProbe[];
    tabActionHint: string;
  };
  portfolioQuotesTab: {
    configuredName: string;
    tabFound: boolean;
    readSucceeded: boolean;
    readbackUnavailable: boolean;
    rowCount: number;
    okRows: number;
    parseFailedRows: number;
    missingRows: number;
  };
  usAnchor: {
    requested: number;
    ok: number;
    coverageLabel: string;
    fetchFailed: boolean;
    emptyReason?: string;
    summary: {
      sheetsAnchorOk: number;
      fallbackOnly: number;
      missing: number;
      rangeOrPermissionError: number;
    };
    results: Array<{
      key: string;
      label: string;
      symbol: string;
      googleTicker: string;
      expectedFormula: string;
      readbackPrice?: number;
      readbackStatus: string;
      source: string;
      actionHint?: string;
      ok: boolean;
    }>;
  };
  usMarketGatingNote: string;
  sampleFormulas: string[];
  sampleFormulasUnprefixed: string[];
  portfolioQuotesSampleTsv: string;
  userSetupSteps: Array<{ step: number; label: string; description?: string }>;
  setupChecklist: Array<{ label: string; description: string }>;
  developerApis: Array<{ method: string; path: string; note?: string }>;
  actionHint: string;
  warnings: string[];
  repairPlan: {
    status: string;
    writeAvailable: boolean;
    requiresConfirmation: boolean;
    targetSpreadsheetId?: string;
    credential: {
      authMode: string;
      writeAvailable: boolean;
      serviceAccountEmailMasked?: string;
      scopesNote: string;
      actionHint: string;
    };
    operations: Array<{
      operationId: string;
      type: string;
      tabName: string;
      range?: string;
      description: string;
      previewValues?: string[][];
      overwrite: boolean;
      riskLevel: string;
      blockedReason?: string;
    }>;
    warnings: string[];
    actionHint: string;
  };
  repairModeNote: string;
};

type ApplyResult = {
  ok: boolean;
  status: string;
  appliedOperations: string[];
  skippedOperations: Array<{ operationId: string; reason: string }>;
  postCheck?: { sheetsOkCount: number; missingCount: number; actionHint: string };
};

function ymdSeoul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

function probeStatusLabel(status: string): string {
  switch (status) {
    case "found":
      return "found";
    case "missing":
      return "missing";
    case "read_failed":
      return "read_failed";
    default:
      return "not_checked";
  }
}

function sourceBadge(r: SetupPayload["usAnchor"]["results"][number]): string {
  if (r.source === "google_sheets_readback" && r.readbackStatus === "ok") return "Sheets read-back OK";
  if (r.source === "yahoo_fallback") return "Fallback only";
  if (r.readbackStatus === "missing") return "Sheets missing";
  if (r.readbackStatus === "parse_failed") return "Range parse failed";
  return r.source;
}

function toActionItemInput(data: SetupPayload): GoogleFinanceSetupActionItemInput {
  return {
    status: data.status,
    actionHint: data.actionHint,
    warnings: data.warnings,
    expectedTabs: data.expectedTabs,
    sampleFormulas: data.sampleFormulas,
    overallQuoteSource: data.overallQuoteSource,
    portfolioQuotesTab: data.portfolioQuotesTab,
    tabGuide: data.tabGuide,
    usAnchor: {
      requested: data.usAnchor.requested,
      summary: data.usAnchor.summary,
      results: data.usAnchor.results.map((r) => ({
        symbol: r.symbol,
        source: r.source,
        readbackStatus: r.readbackStatus,
      })),
    },
  };
}

export function GoogleFinanceSetupClient() {
  const [data, setData] = useState<SetupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [unprefixedOpen, setUnprefixedOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/system/google-finance-setup", { credentials: "same-origin" });
      const json = (await res.json()) as SetupPayload & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(`${label} 복사됨`);
    } catch {
      setCopyHint("복사 실패");
    }
  };

  const statusColor =
    data?.status === "ok"
      ? "border-emerald-300 bg-emerald-50"
      : data?.status === "degraded"
        ? "border-amber-300 bg-amber-50"
        : "border-red-300 bg-red-50";

  const summary = data?.usAnchor.summary;
  const repair = data?.repairPlan;

  const runRepairApply = async () => {
    setApplyLoading(true);
    setApplyResult(null);
    try {
      const res = await fetch("/api/system/google-finance-setup/repair/apply", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          idempotencyKey: `repair:${ymdSeoul()}`,
        }),
      });
      const json = (await res.json()) as ApplyResult & { error?: string };
      if (!res.ok && json.status !== "write_not_available") {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setApplyResult(json);
      setConfirmOpen(false);
      if (json.ok) void load();
    } catch (e: unknown) {
      setCopyHint(e instanceof Error ? e.message : "Repair 적용 실패");
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 pb-20 md:p-6">
      <h1 className="text-xl font-bold text-slate-900">Google Finance 설정 점검</h1>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        Google Finance는 시세/quote <strong>Sheets read-back 검증용</strong>입니다. Yahoo fallback만 확인된 경우는 OK로
        보지 않습니다. GET 점검은 read-only이며, <strong>Repair Assistant</strong>는 사용자가 「적용」을 눌렀을 때만
        표시된 operation을 1회 write합니다.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded border px-2 py-1 text-xs" disabled={loading} onClick={() => void load()}>
          {loading ? "확인 중…" : "상태 다시 확인 (read-only)"}
        </button>
        <button
          type="button"
          className="rounded border border-blue-400 bg-blue-50 px-2 py-1 text-xs text-blue-950"
          onClick={() => {
            void fetch("/api/portfolio/quotes/refresh", { method: "POST", credentials: "same-origin" }).then(() =>
              setCopyHint("시세 새로고침 요청을 보냈습니다. 1분 후 「시세 상태 확인」을 눌러주세요."),
            );
          }}
        >
          시세 새로고침 요청
        </button>
        <a
          href="/api/portfolio/quotes/status"
          className="rounded border px-2 py-1 text-xs"
          target="_blank"
          rel="noreferrer"
        >
          시세 상태 확인
        </a>
        <Link href="/" className="rounded border px-2 py-1 text-xs">
          Today Brief
        </Link>
      </div>

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {copyHint ? <p className="mt-1 text-[10px] text-slate-600">{copyHint}</p> : null}

      {data ? (
        <section className={`mt-4 rounded-lg border p-3 text-xs ${statusColor}`}>
          <p className="font-semibold">현재 상태: {data.status}</p>
          <p className="mt-2 rounded bg-white/70 p-2 text-[11px] leading-relaxed">{data.sqlVsSheetsNote}</p>
          <p className="mt-2 font-medium text-slate-800">{data.statusNarrative}</p>
          <p className="mt-1 text-slate-700">{data.actionHint}</p>
          {summary ? (
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              <p>
                <span className="font-medium">Sheets anchor OK:</span> {summary.sheetsAnchorOk}/{data.usAnchor.requested}
              </p>
              <p>
                <span className="font-medium">Fallback only:</span> {summary.fallbackOnly}
                {summary.fallbackOnly > 0 ? " (OK 아님)" : ""}
              </p>
              <p>
                <span className="font-medium">Missing:</span> {summary.missing}
              </p>
              <p>
                <span className="font-medium">Range/permission:</span> {summary.rangeOrPermissionError}
              </p>
            </div>
          ) : null}
          <p className="mt-2 text-[10px] text-slate-600">{data.usMarketGatingNote}</p>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <h2 className="font-semibold">Google Sheets 탭 안내</h2>
            <p className="mt-1 text-[10px] text-slate-600">
              <span className="font-medium">앱이 실제로 읽는 1순위 탭:</span> {data.tabGuide.primaryTab}
            </p>
            <p className="mt-1 text-[10px] text-slate-600">
              <span className="font-medium">보조/호환 탭:</span> {data.tabGuide.fallbackTabs.join(", ")}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              기타(레거시): {data.tabGuide.legacyTabs.join(", ")} — Sector Radar 등 별도 기능
            </p>
            <p className="mt-2 text-[10px] font-medium text-slate-700">탭 탐색 순서</p>
            <ol className="mt-0.5 list-inside list-decimal text-[10px] text-slate-600">
              {data.tabGuide.probeOrder.map((t, i) => (
                <li key={t}>
                  {i + 1}. {t}
                </li>
              ))}
            </ol>
            <table className="mt-3 w-full text-left text-[10px]">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-1 pr-2">탭</th>
                  <th className="py-1 pr-2">역할</th>
                  <th className="py-1">감지</th>
                </tr>
              </thead>
              <tbody>
                {data.tabGuide.probes.map((p) => (
                  <tr key={`${p.name}-${p.role}`} className="border-b border-slate-100">
                    <td className="py-1 pr-2 font-mono">{p.name}</td>
                    <td className="py-1 pr-2">{p.role === "primary" ? "1순위" : p.role === "fallback" ? "보조" : "레거시"}</td>
                    <td className={`py-1 ${p.status === "found" ? "text-emerald-800" : p.status === "missing" ? "text-amber-900" : "text-red-800"}`}>
                      {probeStatusLabel(p.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 rounded bg-sky-50 p-2 text-[10px] text-sky-950">{data.tabGuide.tabActionHint}</p>
          </section>

          {repair ? (
            <section className="mt-4 rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-xs">
              <h2 className="font-semibold text-violet-950">Sheets Repair Assistant (confirmed write only)</h2>
              <p className="mt-1 text-[10px] text-violet-900">{data.repairModeNote}</p>
              <p className="mt-2 text-[10px] text-violet-900">
                이 기능은 Google Sheets를 자동으로 계속 수정하지 않습니다. 이번에 표시된 operation만 사용자가 확인 후
                1회 적용합니다. 기존 데이터는 기본적으로 덮어쓰지 않습니다.
              </p>
              <div className="mt-2 rounded border border-violet-100 bg-white/80 p-2">
                <p>
                  <span className="font-medium">Write 가능:</span>{" "}
                  {repair.writeAvailable ? "예 (service account + spreadsheets scope)" : "아니오"}
                </p>
                <p className="mt-1">
                  <span className="font-medium">인증:</span> {repair.credential.authMode}
                  {repair.credential.serviceAccountEmailMasked
                    ? ` · ${repair.credential.serviceAccountEmailMasked}`
                    : null}
                </p>
                <p className="mt-1 text-[10px] text-slate-600">{repair.credential.actionHint}</p>
                <p className="mt-1">
                  <span className="font-medium">Plan 상태:</span> {repair.status}
                </p>
              </div>

              <h3 className="mt-3 font-medium text-violet-950">수정 미리보기</h3>
              <ul className="mt-1 space-y-2">
                {repair.operations.map((op) => (
                  <li key={op.operationId} className="rounded border border-violet-100 bg-white p-2 text-[10px]">
                    <p className="font-medium">
                      {op.description}{" "}
                      <span
                        className={
                          op.riskLevel === "low"
                            ? "text-emerald-700"
                            : op.riskLevel === "high"
                              ? "text-red-700"
                              : "text-amber-800"
                        }
                      >
                        [{op.riskLevel}]
                      </span>
                      {op.overwrite ? " · overwrite" : " · overwrite=false"}
                    </p>
                    <p className="text-slate-500">
                      {op.type} · {op.tabName}
                      {op.range ? ` · ${op.range}` : ""}
                    </p>
                    {op.blockedReason ? <p className="text-red-700">blocked: {op.blockedReason}</p> : null}
                    {op.previewValues?.length ? (
                      <pre className="mt-1 max-h-24 overflow-auto rounded bg-slate-50 p-1 font-mono text-[9px]">
                        {op.previewValues
                          .slice(0, 3)
                          .map((row) => row.join("\t"))
                          .join("\n")}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-violet-900">{repair.actionHint}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-violet-500 bg-violet-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
                  disabled={!repair.writeAvailable || applyLoading || repair.status === "not_needed"}
                  onClick={() => setConfirmOpen(true)}
                >
                  {applyLoading ? "적용 중…" : "적용 (confirm 필요)"}
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1"
                  onClick={() => void copyText(data.portfolioQuotesSampleTsv, "수동 샘플 표")}
                >
                  복사해서 수동 적용
                </button>
              </div>

              {confirmOpen ? (
                <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-[10px]">
                  <p className="font-medium text-amber-950">
                    Google Sheets에 탭/헤더/수식을 작성합니다. 기존 데이터는 덮어쓰지 않습니다. 계속할까요?
                  </p>
                  <p className="mt-1 text-amber-900">
                    GOOGLEFINANCE 계산에 1분 정도 걸릴 수 있습니다. marketcap/tradetime은 비어 있을 수 있습니다.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-violet-700 px-2 py-1 text-white"
                      disabled={applyLoading}
                      onClick={() => void runRepairApply()}
                    >
                      예, 적용
                    </button>
                    <button type="button" className="rounded border px-2 py-1" onClick={() => setConfirmOpen(false)}>
                      취소
                    </button>
                  </div>
                </div>
              ) : null}

              {applyResult ? (
                <div className="mt-3 rounded border border-slate-200 bg-white p-2 text-[10px]">
                  <p className="font-medium">적용 결과: {applyResult.status}</p>
                  {applyResult.appliedOperations.length ? (
                    <p className="mt-1">applied: {applyResult.appliedOperations.join(", ")}</p>
                  ) : null}
                  {applyResult.skippedOperations.length ? (
                    <p className="mt-1 text-amber-800">
                      skipped:{" "}
                      {applyResult.skippedOperations.map((s) => `${s.operationId}(${s.reason})`).join(", ")}
                    </p>
                  ) : null}
                  {applyResult.postCheck ? (
                    <p className="mt-1">
                      post-check Sheets OK: {applyResult.postCheck.sheetsOkCount} · missing:{" "}
                      {applyResult.postCheck.missingCount}
                      <br />
                      {applyResult.postCheck.actionHint}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-xs">
            <h2 className="font-semibold text-emerald-950">점검 순서 (이 순서대로)</h2>
            <ol className="mt-2 list-inside list-decimal space-y-2">
              {data.userSetupSteps.map((s) => (
                <li key={s.step} className="text-emerald-950">
                  <span className="font-medium">{s.label}</span>
                  {s.description ? <span className="block text-[10px] text-emerald-900">{s.description}</span> : null}
                </li>
              ))}
            </ol>
            <SaveToActionInboxButton
              className="mt-3"
              label="설정 점검을 Action Item으로 저장"
              request={{
                title: "Google Finance / Sheets 설정 점검",
                sourceType: "manual",
                sourceLabel: "google_finance_setup",
                idempotencyKey: `google-finance-setup:${ymdSeoul()}`,
                detailJson: buildGoogleFinanceSetupActionItemDetail(toActionItemInput(data)),
              }}
            />
          </section>

          <section className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <h2 className="font-semibold">portfolio_quotes 샘플 표</h2>
            <p className="mt-1 text-[10px] text-slate-600">
              Google Sheets에서 <strong>{data.tabGuide.primaryTab}</strong> 탭을 연 뒤 A1에 붙여 넣으세요. price가 1개
              이상 나오는지, status가 ok로 바뀌는지 확인합니다. marketcap/tradetime은 비어 있을 수 있습니다.
            </p>
            <button
              type="button"
              className="mt-2 rounded border border-emerald-500 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-950"
              onClick={() => void copyText(data.portfolioQuotesSampleTsv, "portfolio_quotes 샘플 표")}
            >
              portfolio_quotes 샘플 표 복사
            </button>
          </section>

          <section className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <h2 className="font-semibold">샘플 GOOGLEFINANCE 수식 (거래소 prefix 권장)</h2>
            <ul className="mt-2 space-y-1 font-mono text-[10px]">
              {data.sampleFormulas.map((f) => (
                <li key={f} className="flex flex-wrap items-center justify-between gap-2 break-all">
                  <span>{f}</span>
                  <button type="button" className="shrink-0 rounded border px-1 py-0.5 font-sans" onClick={() => void copyText(f, "수식")}>
                    복사
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="mt-2 rounded border px-2 py-1" onClick={() => void copyText(data.sampleFormulas.join("\n"), "전체 수식")}>
              전체 prefix 수식 복사
            </button>
            <details className="mt-3" open={unprefixedOpen} onToggle={(e) => setUnprefixedOpen(e.currentTarget.open)}>
              <summary className="cursor-pointer text-[10px] font-medium text-slate-600">prefix 없는 fallback 예시 (접기)</summary>
              <p className="mt-1 text-[10px] text-slate-500">
                일부 환경에서는 SPY처럼 prefix 없는 ticker도 동작할 수 있지만, 앱 설정 점검에서는 거래소 prefix 형식을
                우선 권장합니다.
              </p>
              <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-slate-600">
                {data.sampleFormulasUnprefixed.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          </section>

          <details className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs" open={devOpen} onToggle={(e) => setDevOpen(e.currentTarget.open)}>
            <summary className="cursor-pointer font-medium text-slate-700">개발자용 API (접기)</summary>
            <ul className="mt-2 space-y-1 font-mono text-[10px]">
              {data.developerApis.map((a) => (
                <li key={a.path}>
                  {a.method} {a.path}
                  {a.note ? <span className="font-sans text-slate-500"> — {a.note}</span> : null}
                </li>
              ))}
            </ul>
          </details>

          {data.usAnchor.results.length ? (
            <section className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs">
              <h2 className="font-semibold">US anchor read-back ({data.usAnchor.coverageLabel} Sheets OK)</h2>
              <ul className="mt-2 space-y-2">
                {data.usAnchor.results.map((r) => (
                  <li
                    key={r.key}
                    className={`rounded border p-2 ${r.ok ? "border-emerald-200 bg-emerald-50/50" : r.source === "yahoo_fallback" ? "border-amber-200 bg-amber-50/50" : "border-slate-200"}`}
                  >
                    <p className="font-medium">
                      {r.label} ({r.googleTicker}) — {sourceBadge(r)}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-600">{r.expectedFormula}</p>
                    {r.actionHint ? <p className="mt-0.5 text-[10px] text-slate-600">{r.actionHint}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}