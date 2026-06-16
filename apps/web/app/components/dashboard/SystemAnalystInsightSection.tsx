"use client";

import Link from "next/link";
import type { SystemAnalystDataCoverage, SystemAnalystInsight, SystemAnalystRecommendation } from "@/lib/server/systemAnalystInsights";

type Props = {
  dataIssueCount: number;
  repeatedPatternCount: number;
  blockerCount: number;
  insights?: SystemAnalystInsight[] | null;
  dataCoverage?: SystemAnalystDataCoverage[] | null;
  recommendations?: SystemAnalystRecommendation[] | null;
};

export function SystemAnalystInsightSection({ dataIssueCount, repeatedPatternCount, blockerCount, insights, dataCoverage, recommendations }: Props) {
  return (
    <details className="mb-4 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <summary className="cursor-pointer font-semibold text-slate-900">
        시스템 담당자 의견 보기
        <span className="ml-2 text-xs font-normal text-slate-500">
          데이터 이슈 {dataIssueCount}건 · 반복 패턴 {repeatedPatternCount}건 · blocker {blockerCount}건
        </span>
      </summary>
      <div className="mt-3 rounded border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold text-slate-900">시스템 담당자 · SM 전문가 · 개선 포인트 제안가</p>
        <p className="mt-1">
          투자 판단자가 아니라 시스템 품질, 데이터 흐름, UX 병목, 로그, 실패 원인, 개선 우선순위를 보는 역할입니다.
        </p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div>
            <p className="font-medium text-slate-900">이번 분석에 사용한 데이터</p>
            <ul className="mt-1 list-disc pl-4">
              {(dataCoverage?.length ? dataCoverage : [
                { sourceType: 'screen_flow', status: 'partial', limitation: '화면 구조와 운영 상태 중심으로 판단했습니다.' },
              ] as SystemAnalystDataCoverage[]).map((coverage) => (
                <li key={coverage.sourceType}>
                  {coverage.sourceType}: {coverage.status}
                  {typeof coverage.itemCount === "number" ? ` · ${coverage.itemCount}건` : ""}
                  {coverage.limitation ? <span className="block text-slate-500">{coverage.limitation}</span> : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">
              분석 한계: 실제 클릭률/체류시간 데이터가 없으면 화면 구조와 readiness 중심으로만 판단합니다. PB memory는 시스템 UX 판단에 과도하게 쓰지 않습니다.
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-900">현재 제안</p>
            {(insights?.length ? insights : []).map((insight) => (
              <div key={`${insight.area}-${insight.priority}`} className="mt-2 rounded border border-slate-200 bg-white p-2">
                <p className="font-semibold text-slate-900">[{insight.area}] {insight.userPain}</p>
                <p className="mt-1">원인 가설: {insight.suspectedCause}</p>
                <p className="mt-1">개선 우선순위 {insight.priority}: {insight.recommendedFix}</p>
                <p className="mt-1 text-[11px] text-slate-500">근거: {insight.evidence.join(" · ")}</p>
                <p className="mt-1 text-[11px] text-slate-500">출처: {insight.sourceTypes.join(" · ")}</p>
              </div>
            ))}
            {!insights?.length ? <p className="mt-1">홈 IA와 운영 상태 근거를 불러오는 중입니다.</p> : null}
            {recommendations?.length ? (
              <div className="mt-3 space-y-2">
                <p className="font-medium text-slate-900">개선 제안 lifecycle</p>
                {recommendations.map((rec) => (
                  <div key={rec.id} className="rounded border border-slate-200 bg-white p-2">
                    <p className="font-semibold text-slate-900">[{rec.priority}] {rec.title}</p>
                    <p className="mt-1">{rec.suggestedChange}</p>
                    <p className="mt-1 text-[11px] text-slate-500">상태: {rec.status} · 자동 저장 없음</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Link href="/ops-events" className="rounded border border-slate-300 bg-white px-2 py-1">개선 항목 자세히</Link>
                      <Link href={`/action-items?prefill=${encodeURIComponent(rec.id)}`} className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-violet-950">Action Inbox에 저장</Link>
                      <button type="button" className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">이번에는 숨기기</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <Link href="/ops-events" className="mt-2 inline-block rounded border border-slate-300 bg-white px-2 py-1">
              운영 로그 보기
            </Link>
          </div>
        </div>
      </div>
    </details>
  );
}
