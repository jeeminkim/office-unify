"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Props = { symbolKey: string };

type DossierRelatedSector = {
  key: string;
  name: string;
  score?: number;
  zone: string;
  confidence: "low" | "medium" | "high";
  narrativeHint: string;
  anchors: Array<{
    symbol: string;
    name: string;
    googleTicker: string;
    dataStatus: string;
    changePct?: number;
    price?: number;
    volume?: number;
  }>;
};

type DossierSectorRadarMatch = {
  key: string;
  name: string;
  score?: number;
  zone: string;
  actionHint: string;
  confidence: "low" | "medium" | "high";
  narrativeHint: string;
  linkedAnchors: Array<{
    symbol: string;
    name: string;
    googleTicker: string;
    dataStatus: string;
    changePct?: number;
  }>;
  matchReasons: string[];
};

type DossierResponse = {
  ok: boolean;
  holding?: {
    market: string;
    symbol: string;
    name: string;
    sector?: string | null;
    qty: number;
    avgPrice: number;
    currentPrice?: number;
    pnlRate?: number;
  };
  relatedSectorRadar?: DossierSectorRadarMatch[];
  relatedSector?: DossierRelatedSector | null;
  sectorRadarGeneratedAt?: string;
  thesis?: {
    reason?: string;
    targetPrice?: number;
    stopPrice?: number;
    memo?: string;
    createdAt?: string;
  };
  pbLatest?: { persona?: string; content?: string; createdAt?: string };
  committeeLatest?: { topic?: string; summary?: string; createdAt?: string };
  recentJournal?: Array<{
    id: string;
    tradeDate: string;
    side: string;
    thesisSummary?: string;
    tradeReason?: string;
    note?: string;
  }>;
  trendSignals?: Array<{ title: string; summary: string; confidence?: string; createdAt?: string }>;
  tradeEvents?: Array<{
    id: string;
    eventType: "buy" | "sell" | "correct";
    tradeDate: string;
    quantity?: number;
    price?: number;
    beforeQuantity?: number;
    afterQuantity?: number;
    beforeAvgPrice?: number;
    afterAvgPrice?: number;
    realizedPnlKrw?: number;
    memo?: string;
    reason?: string;
  }>;
  researchSignals?: Array<{ title: string; summary: string }>;
  alerts?: Array<{ title: string; body: string; severity: string }>;
  thesisHealth?: { status: string; score?: number; confidence?: string; reasons: string[] };
  warnings?: string[];
  degraded?: boolean;
  error?: string;
};

const krw = new Intl.NumberFormat("ko-KR");

function fmt(v?: number): string {
  if (v == null || !Number.isFinite(v)) return "NO_DATA";
  return krw.format(v);
}

function sectorZoneLabel(zone: string): string {
  if (zone === "extreme_fear") return "극공포";
  if (zone === "fear") return "공포";
  if (zone === "neutral") return "중립";
  if (zone === "greed") return "탐욕";
  if (zone === "extreme_greed") return "과열";
  if (zone === "no_data") return "NO_DATA";
  return zone;
}

function actionHintLabel(h: string): string {
  if (h === "buy_watch") return "분할매수 검토(관찰)";
  if (h === "accumulate") return "조정·분할매수 검토";
  if (h === "hold") return "관망·유지 점검";
  if (h === "trim_watch") return "비중 축소·분할매도 검토";
  if (h === "avoid_chase") return "추격매수 주의";
  if (h === "no_data") return "데이터 부족";
  return h;
}

export function PortfolioSymbolDetailClient({ symbolKey }: Props) {
  const [data, setData] = useState<DossierResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setError(null);
      try {
        const res = await fetch(`/api/portfolio/dossier/${encodeURIComponent(symbolKey)}`, { credentials: "same-origin" });
        const json = (await res.json()) as DossierResponse;
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setData(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "dossier 로드 실패");
      }
    })();
  }, [symbolKey]);

  return (
    <div className="mx-auto max-w-5xl p-6 text-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">종목 Dossier</h1>
          <p className="text-sm text-slate-600">왜 이 종목을 샀는지와 현재 thesis 상태를 한 번에 점검합니다.</p>
        </div>
        <Link href="/portfolio" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs">/portfolio로</Link>
      </div>

      {error ? <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      {data?.degraded ? <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">일부 데이터가 degraded 상태입니다.</div> : null}

      <section className="mb-4 rounded border border-slate-200 bg-white p-4">
        <p className="text-lg font-semibold">{data?.holding?.name ?? "NO_DATA"} ({data?.holding?.market}:{data?.holding?.symbol})</p>
        <p className="mt-1 text-sm text-slate-600">
          현재가 {fmt(data?.holding?.currentPrice)} · 손익률 {data?.holding?.pnlRate == null ? "NO_DATA" : `${data.holding.pnlRate.toFixed(2)}%`} · 수량 {data?.holding?.qty ?? "NO_DATA"}
        </p>
        {data?.holding?.sector ? (
          <p className="mt-1 text-xs text-slate-500">섹터(원장): {data.holding.sector}</p>
        ) : null}
      </section>

      <section className="mb-4 rounded border border-indigo-200 bg-indigo-50/60 p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-indigo-950">관련 섹터 온도 (판단 보조)</h2>
            <p className="mt-1 text-xs text-indigo-900/90">
              ETF·티커 anchor 기반 섹터 레이더와의 <strong>텍스트·섹터 필드 매칭</strong>입니다. 자동 매수·매도 신호가 아니며, 실제 주문은 하지 않습니다.{" "}
              {data?.sectorRadarGeneratedAt ? (
                <span className="text-slate-600">기준 시각: {data.sectorRadarGeneratedAt}</span>
              ) : null}
            </p>
          </div>
          <Link href="/sector-radar" className="text-xs text-indigo-800 underline underline-offset-2">
            섹터 레이더 전체
          </Link>
        </div>
        {data?.relatedSector ? (
          <div className="mt-3 rounded border border-indigo-200 bg-white p-3 text-slate-800">
            <p className="text-xs font-semibold text-indigo-950">관련 섹터 온도</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{data.relatedSector.name}</p>
            <p className="mt-1 text-[11px] text-slate-600">
              {data.relatedSector.score != null ? `${Math.round(data.relatedSector.score)}점` : "NO_DATA"} · {sectorZoneLabel(data.relatedSector.zone)} · 신뢰도{" "}
              {data.relatedSector.confidence}
            </p>
            <p className="mt-2 text-xs leading-snug text-slate-700">{data.relatedSector.narrativeHint}</p>
            {(data.relatedSector.anchors ?? []).length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-[10px] text-slate-600">
                {(data.relatedSector.anchors ?? []).slice(0, 8).map((a) => (
                  <li key={`rs-${a.symbol}`}>
                    <span className="font-mono">{a.symbol}</span> {a.name} · {a.googleTicker} · {a.dataStatus}
                    {a.changePct != null ? ` · ${a.changePct.toFixed(2)}%` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {!data?.relatedSector && (data?.relatedSectorRadar ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-slate-600">매칭된 섹터가 없습니다. 원장/관심종목의 섹터·메모에 분야 키워드를 넣거나 `/sector-radar`에서 시트를 새로고침해 보세요.</p>
        ) : null}
        {(() => {
          const extra = (data?.relatedSectorRadar ?? []).filter((m) => !data?.relatedSector || m.key !== data.relatedSector.key);
          if (extra.length === 0) return null;
          return (
            <>
              {data?.relatedSector ? <p className="mt-3 text-xs font-medium text-slate-700">추가 섹터 매칭</p> : null}
              <ul className="mt-2 space-y-3 text-xs">
                {extra.map((m) => (
              <li key={m.key} className="rounded border border-indigo-100 bg-white p-3 text-slate-800">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-slate-900">{m.name}</p>
                  <p className="text-[11px] text-slate-600">
                    confidence: <span className="font-medium">{m.confidence}</span>
                    {m.score != null ? ` · score ${Math.round(m.score)}` : " · score NO_DATA"} · {sectorZoneLabel(m.zone)} ·{" "}
                    {actionHintLabel(m.actionHint)}
                  </p>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-700">{m.narrativeHint}</p>
                {(m.linkedAnchors ?? []).length > 0 ? (
                  <div className="mt-2">
                    <p className="text-[10px] font-medium text-slate-500">linked anchors</p>
                    <ul className="mt-1 space-y-0.5 text-[10px] text-slate-600">
                      {(m.linkedAnchors ?? []).slice(0, 6).map((a) => (
                        <li key={`${m.key}-${a.symbol}`}>
                          <span className="font-mono">{a.symbol}</span> {a.name} · {a.googleTicker} · {a.dataStatus}
                          {a.changePct != null ? ` · ${a.changePct.toFixed(2)}%` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {(m.matchReasons ?? []).length > 0 ? (
                  <p className="mt-2 text-[10px] text-slate-500">매칭 근거: {m.matchReasons.join(", ")}</p>
                ) : null}
              </li>
                ))}
              </ul>
            </>
          );
        })()}
      </section>

      <section className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">1) 내가 산 이유</h2>
          <p className="mt-2 whitespace-pre-wrap text-slate-700">{data?.thesis?.reason ?? "NO_DATA"}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">2) 목표가 / 손절가</h2>
          <p className="mt-2 text-slate-700">목표가: {fmt(data?.thesis?.targetPrice)}</p>
          <p className="mt-1 text-slate-700">손절/무효화: {fmt(data?.thesis?.stopPrice)}</p>
          <p className="mt-1 text-xs text-slate-500">판단 메모: {data?.thesis?.memo ?? "NO_DATA"}</p>
        </div>
      </section>

      <section className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">3) 최근 PB 의견</h2>
          <p className="mt-2 whitespace-pre-wrap text-slate-700">{data?.pbLatest?.content ?? "NO_DATA"}</p>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">4) 최근 위원회 의견</h2>
          <p className="mt-2 text-slate-700">{data?.committeeLatest?.topic ?? "NO_DATA"}</p>
          <p className="mt-1 whitespace-pre-wrap text-slate-600">{data?.committeeLatest?.summary ?? ""}</p>
        </div>
      </section>

      <section className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">5) 최근 Journal</h2>
          {(data?.recentJournal ?? []).length === 0 ? (
            <p className="mt-2 text-slate-500">NO_DATA</p>
          ) : (
            <ul className="mt-2 space-y-2 text-xs">
              {(data?.recentJournal ?? []).map((j) => (
                <li key={j.id} className="rounded border border-slate-100 bg-slate-50 p-2">
                  <p>{j.tradeDate} · {j.side}</p>
                  <p className="mt-1 text-slate-700">{j.thesisSummary ?? j.tradeReason ?? j.note ?? "NO_DATA"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">6) Trend / Research 연결</h2>
          <ul className="mt-2 space-y-2 text-xs">
            {(data?.trendSignals ?? []).slice(0, 6).map((t, idx) => (
              <li key={`${t.title}-${idx}`} className="rounded border border-slate-100 bg-slate-50 p-2">
                <p className="font-medium">{t.title}</p>
                <p className="mt-1 text-slate-700">{t.summary}</p>
                <p className="mt-1 text-[10px] text-slate-500">confidence: {t.confidence ?? "low"}</p>
              </li>
            ))}
            {(data?.trendSignals ?? []).length === 0 ? <li className="text-slate-500">NO_DATA</li> : null}
          </ul>
        </div>
      </section>

      <section className="mb-4 rounded border border-slate-200 bg-white p-4 text-sm">
        <h2 className="font-semibold">7) 매수/매도 이력 (사후 반영)</h2>
        {(data?.tradeEvents ?? []).length === 0 ? (
          <p className="mt-2 text-slate-500">NO_DATA</p>
        ) : (
          <div className="mt-2 overflow-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-1 text-left">일자</th>
                  <th className="px-2 py-1 text-left">유형</th>
                  <th className="px-2 py-1 text-right">수량/단가</th>
                  <th className="px-2 py-1 text-right">전/후 수량</th>
                  <th className="px-2 py-1 text-right">실현손익</th>
                  <th className="px-2 py-1 text-left">메모</th>
                </tr>
              </thead>
              <tbody>
                {(data?.tradeEvents ?? []).map((evt) => (
                  <tr key={evt.id} className="border-b border-slate-100">
                    <td className="px-2 py-1">{evt.tradeDate}</td>
                    <td className="px-2 py-1">{evt.eventType}</td>
                    <td className="px-2 py-1 text-right">{evt.quantity ?? "—"} / {evt.price == null ? "—" : fmt(evt.price)}</td>
                    <td className="px-2 py-1 text-right">{evt.beforeQuantity ?? "—"} → {evt.afterQuantity ?? "—"}</td>
                    <td className="px-2 py-1 text-right">{fmt(evt.realizedPnlKrw)}</td>
                    <td className="px-2 py-1">{evt.reason ?? evt.memo ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">8) Thesis Health</h2>
          <p className="mt-2 text-slate-700">
            status: {data?.thesisHealth?.status ?? "unknown"} · score: {data?.thesisHealth?.score ?? "NO_DATA"} · confidence: {data?.thesisHealth?.confidence ?? "low"}
          </p>
          <ul className="mt-2 list-disc pl-4 text-xs text-slate-600">
            {(data?.thesisHealth?.reasons ?? []).map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold">9) Active Alerts</h2>
          {(data?.alerts ?? []).length === 0 ? (
            <p className="mt-2 text-slate-500">NO_DATA</p>
          ) : (
            <ul className="mt-2 space-y-2 text-xs">
              {(data?.alerts ?? []).map((a, idx) => (
                <li key={`${a.title}-${idx}`} className="rounded border border-slate-100 bg-slate-50 p-2">
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-1 text-slate-700">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

