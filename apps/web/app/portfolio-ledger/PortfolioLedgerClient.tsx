"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  PortfolioLedgerApplyResponseBody,
  PortfolioLedgerValidateResponseBody,
} from "@office-unify/shared-types";

const jsonHeaders: HeadersInit = { "Content-Type": "application/json" };

type HoldingRow = {
  market: "KR" | "US";
  symbol: string;
  name: string;
  google_ticker: string | null;
  quote_symbol: string | null;
  sector: string | null;
  investment_memo: string | null;
  qty: number | string | null;
  avg_price: number | string | null;
  target_price: number | string | null;
  judgment_memo: string | null;
};

type WatchlistRow = {
  market: "KR" | "US";
  symbol: string;
  name: string;
  google_ticker: string | null;
  quote_symbol: string | null;
};
type GoalRow = {
  id: string;
  goalName: string;
  goalType: string;
  targetAmountKrw: number;
  currentAllocatedKrw: number;
  status: string;
};

const EXAMPLE_SQL = `-- 보유 upsert (KR 예시) — 수정도 동일 형식 INSERT 한 줄(upsert). UPDATE 문은 거부됩니다.
INSERT INTO web_portfolio_holdings (market, symbol, name, sector, investment_memo, qty, avg_price, target_price, judgment_memo)
VALUES ('KR', '000660', 'SK하이닉스', '반도체', '메모', 20, 513000, 1300000, '판단');

-- 관심 upsert (US 예시)
INSERT INTO web_portfolio_watchlist (market, symbol, name, sector, investment_memo, interest_reason, desired_buy_range, observation_points, priority)
VALUES ('US', 'NFLX', '넷플릭스', 'OTT', '메모', '성장성', '92 이하', '실적', '중');

-- 관심 종목 제거
DELETE FROM web_portfolio_watchlist WHERE symbol = 'NFLX' AND market = 'US';
`;

export function PortfolioLedgerClient() {
  const [sql, setSql] = useState(EXAMPLE_SQL);
  const [validateResult, setValidateResult] = useState<PortfolioLedgerValidateResponseBody | null>(null);
  const [applyResult, setApplyResult] = useState<PortfolioLedgerApplyResponseBody | null>(null);
  const [loadingV, setLoadingV] = useState(false);
  const [loadingA, setLoadingA] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetsPreview, setSheetsPreview] = useState<string | null>(null);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [queueJson, setQueueJson] = useState(
    '{"schema":"jo_ledger_v1","ledgerTarget":"holding","actionType":"upsert","market":"KR","name":"","symbol":""}',
  );
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [snapshot, setSnapshot] = useState<{ holdings: HoldingRow[]; watchlist: WatchlistRow[] } | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [ledgerTickerReqId, setLedgerTickerReqId] = useState<string | null>(null);
  const [ledgerTickerBusy, setLedgerTickerBusy] = useState(false);
  const [ledgerTickerStatusBusy, setLedgerTickerStatusBusy] = useState(false);
  const [ledgerTickerRows, setLedgerTickerRows] = useState<
    Array<{
      targetType: string;
      market: string;
      symbol: string;
      name?: string;
      candidateTicker: string;
      parsedPrice?: number;
      currency?: string;
      googleName?: string;
      status: string;
      confidence: string;
      message?: string;
    }>
  >([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    qty: string;
    avg_price: string;
    google_ticker: string;
    quote_symbol: string;
    investment_memo: string;
    target_price: string;
    judgment_memo: string;
  } | null>(null);
  const [tradeDraft, setTradeDraft] = useState<{
    key: string | null;
    action: "buy" | "sell" | "correct";
    quantity: string;
    price: string;
    newQuantity: string;
    newAveragePrice: string;
    memo: string;
    moveToWatchlistOnFullSell: boolean;
    feeKrw: string;
    taxKrw: string;
    tradeReason: string;
    linkedGoalId: string;
    allocationAmountKrw: string;
  }>({
    key: null,
    action: "buy",
    quantity: "",
    price: "",
    newQuantity: "",
    newAveragePrice: "",
    memo: "",
    moveToWatchlistOnFullSell: false,
    feeKrw: "",
    taxKrw: "",
    tradeReason: "",
    linkedGoalId: "",
    allocationAmountKrw: "",
  });
  const [applyTradeBusy, setApplyTradeBusy] = useState(false);
  const [ledgerTradeBanner, setLedgerTradeBanner] = useState<{
    kind: "success" | "info";
    message: string;
    realizedEventId?: string;
  } | null>(null);
  const applyTradePanelRef = useRef<HTMLDivElement | null>(null);

  const parseQty = (v: unknown): number => {
    const n = Number(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const parseAvg = (v: unknown): number => {
    const n = Number(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const openApplyTradePanel = useCallback((row: HoldingRow) => {
    const key = `${row.market}:${row.symbol}`;
    setLedgerTradeBanner(null);
    setError(null);
    if (process.env.NODE_ENV === "development") {
      console.debug("[portfolio-ledger] open apply-trade panel", { key, row });
    }
    setTradeDraft({
      key,
      action: "buy",
      quantity: "",
      price: "",
      newQuantity: String(row.qty ?? ""),
      newAveragePrice: String(row.avg_price ?? ""),
      memo: "",
      moveToWatchlistOnFullSell: false,
      feeKrw: "",
      taxKrw: "",
      tradeReason: "",
      linkedGoalId: "",
      allocationAmountKrw: "",
    });
  }, []);

  useEffect(() => {
    if (!tradeDraft.key || !applyTradePanelRef.current) return;
    applyTradePanelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [tradeDraft.key]);

  const selectedApplyHolding = useMemo(() => {
    if (!tradeDraft.key || !snapshot?.holdings) return null;
    return snapshot.holdings.find((h) => `${h.market}:${h.symbol}` === tradeDraft.key) ?? null;
  }, [tradeDraft.key, snapshot]);

  const buyPreviewAvg = useMemo(() => {
    if (tradeDraft.action !== "buy" || !selectedApplyHolding) return null;
    const addQty = Number(tradeDraft.quantity);
    const addPrice = Number(tradeDraft.price);
    const curQ = parseQty(selectedApplyHolding.qty);
    const curA = parseAvg(selectedApplyHolding.avg_price);
    if (!Number.isFinite(addQty) || addQty <= 0 || !Number.isFinite(addPrice) || addPrice <= 0) return null;
    if (curQ < 0 || !Number.isFinite(curA) || curA <= 0) return null;
    const nq = curQ + addQty;
    return ((curQ * curA) + (addQty * addPrice)) / nq;
  }, [tradeDraft.action, tradeDraft.quantity, tradeDraft.price, selectedApplyHolding]);

  const runValidate = useCallback(async () => {
    setError(null);
    setApplyResult(null);
    setLoadingV(true);
    try {
      const res = await fetch("/api/portfolio/ledger/validate", {
        method: "POST",
        headers: jsonHeaders,
        credentials: "same-origin",
        body: JSON.stringify({ sql }),
      });
      const data = (await res.json()) as PortfolioLedgerValidateResponseBody & { error?: string };
      if (!res.ok) {
        setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        setValidateResult(null);
        return;
      }
      setValidateResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "검증 실패");
      setValidateResult(null);
    } finally {
      setLoadingV(false);
    }
  }, [sql]);

  const runApply = useCallback(async () => {
    setError(null);
    setApplyResult(null);
    setLoadingA(true);
    try {
      const res = await fetch("/api/portfolio/ledger/apply", {
        method: "POST",
        headers: jsonHeaders,
        credentials: "same-origin",
        body: JSON.stringify({ sql }),
      });
      const data = (await res.json()) as PortfolioLedgerApplyResponseBody & { error?: string };
      if (!res.ok) {
        setError(data.errors?.join("\n") ?? data.error ?? "반영 실패");
        setApplyResult(data.ok === false ? data : null);
        return;
      }
      setApplyResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "반영 실패");
    } finally {
      setLoadingA(false);
    }
  }, [sql]);

  const canApply = validateResult?.ok === true;

  const loadSnapshot = useCallback(async () => {
    setLoadingSnapshot(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio/holdings", { credentials: "same-origin" });
      const data = (await res.json()) as { holdings?: HoldingRow[]; watchlist?: WatchlistRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSnapshot({
        holdings: data.holdings ?? [],
        watchlist: (data.watchlist ?? []).map((w) => ({
          ...w,
          google_ticker: w.google_ticker ?? null,
          quote_symbol: w.quote_symbol ?? null,
        })),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "보유 목록 로드 실패");
    } finally {
      setLoadingSnapshot(false);
    }
  }, []);

  const suggestLedgerTicker = useCallback(
    async (targetType: "holding" | "watchlist", market: "KR" | "US", symbol: string) => {
      setLedgerTickerBusy(true);
      setError(null);
      setLedgerTickerRows([]);
      try {
        const res = await fetch("/api/portfolio/ticker-resolver/refresh", {
          method: "POST",
          headers: jsonHeaders,
          credentials: "same-origin",
          body: JSON.stringify({
            targetType,
            symbols: [{ market, symbol }],
          }),
        });
        const data = (await res.json()) as { requestId?: string; error?: string; message?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (data.requestId) setLedgerTickerReqId(data.requestId);
        setLedgerTradeBanner({
          kind: "info",
          message:
            data.message ??
            "Sheets portfolio_quote_candidates 탭에 후보 수식을 작성했습니다. 30~90초 후 「추천 결과」를 누르세요.",
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "ticker 추천 요청 실패");
      } finally {
        setLedgerTickerBusy(false);
      }
    },
    [],
  );

  const loadLedgerTickerStatus = useCallback(async () => {
    if (!ledgerTickerReqId) return;
    setLedgerTickerStatusBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/portfolio/ticker-resolver/status?requestId=${encodeURIComponent(ledgerTickerReqId)}`,
        { credentials: "same-origin" },
      );
      const data = (await res.json()) as {
        rows?: Array<{
          targetType: string;
          market: string;
          symbol: string;
          name?: string;
          candidateTicker: string;
          parsedPrice?: number;
          currency?: string;
          googleName?: string;
          status: string;
          confidence: string;
          message?: string;
        }>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setLedgerTickerRows(data.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "추천 결과 로드 실패");
    } finally {
      setLedgerTickerStatusBusy(false);
    }
  }, [ledgerTickerReqId]);

  const loadGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/financial-goals", { credentials: "same-origin" });
      const data = (await res.json()) as { goals?: GoalRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setGoals(data.goals ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "목표 목록 로드 실패");
    }
  }, []);

  const startEdit = (row: HoldingRow) => {
    const key = `${row.market}:${row.symbol}`;
    setEditingKey(key);
    setEditDraft({
      name: row.name ?? row.symbol,
      qty: String(row.qty ?? ""),
      avg_price: String(row.avg_price ?? ""),
      google_ticker: row.google_ticker ?? "",
      quote_symbol: row.quote_symbol ?? "",
      investment_memo: row.investment_memo ?? "",
      target_price: String(row.target_price ?? ""),
      judgment_memo: row.judgment_memo ?? "",
    });
  };

  const saveEdit = useCallback(async (key: string) => {
    if (!editDraft) return;
    const qty = Number(editDraft.qty);
    const avg = Number(editDraft.avg_price);
    if (!Number.isFinite(qty) || qty < 0) {
      setError("수량은 0 이상 숫자여야 합니다.");
      return;
    }
    if (!Number.isFinite(avg) || avg <= 0) {
      setError("평균단가는 0보다 커야 합니다.");
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/holdings/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: jsonHeaders,
        credentials: "same-origin",
        body: JSON.stringify({
          name: editDraft.name.trim(),
          qty,
          avg_price: avg,
          google_ticker: editDraft.google_ticker.trim() || null,
          quote_symbol: editDraft.quote_symbol.trim() || null,
          investment_memo: editDraft.investment_memo.trim() || null,
          target_price: editDraft.target_price.trim() ? Number(editDraft.target_price) : null,
          judgment_memo: editDraft.judgment_memo.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEditingKey(null);
      setEditDraft(null);
      await loadSnapshot();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "수정 저장 실패");
    }
  }, [editDraft, loadSnapshot]);

  const removeHolding = useCallback(async (key: string) => {
    if (!window.confirm("해당 보유 종목을 삭제할까요?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/holdings/${encodeURIComponent(key)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      await loadSnapshot();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    }
  }, [loadSnapshot]);

  const applyTrade = useCallback(async () => {
    if (!tradeDraft.key) return;
    const [marketRaw, symbol] = tradeDraft.key.split(":");
    const market = marketRaw === "KR" || marketRaw === "US" ? marketRaw : null;
    if (!market || !symbol) return;

    const holding = snapshot?.holdings.find((h) => `${h.market}:${h.symbol}` === tradeDraft.key);
    const currentQty = holding ? parseQty(holding.qty) : 0;

    const tradeQty = tradeDraft.quantity.trim() ? Number(tradeDraft.quantity) : NaN;
    const tradePrice = tradeDraft.price.trim() ? Number(tradeDraft.price) : NaN;

    if (tradeDraft.action === "sell") {
      if (!Number.isFinite(tradeQty) || tradeQty <= 0) {
        setError("매도 수량을 입력하세요.");
        return;
      }
      if (tradeQty > currentQty) {
        setError(`매도 수량은 보유 수량(${currentQty})을 초과할 수 없습니다.`);
        return;
      }
    }

    if (tradeDraft.action === "buy") {
      if (!Number.isFinite(tradeQty) || tradeQty <= 0 || !Number.isFinite(tradePrice) || tradePrice <= 0) {
        setError("추가 매수 수량·단가를 올바르게 입력하세요.");
        return;
      }
    }

    if (tradeDraft.action === "correct") {
      const nq = tradeDraft.newQuantity.trim() ? Number(tradeDraft.newQuantity) : NaN;
      const na = tradeDraft.newAveragePrice.trim() ? Number(tradeDraft.newAveragePrice) : NaN;
      if (!Number.isFinite(nq) || nq < 0) {
        setError("정정 수량을 입력하세요(0 이상).");
        return;
      }
      if (!Number.isFinite(na) || na <= 0) {
        setError("정정 평균단가를 입력하세요(0보다 커야 합니다).");
        return;
      }
    }

    const body = {
      market,
      symbol,
      action: tradeDraft.action,
      quantity: tradeDraft.quantity.trim() ? Number(tradeDraft.quantity) : undefined,
      price: tradeDraft.price.trim() ? Number(tradeDraft.price) : undefined,
      newQuantity: tradeDraft.newQuantity.trim() ? Number(tradeDraft.newQuantity) : undefined,
      newAveragePrice: tradeDraft.newAveragePrice.trim() ? Number(tradeDraft.newAveragePrice) : undefined,
      memo: tradeDraft.memo.trim() || undefined,
      moveToWatchlistOnFullSell: tradeDraft.moveToWatchlistOnFullSell,
      feeKrw: tradeDraft.feeKrw.trim() ? Number(tradeDraft.feeKrw) : undefined,
      taxKrw: tradeDraft.taxKrw.trim() ? Number(tradeDraft.taxKrw) : undefined,
      tradeReason: tradeDraft.tradeReason.trim() || undefined,
      linkedGoalId: tradeDraft.linkedGoalId || undefined,
      allocationAmountKrw: tradeDraft.allocationAmountKrw.trim() ? Number(tradeDraft.allocationAmountKrw) : undefined,
    };

    if (process.env.NODE_ENV === "development") {
      console.debug("[portfolio-ledger] submit apply-trade", body);
    }

    setError(null);
    setLedgerTradeBanner(null);
    setApplyTradeBusy(true);
    try {
      const res = await fetch("/api/portfolio/holdings/apply-trade", {
        method: "POST",
        headers: jsonHeaders,
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        realizedEvent?: { id: string; linkedGoalId?: string | null; goalAllocated?: number };
        suggestTickerResolver?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const suggest = data.suggestTickerResolver === true;
      const realizedId = data.realizedEvent?.id;
      let msg = "반영 완료.";
      if (realizedId) {
        msg = "반영 완료. 실현손익이 기록되었습니다.";
        if (data.realizedEvent?.linkedGoalId) msg += " 목표에 배분되었습니다.";
      } else if (suggest) {
        msg =
          "반영 완료. google_ticker가 비어 있으면 아래 「ticker 추천」으로 후보를 검증한 뒤 적용하세요.";
      }

      setLedgerTradeBanner({
        kind: suggest ? "info" : "success",
        message: msg,
        realizedEventId: realizedId,
      });
      setTradeDraft({
        key: null,
        action: "buy",
        quantity: "",
        price: "",
        newQuantity: "",
        newAveragePrice: "",
        memo: "",
        moveToWatchlistOnFullSell: false,
        feeKrw: "",
        taxKrw: "",
        tradeReason: "",
        linkedGoalId: "",
        allocationAmountKrw: "",
      });
      await loadSnapshot();
      await loadGoals();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "매수/매도 반영 실패");
    } finally {
      setApplyTradeBusy(false);
    }
  }, [tradeDraft, snapshot, loadSnapshot, loadGoals]);

  const fetchSheetsPreview = useCallback(async () => {
    setError(null);
    setLoadingSheets(true);
    try {
      const res = await fetch("/api/integrations/google-sheets/preview", { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        setSheetsPreview(null);
        return;
      }
      setSheetsPreview(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "미리보기 실패");
      setSheetsPreview(null);
    } finally {
      setLoadingSheets(false);
    }
  }, []);

  const runSheetsSync = useCallback(async () => {
    setError(null);
    setLoadingSheets(true);
    try {
      const res = await fetch("/api/integrations/google-sheets/sync", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setSheetsPreview(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "동기화 실패");
    } finally {
      setLoadingSheets(false);
    }
  }, []);

  const appendQueue = useCallback(async () => {
    setError(null);
    setLoadingQueue(true);
    try {
      let joPayload: unknown;
      try {
        joPayload = JSON.parse(queueJson) as unknown;
      } catch {
        setError("큐 JSON 파싱 실패");
        return;
      }
      const res = await fetch("/api/integrations/google-sheets/queue", {
        method: "POST",
        headers: jsonHeaders,
        credentials: "same-origin",
        body: JSON.stringify({ joPayload }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setSheetsPreview(JSON.stringify({ ok: true, note: "ledger_change_queue에 한 줄 추가됨" }, null, 2));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "큐 추가 실패");
    } finally {
      setLoadingQueue(false);
    }
  }, [queueJson]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">포트폴리오 원장</h1>
          <p className="text-sm text-slate-500">
            INSERT / DELETE 만 허용. <strong className="text-slate-700">정합성 검사</strong> 통과 후{" "}
            <strong className="text-slate-700">원장 반영</strong>을 누르세요. user_key는 서버가 세션으로 채웁니다.
          </p>
        </div>
        <Link href="/" className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
          ← 홈
        </Link>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        Supabase에 <code className="rounded bg-amber-100 px-1">docs/sql/append_web_portfolio_ledger.sql</code> 적용 후
        사용하세요. 조일현 페르소나(persona-chat)에서도 동일 형식 SQL 초안을 요청할 수 있습니다.
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        이 화면은 <strong>주문 실행이 아니라 기록 반영</strong>입니다. 실제 매수/매도는 외부 증권사에서 수행한 뒤 여기서 수량/평단을 사후 반영하세요.
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-800">보유 종목 관리 (빠른 수정/매수·매도 반영)</p>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5"
            onClick={() => void loadSnapshot()}
            disabled={loadingSnapshot}
          >
            {loadingSnapshot ? "로딩 중..." : "보유 목록 불러오기"}
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5"
            onClick={() => void loadGoals()}
          >
            목표 목록 불러오기
          </button>
        </div>
        {snapshot?.holdings?.length ? (
          <>
            {ledgerTradeBanner ? (
              <div
                className={`mt-2 rounded border px-3 py-2 text-[11px] ${
                  ledgerTradeBanner.kind === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : "border-blue-200 bg-blue-50 text-blue-950"
                }`}
                role="status"
              >
                <p>{ledgerTradeBanner.message}</p>
                {ledgerTradeBanner.realizedEventId ? (
                  <p className="mt-1">
                    <Link href="/realized-pnl" className="font-medium underline underline-offset-2">
                      실현손익 대시보드로 이동
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}
            <p className="sr-only" aria-live="polite">
              {tradeDraft.key ? `매수·매도 반영 패널 열림: ${tradeDraft.key}` : "패널 닫힘"}
            </p>
            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-2 py-1 text-left">종목</th>
                    <th className="px-2 py-1 text-left">수량</th>
                    <th className="px-2 py-1 text-left">평단</th>
                    <th className="px-2 py-1 text-left">google_ticker</th>
                    <th className="px-2 py-1 text-left">quote_symbol</th>
                    <th className="px-2 py-1 text-left">메모</th>
                    <th className="px-2 py-1 text-left">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.holdings.map((row) => {
                    const key = `${row.market}:${row.symbol}`;
                    const isEditing = editingKey === key && editDraft;
                    const isApplyTarget = tradeDraft.key === key;
                    return (
                      <tr
                        key={key}
                        className={`border-b border-slate-100 align-top ${isApplyTarget ? "bg-emerald-50/90 ring-1 ring-emerald-200 ring-inset" : ""}`}
                      >
                        <td className="px-2 py-1">
                          <p className="font-medium">{row.name}</p>
                          <p className="text-slate-500">{key}</p>
                        </td>
                        <td className="px-2 py-1">{isEditing ? <input className="w-20 rounded border border-slate-300 px-1 py-0.5" value={editDraft.qty} onChange={(e) => setEditDraft({ ...editDraft, qty: e.target.value })} /> : String(row.qty ?? "NO_DATA")}</td>
                        <td className="px-2 py-1">{isEditing ? <input className="w-24 rounded border border-slate-300 px-1 py-0.5" value={editDraft.avg_price} onChange={(e) => setEditDraft({ ...editDraft, avg_price: e.target.value })} /> : String(row.avg_price ?? "NO_DATA")}</td>
                        <td className="px-2 py-1">
                          {isEditing ? (
                            <input
                              className="w-32 rounded border border-slate-300 px-1 py-0.5"
                              placeholder="예: KRX:005930"
                              value={editDraft.google_ticker}
                              onChange={(e) => setEditDraft({ ...editDraft, google_ticker: e.target.value })}
                            />
                          ) : (row.google_ticker ?? "-")}
                        </td>
                        <td className="px-2 py-1">
                          {isEditing ? (
                            <input
                              className="w-28 rounded border border-slate-300 px-1 py-0.5"
                              placeholder="예: 005930.KS"
                              value={editDraft.quote_symbol}
                              onChange={(e) => setEditDraft({ ...editDraft, quote_symbol: e.target.value })}
                            />
                          ) : (row.quote_symbol ?? "-")}
                        </td>
                        <td className="px-2 py-1">{isEditing ? <textarea className="w-48 rounded border border-slate-300 px-1 py-0.5" value={editDraft.investment_memo} onChange={(e) => setEditDraft({ ...editDraft, investment_memo: e.target.value })} /> : (row.investment_memo ?? "-")}</td>
                        <td className="px-2 py-1">
                          <div className="flex flex-wrap gap-1">
                            {isEditing ? (
                              <>
                                <button type="button" className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5" onClick={() => void saveEdit(key)}>저장</button>
                                <button type="button" className="rounded border border-slate-300 bg-white px-2 py-0.5" onClick={() => { setEditingKey(null); setEditDraft(null); }}>취소</button>
                              </>
                            ) : (
                              <button type="button" className="rounded border border-slate-300 bg-white px-2 py-0.5" onClick={() => startEdit(row)}>빠른 수정</button>
                            )}
                            <button type="button" className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-red-800" onClick={() => void removeHolding(key)}>삭제</button>
                            <button
                              type="button"
                              className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-800"
                              aria-expanded={isApplyTarget}
                              aria-controls="ledger-apply-trade-panel"
                              onClick={() => openApplyTradePanel(row)}
                            >
                              매수/매도 반영
                            </button>
                            <button
                              type="button"
                              className="rounded border border-violet-300 bg-violet-50 px-2 py-0.5 text-violet-900 disabled:opacity-50"
                              disabled={ledgerTickerBusy}
                              onClick={() => void suggestLedgerTicker("holding", row.market, row.symbol)}
                            >
                              ticker 추천
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {tradeDraft.key ? (
              <div
                id="ledger-apply-trade-panel"
                ref={applyTradePanelRef}
                className="mt-3 rounded-lg border-2 border-emerald-400 bg-emerald-50/40 p-3 shadow-sm"
                role="region"
                aria-label="매수·매도·정정 반영"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-emerald-950">매수·매도·정정 반영</p>
                    <p className="mt-1 text-[11px] text-slate-700">
                      주문 실행이 아니라 <strong>사후 기록 반영</strong>입니다. 선택:{" "}
                      <span className="font-mono">{tradeDraft.key}</span>
                    </p>
                    {selectedApplyHolding ? (
                      <ul className="mt-2 list-inside list-disc text-[11px] text-slate-800">
                        <li>
                          종목: {selectedApplyHolding.name} · 시장 {selectedApplyHolding.market} · 심볼 {selectedApplyHolding.symbol}
                        </li>
                        <li>현재 수량: {String(selectedApplyHolding.qty ?? "—")}</li>
                        <li>현재 평균단가: {String(selectedApplyHolding.avg_price ?? "—")}</li>
                      </ul>
                    ) : (
                      <p className="mt-2 text-[11px] text-amber-800">선택한 종목을 목록에서 찾지 못했습니다. 목록을 새로고침하세요.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="rounded border border-slate-400 bg-white px-2 py-1 text-[11px] text-slate-800"
                    onClick={() => {
                      setTradeDraft({
                        key: null,
                        action: "buy",
                        quantity: "",
                        price: "",
                        newQuantity: "",
                        newAveragePrice: "",
                        memo: "",
                        moveToWatchlistOnFullSell: false,
                        feeKrw: "",
                        taxKrw: "",
                        tradeReason: "",
                        linkedGoalId: "",
                        allocationAmountKrw: "",
                      });
                    }}
                  >
                    패널 닫기
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-emerald-200/80 pt-3">
                  <label className="flex flex-col gap-0.5 text-[10px] text-slate-600">
                    유형
                    <select
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                      value={tradeDraft.action}
                      onChange={(e) =>
                        setTradeDraft({ ...tradeDraft, action: e.target.value as "buy" | "sell" | "correct" })
                      }
                    >
                      <option value="buy">매수 후 반영</option>
                      <option value="sell">매도 후 반영</option>
                      <option value="correct">단순 정정</option>
                    </select>
                  </label>
                  {tradeDraft.action !== "correct" ? (
                    <label className="flex flex-col gap-0.5 text-[10px] text-slate-600">
                      수량
                      <input
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        placeholder="수량"
                        value={tradeDraft.quantity}
                        onChange={(e) => setTradeDraft({ ...tradeDraft, quantity: e.target.value })}
                      />
                    </label>
                  ) : null}
                  {tradeDraft.action !== "correct" ? (
                    <label className="flex flex-col gap-0.5 text-[10px] text-slate-600">
                      단가
                      <input
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        placeholder="단가"
                        value={tradeDraft.price}
                        onChange={(e) => setTradeDraft({ ...tradeDraft, price: e.target.value })}
                      />
                    </label>
                  ) : null}
                  {tradeDraft.action === "correct" ? (
                    <label className="flex flex-col gap-0.5 text-[10px] text-slate-600">
                      새 수량
                      <input
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        placeholder="새 수량"
                        value={tradeDraft.newQuantity}
                        onChange={(e) => setTradeDraft({ ...tradeDraft, newQuantity: e.target.value })}
                      />
                    </label>
                  ) : null}
                  {tradeDraft.action === "correct" ? (
                    <label className="flex flex-col gap-0.5 text-[10px] text-slate-600">
                      새 평균단가
                      <input
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        placeholder="새 평균단가"
                        value={tradeDraft.newAveragePrice}
                        onChange={(e) => setTradeDraft({ ...tradeDraft, newAveragePrice: e.target.value })}
                      />
                    </label>
                  ) : null}
                  <label className="flex min-w-[200px] flex-col gap-0.5 text-[10px] text-slate-600">
                    메모
                    <input
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                      placeholder="메모 / 정정 이유"
                      value={tradeDraft.memo}
                      onChange={(e) => setTradeDraft({ ...tradeDraft, memo: e.target.value })}
                    />
                  </label>
                </div>
                {tradeDraft.action === "buy" && buyPreviewAvg != null ? (
                  <p className="mt-2 text-[11px] font-medium text-emerald-900">
                    예상 새 평균단가: {buyPreviewAvg.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}
                  </p>
                ) : null}
                {tradeDraft.action === "sell" && selectedApplyHolding ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label className="flex flex-col gap-0.5 text-[10px] text-slate-600">
                      수수료(원)
                      <input
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        placeholder="수수료"
                        value={tradeDraft.feeKrw}
                        onChange={(e) => setTradeDraft({ ...tradeDraft, feeKrw: e.target.value })}
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] text-slate-600">
                      세금(원)
                      <input
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        placeholder="세금"
                        value={tradeDraft.taxKrw}
                        onChange={(e) => setTradeDraft({ ...tradeDraft, taxKrw: e.target.value })}
                      />
                    </label>
                    <label className="flex min-w-[180px] flex-col gap-0.5 text-[10px] text-slate-600">
                      매도 사유
                      <input
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        placeholder="매도 사유"
                        value={tradeDraft.tradeReason}
                        onChange={(e) => setTradeDraft({ ...tradeDraft, tradeReason: e.target.value })}
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] text-slate-600">
                      목표 연결
                      <select
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        value={tradeDraft.linkedGoalId}
                        onChange={(e) => setTradeDraft({ ...tradeDraft, linkedGoalId: e.target.value })}
                      >
                        <option value="">목표 연결 없음</option>
                        {goals.filter((goal) => goal.status === "active").map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.goalName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] text-slate-600">
                      목표 배분액(원)
                      <input
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        placeholder="배분액"
                        value={tradeDraft.allocationAmountKrw}
                        onChange={(e) => setTradeDraft({ ...tradeDraft, allocationAmountKrw: e.target.value })}
                      />
                    </label>
                  </div>
                ) : null}
                {tradeDraft.action === "sell" &&
                selectedApplyHolding &&
                (() => {
                  const cur = parseQty(selectedApplyHolding.qty);
                  const sq = Number(tradeDraft.quantity);
                  return cur > 0 && Number.isFinite(sq) && sq > 0 && sq === cur;
                })() ? (
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-800">
                    <input
                      type="checkbox"
                      checked={tradeDraft.moveToWatchlistOnFullSell}
                      onChange={(e) => setTradeDraft({ ...tradeDraft, moveToWatchlistOnFullSell: e.target.checked })}
                    />
                    전량 매도 시 관심 종목으로 이동
                  </label>
                ) : null}
                {tradeDraft.action === "sell" && selectedApplyHolding ? (
                  (() => {
                    const cur = parseQty(selectedApplyHolding.qty);
                    const sq = Number(tradeDraft.quantity);
                    if (!Number.isFinite(sq) || sq <= 0) return null;
                    if (sq > cur) {
                      return (
                        <p className="mt-2 text-[11px] font-medium text-red-700">
                          매도 수량이 보유 수량({cur})보다 큽니다. 저장할 수 없습니다.
                        </p>
                      );
                    }
                    return null;
                  })()
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                    disabled={
                      applyTradeBusy ||
                      !selectedApplyHolding ||
                      (tradeDraft.action === "sell" &&
                        selectedApplyHolding != null &&
                        (() => {
                          const cur = parseQty(selectedApplyHolding.qty);
                          const sq = Number(tradeDraft.quantity);
                          return Number.isFinite(sq) && sq > cur;
                        })())
                    }
                    onClick={() => void applyTrade()}
                  >
                    {applyTradeBusy ? "저장 중…" : "반영 저장"}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-slate-500">보유 목록을 먼저 불러오세요.</p>
        )}
        {snapshot?.watchlist?.length ? (
          <div className="mt-4">
            <p className="font-semibold text-slate-800">관심 종목</p>
            <div className="mt-2 overflow-auto">
              <table className="min-w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-2 py-1 text-left">종목</th>
                    <th className="px-2 py-1 text-left">google_ticker</th>
                    <th className="px-2 py-1 text-left">quote_symbol</th>
                    <th className="px-2 py-1 text-left">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.watchlist.map((row) => {
                    const key = `${row.market}:${row.symbol}`;
                    return (
                      <tr key={key} className="border-b border-slate-100">
                        <td className="px-2 py-1">
                          <p className="font-medium">{row.name}</p>
                          <p className="text-slate-500">{key}</p>
                        </td>
                        <td className="px-2 py-1">{row.google_ticker ?? "-"}</td>
                        <td className="px-2 py-1">{row.quote_symbol ?? "-"}</td>
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            className="rounded border border-violet-300 bg-violet-50 px-2 py-0.5 text-violet-900 disabled:opacity-50"
                            disabled={ledgerTickerBusy}
                            onClick={() => void suggestLedgerTicker("watchlist", row.market, row.symbol)}
                          >
                            ticker 추천
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {ledgerTickerReqId || ledgerTickerRows.length > 0 ? (
          <div className="mt-4 rounded border border-violet-200 bg-violet-50/50 p-3 text-[11px] text-violet-950">
            <p className="font-semibold">GOOGLEFINANCE ticker 후보 (승인 후 DB 반영)</p>
            <p className="mt-1 text-violet-900/90">
              requestId: {ledgerTickerReqId ?? "—"} · Google Sheets 계산까지 30~90초 걸릴 수 있습니다. 자동 저장 없음.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-violet-400 bg-white px-2 py-1 disabled:opacity-50"
                disabled={ledgerTickerStatusBusy || !ledgerTickerReqId}
                onClick={() => void loadLedgerTickerStatus()}
              >
                {ledgerTickerStatusBusy ? "읽는 중…" : "추천 결과"}
              </button>
            </div>
            {ledgerTickerRows.length > 0 ? (
              <div className="mt-2 overflow-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-violet-200 text-violet-800">
                      <th className="px-2 py-1 text-left">종목</th>
                      <th className="px-2 py-1 text-left">후보 ticker</th>
                      <th className="px-2 py-1 text-right">가격</th>
                      <th className="px-2 py-1 text-left">통화</th>
                      <th className="px-2 py-1 text-left">googleName</th>
                      <th className="px-2 py-1 text-left">상태</th>
                      <th className="px-2 py-1 text-left">적용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerTickerRows.map((row) => (
                      <tr key={`${row.targetType}-${row.market}-${row.symbol}-${row.candidateTicker}`}>
                        <td className="px-2 py-1">{row.name ?? row.symbol}</td>
                        <td className="px-2 py-1 font-mono">{row.candidateTicker}</td>
                        <td className="px-2 py-1 text-right">{row.parsedPrice == null ? "—" : row.parsedPrice.toLocaleString("ko-KR")}</td>
                        <td className="px-2 py-1">{row.currency ?? "—"}</td>
                        <td className="px-2 py-1">{row.googleName ?? "—"}</td>
                        <td className="px-2 py-1">{row.status}</td>
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            className="rounded border border-violet-500 bg-white px-2 py-0.5 disabled:opacity-40"
                            disabled={row.status !== "ok"}
                            onClick={() => {
                              void (async () => {
                                setError(null);
                                try {
                                  const apply = await fetch("/api/portfolio/ticker-resolver/apply", {
                                    method: "POST",
                                    headers: jsonHeaders,
                                    credentials: "same-origin",
                                    body: JSON.stringify({
                                      targetType: row.targetType === "watchlist" ? "watchlist" : "holding",
                                      market: row.market,
                                      symbol: row.symbol,
                                      googleTicker: row.candidateTicker,
                                      quoteSymbol:
                                        row.market === "KR"
                                          ? `${row.symbol.replace(/\D/g, "").padStart(6, "0")}.KS`
                                          : undefined,
                                    }),
                                  });
                                  const ar = (await apply.json()) as { error?: string; message?: string };
                                  if (!apply.ok) throw new Error(ar.error ?? `HTTP ${apply.status}`);
                                  const qref = await fetch("/api/portfolio/quotes/refresh", {
                                    method: "POST",
                                    credentials: "same-origin",
                                  });
                                  if (!qref.ok) {
                                    const qr = (await qref.json()) as { error?: string };
                                    throw new Error(qr.error ?? "시세 새로고침 실패");
                                  }
                                  setLedgerTradeBanner({
                                    kind: "info",
                                    message:
                                      ar.message ??
                                      "저장 및 시세 새로고침 요청 완료. 30~90초 후 /portfolio에서 확인하세요.",
                                  });
                                  await loadSnapshot();
                                } catch (e: unknown) {
                                  setError(e instanceof Error ? e.message : "적용 실패");
                                }
                              })();
                            }}
                          >
                            적용
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
        <p className="font-semibold text-slate-900">Google Sheets 운영 대시보드 (보조)</p>
        <p className="mt-1 text-slate-600">
          원장은 항상 Supabase가 기준입니다. 시트는 동기화·요약용이며, 시트만 고쳐서 DB가 바뀌지는 않습니다. 반영은 아래 SQL
          검증/적용 또는 조일현 → validate/apply 흐름을 사용하세요.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-800 disabled:opacity-50"
            disabled={loadingSheets || loadingQueue}
            onClick={() => void fetchSheetsPreview()}
          >
            {loadingSheets ? "불러오는 중…" : "시트용 JSON 미리보기"}
          </button>
          <button
            type="button"
            className="rounded border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-emerald-900 disabled:opacity-50"
            disabled={loadingSheets || loadingQueue}
            onClick={() => void runSheetsSync()}
          >
            Sheets 동기화 (4탭)
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          동기화는 Vercel 환경변수 <code className="rounded bg-slate-200 px-1">GOOGLE_SERVICE_ACCOUNT_JSON</code>,{" "}
          <code className="rounded bg-slate-200 px-1">GOOGLE_SHEETS_SPREADSHEET_ID</code> 및 스프레드시트에 서비스 계정 공유가
          필요합니다. 시세·환율은 <strong>GOOGLEFINANCE 수식</strong>(준실시간, 지연·#N/A 가능)으로 주입됩니다.{" "}
          <strong>리포트 평균 목표가</strong>는 <code className="rounded bg-slate-200 px-1">research_price_targets</code> 탭에
          수동 입력한 뒤 <code className="rounded bg-slate-200 px-1">holdings_dashboard</code>·
          <code className="rounded bg-slate-200 px-1">portfolio_summary</code>에서 집계됩니다(참고용, 유일한 근거 아님). 자세한
          내용은 <code className="rounded bg-slate-200 px-1">docs/google-sheets-portfolio-dashboard.md</code> 참고.
        </p>
        <label className="mt-3 block text-[11px] font-medium text-slate-700">ledger_change_queue에 append (jo_ledger_v1 JSON)</label>
        <textarea
          className="mt-1 min-h-[72px] w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px]"
          value={queueJson}
          onChange={(e) => setQueueJson(e.target.value)}
          spellCheck={false}
        />
        <button
          type="button"
          className="mt-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-slate-800 disabled:opacity-50"
          disabled={loadingQueue || loadingSheets}
          onClick={() => void appendQueue()}
        >
          {loadingQueue ? "추가 중…" : "큐에 한 줄 추가 (DB 미변경)"}
        </button>
        {sheetsPreview ? (
          <pre className="mt-2 max-h-40 overflow-auto rounded border border-slate-200 bg-white p-2 text-[10px] text-slate-700">
            {sheetsPreview}
          </pre>
        ) : null}
      </div>

      <textarea
        className="min-h-[220px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        spellCheck={false}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => void runValidate()}
          disabled={loadingV || loadingA}
        >
          {loadingV ? "검사 중…" : "SQL 정합성 검사"}
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 disabled:opacity-50"
          onClick={() => void runApply()}
          disabled={loadingA || loadingV || !canApply}
          title={!canApply ? "먼저 정합성 검사를 통과해야 합니다." : undefined}
        >
          {loadingA ? "반영 중…" : "원장 반영"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
          {error}
        </div>
      ) : null}

      {validateResult ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">검사 결과: {validateResult.ok ? "통과" : "실패"}</p>
          <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
            <li>보유 INSERT: {validateResult.summary.insertHoldings}</li>
            <li>관심 INSERT: {validateResult.summary.insertWatchlist}</li>
            <li>보유 DELETE: {validateResult.summary.deleteHoldings}</li>
            <li>관심 DELETE: {validateResult.summary.deleteWatchlist}</li>
          </ul>
          {validateResult.errors.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-xs text-red-700">
              {validateResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {applyResult?.ok ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          원장 반영 완료: {applyResult.applied}건 처리
        </div>
      ) : null}
    </div>
  );
}
