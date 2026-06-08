"use client";

import { useMemo } from 'react';
import type { InfographicSpec } from '@office-unify/shared-types';
import { buildInfographicDisplayModel } from '@/lib/infographic/infographicDisplayModel';

function clampText(text: string, max = 110): { short: string; truncated: boolean } {
  if (text.length <= max) return { short: text, truncated: false };
  return { short: `${text.slice(0, Math.max(0, max - 3))}...`, truncated: true };
}

function ExpandableText({ text, max = 110, label = '자세히 보기' }: { text: string; max?: number; label?: string }) {
  const clamped = clampText(text, max);
  if (!clamped.truncated) return <>{clamped.short}</>;
  return (
    <>
      {clamped.short}
      <details className="mt-1">
        <summary className="cursor-pointer text-[11px] font-medium text-slate-500">{label}</summary>
        <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-700">{text}</p>
      </details>
    </>
  );
}

export function ResponsiveInfographicView({ spec }: { spec: InfographicSpec }) {
  const validCharts = useMemo(() => {
    const bar = spec.charts.bar
      .filter((c) => typeof c.value === 'number' && Number.isFinite(c.value))
      .map((c) => ({ kind: 'bar' as const, label: c.label, value: c.value as number }));
    const pie = spec.charts.pie
      .filter((c) => typeof c.value === 'number' && Number.isFinite(c.value))
      .map((c) => ({ kind: 'pie' as const, label: c.label, value: c.value as number }));
    const line = spec.charts.line
      .filter((c) => typeof c.value === 'number' && Number.isFinite(c.value))
      .map((c) => ({ kind: 'line' as const, label: c.label, value: c.value as number }));
    return [...bar, ...pie, ...line];
  }, [spec.charts.bar, spec.charts.line, spec.charts.pie]);

  const headlineFlow = spec.flows.slice(0, 3);
  const extraFlow = spec.flows.slice(3);
  const display = useMemo(() => buildInfographicDisplayModel(spec), [spec]);

  return (
    <div className="max-w-full space-y-4 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 text-slate-900">
      <div className="min-w-0 space-y-2">
        <h2 className="break-words text-lg font-bold leading-tight">{spec.title}</h2>
        <p className="break-words text-sm text-slate-600">{spec.subtitle}</p>
        <p className="break-words text-sm leading-relaxed text-slate-700">{spec.summary}</p>
        <div className="flex max-w-full flex-wrap gap-1">
          {spec.sourceMeta.resultMode ? (
            <span className="rounded bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-800">
              {spec.sourceMeta.resultMode}
            </span>
          ) : null}
          {spec.sourceMeta.extractionMode ? (
            <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
              {spec.sourceMeta.extractionMode}
            </span>
          ) : null}
          {spec.sourceMeta.confidence ? (
            <span className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800">
              confidence: {spec.sourceMeta.confidence}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {spec.zones.map((zone) => (
          <section key={zone.id} className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="break-words text-sm font-semibold text-slate-800">{zone.name}</p>
            <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-700">
              {zone.items.slice(0, 3).map((item) => (
                <li key={item} className="break-words">
                  <ExpandableText text={item} max={74} />
                </li>
              ))}
            </ul>
            {zone.items.length > 3 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-medium text-slate-500">
                  추가 항목 {zone.items.length - 3}개
                </summary>
                <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-slate-600">
                  {zone.items.slice(3).map((item) => (
                    <li key={`${zone.id}-${item}`} className="break-words">
                      <ExpandableText text={item} max={64} label="전체 보기" />
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>
        ))}
      </div>

      <section className="min-w-0 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-semibold text-slate-700">흐름 요약</p>
        {headlineFlow.length > 0 ? (
          <div className="mt-1 flex max-w-full flex-wrap gap-1">
            {headlineFlow.map((flow, idx) => (
              <span
                key={`${flow.from}-${flow.to}-${idx}`}
                className="max-w-full break-words rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700"
              >
                {flow.from} → {flow.to} · {flow.label || flow.type}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-500">연결 흐름 데이터가 부족해 카드 요약만 표시합니다.</p>
        )}
        {extraFlow.length > 0 ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-medium text-slate-500">
              추가 흐름 {extraFlow.length}개
            </summary>
            <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-slate-600">
              {extraFlow.map((flow, idx) => (
                <li key={`${flow.from}-${flow.to}-extra-${idx}`} className="break-words">
                  {flow.from} → {flow.to} · {flow.label || flow.type}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <section className="min-w-0 rounded-md border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-700">주요 플레이어</p>
          <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-700">
            {spec.lineup.slice(0, 4).map((item) => (
              <li key={item.name} className="break-words">
                <span className="font-medium">{item.name}</span> ({item.category})
                {item.note ? <p className="mt-0.5 text-[11px] text-slate-500">{clampText(item.note, 72).short}</p> : null}
              </li>
            ))}
          </ul>
        </section>
        <section className="min-w-0 rounded-md border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-700">핵심 리스크</p>
          <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-700">
            {spec.risks.slice(0, 4).map((item) => (
              <li key={item.title} className="break-words">
                <p className="font-medium">{item.title}</p>
                {item.description ? <p className="text-[11px] text-slate-500">{clampText(item.description, 72).short}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="min-w-0 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-semibold text-slate-700">차트 요약</p>
        {display.hasChartData && validCharts.length > 0 ? (
          <div className="mt-1 max-w-full overflow-x-auto">
            <ul className="min-w-0 space-y-1 text-xs leading-relaxed text-slate-700">
              {validCharts.slice(0, 4).map((c) => (
                <li key={`${c.kind}-${c.label}`} className="break-words">
                  {c.label}: {c.value} <span className="text-slate-400">({c.kind})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-1 break-words text-xs leading-relaxed text-slate-600">
            {display.chartFallbackMessage}
          </p>
        )}
        {display.structureFallbackMessage ? (
          <p className="mt-1 break-words text-[11px] leading-relaxed text-slate-500">
            {display.structureFallbackMessage}
          </p>
        ) : null}
      </section>

      <section className="min-w-0 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-semibold text-slate-700">메모</p>
        <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-700">
          {spec.notes.slice(0, 2).map((note, idx) => (
            <li key={`${note}-${idx}`} className="break-words">
              <ExpandableText text={note} max={88} label="전체 보기" />
            </li>
          ))}
        </ul>
        {spec.notes.length > 2 ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-medium text-slate-500">
              추가 메모 {spec.notes.length - 2}개
            </summary>
            <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-slate-600">
              {spec.notes.slice(2).map((note, idx) => (
                <li key={`extra-note-${idx}`} className="break-words">
                  <ExpandableText text={note} max={72} label="전체 보기" />
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}
