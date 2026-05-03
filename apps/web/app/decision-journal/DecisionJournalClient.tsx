"use client";

import Link from "next/link";
import { OpsFeedbackButton } from "@/components/OpsFeedbackButton";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type JournalEntry = {
  id: string;
  market: string | null;
  symbol: string | null;
  name: string | null;
  decision_type: string;
  decision_date: string;
  context_price: number | string | null;
  sector_score: number | string | null;
  sector_zone: string | null;
  portfolio_weight: number | string | null;
  reason: string;
  expected_trigger: string | null;
  invalidation_condition: string | null;
  review_after_days: number | null;
  review_due_date: string | null;
  later_outcome: string | null;
  outcome_note: string | null;
  created_at: string | null;
};

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "considered_buy", label: "매수를 검토함" },
  { value: "skipped_buy", label: "사지 않음 (매수 보류/포기)" },
  { value: "considered_sell", label: "매도를 검토함" },
  { value: "skipped_sell", label: "팔지 않음 (매도 보류/유지)" },
  { value: "considered_add", label: "추가매수 검토" },
  { value: "skipped_add", label: "추가매수 안 함" },
  { value: "hold", label: "관망·보유 유지" },
  { value: "wait", label: "대기·조정 대기" },
  { value: "other", label: "기타" },
];

const OUTCOME_OPTIONS: { value: string; label: string }[] = [
  { value: "good_decision", label: "좋은 판단" },
  { value: "bad_decision", label: "아쉬운 판단" },
  { value: "mixed", label: "복합" },
  { value: "unknown", label: "아직 모름" },
];

function typeLabel(code: string): string {
  return TYPE_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

function numOrEmpty(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

export function DecisionJournalClient() {
  const sp = useSearchParams();
  const tab = sp.get("tab") ?? "";

  const [items, setItems] = useState<JournalEntry[]>([]);
  const [reviewDue, setReviewDue] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [market, setMarket] = useState("");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [decisionType, setDecisionType] = useState("skipped_buy");
  const [reason, setReason] = useState("");
  const [expectedTrigger, setExpectedTrigger] = useState("");
  const [invalidationCondition, setInvalidationCondition] = useState("");
  const [reviewAfterDays, setReviewAfterDays] = useState("30");
  const [contextPrice, setContextPrice] = useState("");
  const [sectorScore, setSectorScore] = useState("");
  const [sectorZone, setSectorZone] = useState("");
  const [portfolioWeight, setPortfolioWeight] = useState("");

  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterOutcome, setFilterOutcome] = useState("");
  const [dueOnly, setDueOnly] = useState(false);

  const applyQueryDefaults = useCallback(() => {
    const m = sp.get("market")?.trim().toUpperCase() ?? "";
    const s = sp.get("symbol")?.trim().toUpperCase() ?? "";
    const n = sp.get("name")?.trim() ?? "";
    const t = sp.get("type")?.trim() ?? "";
    const sz = sp.get("sectorZone")?.trim() ?? "";
    const sc = sp.get("sectorScore")?.trim() ?? "";
    const sk = sp.get("sectorKey")?.trim() ?? "";
    const sn = sp.get("sectorName")?.trim() ?? "";
    const pw = sp.get("portfolioWeight")?.trim() ?? "";
    if (m) setMarket(m);
    if (s) setSymbol(s);
    if (n) setName(n);
    if (t && TYPE_OPTIONS.some((o) => o.value === t)) setDecisionType(t);
    if (sz) setSectorZone(sz);
    if (sc) setSectorScore(sc);
    if (pw) setPortfolioWeight(pw);
    if (!s && (sk || sn)) {
      setName((prev) => prev || [sn, sk && `(${sk})`].filter(Boolean).join(" "));
    }
  }, [sp]);

  useEffect(() => {
    applyQueryDefaults();
  }, [applyQueryDefaults]);

  const loadLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (filterSymbol.trim()) qs.set("symbol", filterSymbol.trim().toUpperCase());
      if (filterType.trim()) qs.set("decisionType", filterType.trim());
      if (filterOutcome.trim()) qs.set("outcome", filterOutcome.trim());
      if (dueOnly) qs.set("dueOnly", "1");
      qs.set("limit", "80");
      const [listRes, dueRes] = await Promise.all([
        fetch(`/api/decision-journal?${qs.toString()}`, { credentials: "same-origin" }),
        fetch("/api/decision-journal/review-due?limit=100", { credentials: "same-origin" }),
      ]);
      const listJson = (await listRes.json()) as { ok?: boolean; items?: JournalEntry[]; error?: string };
      const dueJson = (await dueRes.json()) as { ok?: boolean; items?: JournalEntry[]; error?: string };
      if (!listRes.ok) throw new Error(listJson.error ?? `HTTP ${listRes.status}`);
      setItems(listJson.items ?? []);
      if (dueRes.ok) setReviewDue(dueJson.items ?? []);
      else setReviewDue([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "목록 로드 실패");
      setItems([]);
      setReviewDue([]);
    } finally {
      setLoading(false);
    }
  }, [filterSymbol, filterType, filterOutcome, dueOnly]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const submit = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        market: market.trim() || undefined,
        symbol: symbol.trim() || undefined,
        name: name.trim() || undefined,
        decisionType,
        reason: reason.trim(),
        expectedTrigger: expectedTrigger.trim() || undefined,
        invalidationCondition: invalidationCondition.trim() || undefined,
        reviewAfterDays: Number(reviewAfterDays) || 30,
      };
      const cp = Number(contextPrice);
      if (contextPrice.trim() && Number.isFinite(cp)) body.contextPrice = cp;
      const ss = Number(sectorScore);
      if (sectorScore.trim() && Number.isFinite(ss)) body.sectorScore = ss;
      if (sectorZone.trim()) body.sectorZone = sectorZone.trim();
      const pw = Number(portfolioWeight);
      if (portfolioWeight.trim() && Number.isFinite(pw)) body.portfolioWeight = pw;

      const res = await fetch("/api/decision-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setReason("");
      setExpectedTrigger("");
      setInvalidationCondition("");
      await loadLists();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }, [
    market,
    symbol,
    name,
    decisionType,
    reason,
    expectedTrigger,
    invalidationCondition,
    reviewAfterDays,
    contextPrice,
    sectorScore,
    sectorZone,
    portfolioWeight,
    loadLists,
  ]);

  const patchOutcome = useCallback(
    async (id: string, laterOutcome: string, outcomeNote?: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/decision-journal/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ laterOutcome, outcomeNote: outcomeNote ?? null }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        await loadLists();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "평가 저장 실패");
      }
    },
    [loadLists],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      if (!window.confirm("이 기록을 삭제할까요?")) return;
      setError(null);
      try {
        const res = await fetch(`/api/decision-journal/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        await loadLists();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "삭제 실패");
      }
    },
    [loadLists],
  );

  const showReviewFirst = tab === "review" || sp.get("dueOnly") === "1";

  const reviewBlock = useMemo(
    () => (
      <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm">
        <h2 className="font-semibold text-amber-950">복기 예정 목록</h2>
        <p className="mt-1 text-xs text-amber-900/90">복기일이 지났고 결과가 아직 pending인 기록입니다.</p>
        {reviewDue.length === 0 ? (
          <p className="mt-2 text-xs text-slate-600">해당 없음</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {reviewDue.map((e) => (
              <li key={e.id} className="rounded border border-amber-100 bg-white p-2 text-slate-800">
                <p className="font-medium">
                  {e.decision_date} · {typeLabel(e.decision_type)} · {e.market ?? "—"}:{e.symbol ?? "—"} {e.name ? `· ${e.name}` : ""}
                </p>
                <p className="mt-1 text-slate-700">{e.reason}</p>
                <p className="mt-1 text-[10px] text-slate-500">복기 예정일: {e.review_due_date ?? "—"}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {OUTCOME_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] hover:bg-white"
                      onClick={() => void patchOutcome(e.id, o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-900"
                    onClick={() => void removeEntry(e.id)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    ),
    [reviewDue, patchOutcome, removeEntry],
  );

  return (
    <div className="mx-auto max-w-4xl flex-col gap-4 p-6 text-slate-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">비거래 의사결정 일지</h1>
          <p className="mt-1 text-sm text-slate-600">
            이 기록은 <strong>실제 주문이 아니라</strong> 판단 과정(사지 않음·팔지 않음·관망·대기 등)을 남기는 공간입니다. Trade Journal은 실행한 거래를 기록합니다.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link href="/portfolio" className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
            ← 포트폴리오
          </Link>
          <OpsFeedbackButton domain="decision_journal" />
        </div>
      </div>

      {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}

      {showReviewFirst ? <div className="mb-4">{reviewBlock}</div> : null}

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="font-semibold text-slate-800">의사결정 기록</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="text-xs">
            시장
            <input
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={market}
              onChange={(ev) => setMarket(ev.target.value.toUpperCase())}
              placeholder="KR / US"
            />
          </label>
          <label className="text-xs">
            심볼
            <input
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={symbol}
              onChange={(ev) => setSymbol(ev.target.value.toUpperCase())}
              placeholder="예: 005930, AAPL"
            />
          </label>
          <label className="md:col-span-2 text-xs">
            종목명
            <input
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
            />
          </label>
          <label className="md:col-span-2 text-xs">
            판단 유형
            <select
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={decisionType}
              onChange={(ev) => setDecisionType(ev.target.value)}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2 text-xs">
            이유 (필수)
            <textarea
              className="mt-0.5 min-h-[88px] w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              required
            />
          </label>
          <label className="md:col-span-2 text-xs">
            다시 볼 조건 (expected trigger)
            <input
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={expectedTrigger}
              onChange={(ev) => setExpectedTrigger(ev.target.value)}
            />
          </label>
          <label className="md:col-span-2 text-xs">
            무효화 조건
            <input
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={invalidationCondition}
              onChange={(ev) => setInvalidationCondition(ev.target.value)}
            />
          </label>
          <label className="text-xs">
            복기까지(일)
            <input
              type="number"
              min={1}
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={reviewAfterDays}
              onChange={(ev) => setReviewAfterDays(ev.target.value)}
            />
          </label>
          <label className="text-xs">
            기록 당시가
            <input
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={contextPrice}
              onChange={(ev) => setContextPrice(ev.target.value)}
              placeholder="선택"
            />
          </label>
          <label className="text-xs">
            섹터 점수
            <input
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={sectorScore}
              onChange={(ev) => setSectorScore(ev.target.value)}
              placeholder="선택"
            />
          </label>
          <label className="text-xs">
            섹터 구간
            <input
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={sectorZone}
              onChange={(ev) => setSectorZone(ev.target.value)}
              placeholder="fear / greed 등"
            />
          </label>
          <label className="text-xs">
            포트폴리오 비중(%)
            <input
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={portfolioWeight}
              onChange={(ev) => setPortfolioWeight(ev.target.value)}
              placeholder="선택"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving || !reason.trim()}
          className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => void submit()}
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </section>

      {!showReviewFirst ? reviewBlock : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="font-semibold text-slate-800">최근 기록</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <input
            className="rounded border border-slate-300 px-2 py-1"
            placeholder="심볼 필터"
            value={filterSymbol}
            onChange={(ev) => setFilterSymbol(ev.target.value)}
          />
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={filterType}
            onChange={(ev) => setFilterType(ev.target.value)}
          >
            <option value="">유형 전체</option>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={filterOutcome}
            onChange={(ev) => setFilterOutcome(ev.target.value)}
          >
            <option value="">결과 전체</option>
            <option value="pending">pending</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={dueOnly} onChange={(ev) => setDueOnly(ev.target.checked)} />
            복기일 도래(pending)
          </label>
          <button type="button" className="rounded border border-slate-300 px-2 py-1" onClick={() => void loadLists()} disabled={loading}>
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
        {items.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">기록이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {items.map((e) => (
              <li key={e.id} className="rounded border border-slate-100 bg-slate-50/80 p-2">
                <p className="font-medium text-slate-900">
                  {e.decision_date} · {typeLabel(e.decision_type)} · {e.market ?? "—"}:{e.symbol ?? "—"}{" "}
                  {e.name ? `· ${e.name}` : ""}
                </p>
                <p className="mt-1 text-slate-700">{e.reason}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  트리거: {e.expected_trigger ?? "—"} · 무효화: {e.invalidation_condition ?? "—"} · 복기: {e.review_due_date ?? "—"} · 결과:{" "}
                  {e.later_outcome ?? "—"}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  당시가 {numOrEmpty(e.context_price) || "—"} · 섹터점수 {numOrEmpty(e.sector_score) || "—"} · 섹터구간 {e.sector_zone ?? "—"} · 비중{" "}
                  {numOrEmpty(e.portfolio_weight) ? `${numOrEmpty(e.portfolio_weight)}%` : "—"}
                </p>
                {e.later_outcome === "pending" ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {OUTCOME_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px]"
                        onClick={() => void patchOutcome(e.id, o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="mt-2 text-[10px] text-red-700 underline"
                  onClick={() => void removeEntry(e.id)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
