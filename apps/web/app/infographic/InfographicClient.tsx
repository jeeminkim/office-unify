"use client";

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  InfographicArticlePattern,
  InfographicIndustryPattern,
  InfographicInputSourceType,
  InfographicSpec,
} from '@office-unify/shared-types';
import { InfographicCanvas } from '@/components/infographic/InfographicCanvas';
import { ResponsiveInfographicView } from '@/components/infographic/ResponsiveInfographicView';
import { useInfographicGenerator } from '@/hooks/useInfographicGenerator';
import { SEMICONDUCTOR_SAMPLE_SPEC, SPACE_SAMPLE_SPEC } from '@/lib/infographic/samples';
import {
  CYBERSECURITY_REGRESSION_TEXT,
  HEALTHCARE_INSTITUTIONAL_REGRESSION_TEXT,
  MARKET_COMMENTARY_REGRESSION_TEXT,
  OPINION_EDITORIAL_REGRESSION_TEXT,
  SEMICONDUCTOR_REPORT_REGRESSION_TEXT,
  MIXED_DOCUMENT_REGRESSION_TEXT,
} from '@/lib/infographic/regressionFixtures';

const SAMPLE_TEXT = `반도체 장비 산업은 AI 서버 수요와 고대역폭 메모리 투자가 맞물리며 구조적 변화를 겪고 있습니다.
다만 고객사 투자 사이클, 재고 정상화 속도, 수출 규제는 반드시 확인해야 합니다.
이 글은 산업 구조를 이해하기 위한 재료이며 투자 결론이나 주문 지시가 아닙니다.`;

const ARTICLE_PATTERN_OPTIONS = [
  'industry_report',
  'company_report',
  'opinion_editorial',
  'market_commentary',
  'thematic_analysis',
  'how_to_explainer',
  'mixed_or_unknown',
] as const;

const INDUSTRY_PATTERN_OPTIONS = [
  'manufacturing',
  'semiconductor_electronics',
  'energy_resources',
  'healthcare_bio',
  'software_platform',
  'cybersecurity_service',
  'consumer_retail',
  'finance_insurance',
  'mobility_automotive',
  'media_content',
  'industrials_b2b',
  'mixed_or_unknown',
] as const;

const ARTICLE_PATTERN_LABELS: Record<string, string> = {
  industry_report: '산업 리포트',
  company_report: '기업 리포트',
  opinion_editorial: '블로그/칼럼 의견형',
  market_commentary: '시황 코멘트형',
  thematic_analysis: '테마 분석형',
  how_to_explainer: '설명/가이드형',
  mixed_or_unknown: '혼합형',
};

const DEGRADED_REASON_MESSAGE: Record<string, string> = {
  insufficient_structure: '원문 구조가 약해 infographic draft 대신 읽기 요약을 먼저 제공합니다.',
  mixed_document: '설명, 의견, 광고성 문구가 섞여 있어 핵심 본문만 확인해야 합니다.',
  too_long_and_diffuse: '본문이 길고 주제가 넓습니다. 핵심 문단만 남기면 구조화 안정성이 좋아집니다.',
  weak_numeric_support: '수치 근거가 부족해 차트형 infographic으로 쓰기 어렵습니다.',
  weak_zone_signal: '산업 구조 구분 신호가 약합니다. 배경/주장/근거/시사점 문단을 나눠 보세요.',
  opinion_structure_unclear: '의견형 글로 보이며 주장과 근거를 분리해 확인해야 합니다.',
};

function compactSeed(spec: InfographicSpec | null, fallbackText: string) {
  const summary = spec?.summary || fallbackText.slice(0, 700);
  return {
    source: 'infographic',
    title: spec?.title ?? 'Infographic URL 요약',
    summary: summary.slice(0, 900),
    questions: spec?.lineup?.slice(0, 3).map((x) => x.note || x.name) ?? [],
  };
}

export default function InfographicClient() {
  const [industryName, setIndustryName] = useState('반도체');
  const [rawText, setRawText] = useState(SAMPLE_TEXT);
  const [sourceType, setSourceType] = useState<InfographicInputSourceType>('text');
  const [sourceUrl, setSourceUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [articlePatternOverride, setArticlePatternOverride] = useState<string>('auto');
  const [industryPatternOverride, setIndustryPatternOverride] = useState<string>('auto');
  const [showRawDebug, setShowRawDebug] = useState(false);
  const [showJsonDebug, setShowJsonDebug] = useState(false);
  const [actionStatus, setActionStatus] = useState('');

  const articlePatternRef = useRef<HTMLSelectElement>(null);
  const industryPatternRef = useRef<HTMLSelectElement>(null);
  const extractedTextRef = useRef<HTMLTextAreaElement>(null);

  const {
    loading,
    error,
    spec,
    warnings,
    setSpec,
    generate,
    extractSourceText,
    sourcePreviewText,
    sourcePreviewRawText,
    setSourcePreviewText,
    sourcePreviewMeta,
    degradedMeta,
    pipelineStage,
    requestId,
  } = useInfographicGenerator();

  const activeSpec = useMemo<InfographicSpec | null>(() => spec, [spec]);
  const isDegraded = activeSpec?.sourceMeta?.extractionMode === 'degraded_fallback' || pipelineStage === 'spec_generation_degraded';
  const articlePattern = activeSpec?.sourceMeta?.articlePattern ?? sourcePreviewMeta?.articlePattern ?? 'mixed_or_unknown';
  const articlePatternLabel = ARTICLE_PATTERN_LABELS[articlePattern] ?? '혼합형';
  const canExtract =
    !!industryName.trim() &&
    ((sourceType === 'url' && !!sourceUrl.trim()) ||
      (sourceType === 'pdf_url' && !!pdfUrl.trim()) ||
      (sourceType === 'pdf_upload' && !!pdfFile));
  const canGenerate =
    !!industryName.trim() &&
    (sourceType === 'text' ? !!rawText.trim() : !!sourcePreviewText.trim());

  const buildPayload = (overrideText?: string) => ({
    industryName: industryName.trim(),
    sourceType: sourceType === 'text' ? 'text' as const : 'text' as const,
    rawText: (overrideText ?? (sourceType === 'text' ? rawText : sourcePreviewText)).trim(),
    articlePatternOverride:
      articlePatternOverride !== 'auto' ? (articlePatternOverride as InfographicArticlePattern) : undefined,
    industryPatternOverride:
      industryPatternOverride !== 'auto' ? (industryPatternOverride as InfographicIndustryPattern) : undefined,
  });

  const extractPayload = () => ({
    industryName: industryName.trim(),
    sourceType,
    rawText: sourceType === 'text' ? rawText.trim() : undefined,
    sourceUrl: sourceType === 'url' ? sourceUrl.trim() : undefined,
    pdfUrl: sourceType === 'pdf_url' ? pdfUrl.trim() : undefined,
    articlePatternOverride:
      articlePatternOverride !== 'auto' ? (articlePatternOverride as InfographicArticlePattern) : undefined,
    industryPatternOverride:
      industryPatternOverride !== 'auto' ? (industryPatternOverride as InfographicIndustryPattern) : undefined,
  });

  const handleExtract = async () => {
    setActionStatus('원문 추출 중입니다.');
    await extractSourceText(extractPayload(), sourceType === 'pdf_upload' ? pdfFile : null);
    setActionStatus('원문 추출이 완료되었습니다. 추출 텍스트를 확인한 뒤 구조화 요약을 만들 수 있습니다.');
  };

  const handleGenerate = async () => {
    setActionStatus('구조화 요약을 생성 중입니다.');
    await generate(buildPayload(), null);
    setActionStatus('요약 결과를 업데이트했습니다.');
  };

  const focusArticlePattern = () => {
    setActionStatus('문서 성격 선택으로 이동했습니다.');
    articlePatternRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    articlePatternRef.current?.focus();
  };

  const focusIndustryPattern = () => {
    setActionStatus('산업 패턴 선택으로 이동했습니다.');
    industryPatternRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    industryPatternRef.current?.focus();
  };

  const focusExtractedText = () => {
    setActionStatus('추출 텍스트 편집 영역으로 이동했습니다.');
    extractedTextRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    extractedTextRef.current?.focus();
  };

  const shortenSourceText = () => {
    const base = sourceType === 'text' ? rawText : sourcePreviewText;
    const shortened = base.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 12).join('\n').slice(0, 3500);
    if (sourceType === 'text') setRawText(shortened);
    else setSourcePreviewText(shortened);
    setActionStatus('원문을 더 짧게 정리했습니다. 내용을 확인한 뒤 다시 생성하세요.');
  };

  const copySummary = async () => {
    const text = activeSpec
      ? [activeSpec.title, activeSpec.summary, ...activeSpec.zones.flatMap((z) => [`[${z.name}]`, ...z.items])].join('\n')
      : sourcePreviewText;
    await navigator.clipboard.writeText(text.slice(0, 5000));
    setActionStatus('요약을 클립보드에 복사했습니다.');
  };

  const sendToResearch = () => {
    window.sessionStorage.setItem('office_unify_research_seed', JSON.stringify(compactSeed(activeSpec, sourcePreviewText || rawText)));
    setActionStatus('Research Center로 보낼 compact seed를 준비했습니다.');
    window.location.href = '/research-center';
  };

  const sampleButtons = [
    ['반도체 리포트 샘플', '반도체', SEMICONDUCTOR_REPORT_REGRESSION_TEXT],
    ['보안 회귀 샘플', '사이버보안', CYBERSECURITY_REGRESSION_TEXT],
    ['기관 인사이트 샘플', '헬스케어', HEALTHCARE_INSTITUTIONAL_REGRESSION_TEXT],
    ['의견형 샘플', 'AI 플랫폼', OPINION_EDITORIAL_REGRESSION_TEXT],
    ['시황형 샘플', '시장 시황', MARKET_COMMENTARY_REGRESSION_TEXT],
    ['혼합형 샘플', '혼합 문서', MIXED_DOCUMENT_REGRESSION_TEXT],
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-slate-800">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Infographic Generator</h1>
        <p className="mt-2 text-sm text-slate-600">
          URL, PDF, 본문을 원문 추출 → 읽기 요약 → 구조화 분석 → infographic draft 단계로 처리합니다.
          draft가 실패해도 원문을 읽었다면 요약과 확인 질문은 남깁니다.
        </p>
        <p className="mt-1 text-xs text-slate-500">현재 단계: {pipelineStage} · 문서 성격: {articlePatternLabel}</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="text-slate-600">산업명</span>
            <input className="rounded border border-slate-300 px-2 py-2 text-sm" value={industryName} onChange={(e) => setIndustryName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="text-slate-600">입력 소스</span>
            <select className="rounded border border-slate-300 px-2 py-2 text-sm" value={sourceType} onChange={(e) => setSourceType(e.target.value as InfographicInputSourceType)}>
              <option value="text">본문 붙여넣기</option>
              <option value="url">URL</option>
              <option value="pdf_upload">PDF 업로드</option>
              <option value="pdf_url">PDF URL</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-600">문서 성격</span>
            <select ref={articlePatternRef} className="rounded border border-slate-300 px-2 py-2 text-sm" value={articlePatternOverride} onChange={(e) => setArticlePatternOverride(e.target.value)}>
              <option value="auto">자동 감지</option>
              {ARTICLE_PATTERN_OPTIONS.map((v) => <option key={v} value={v}>{ARTICLE_PATTERN_LABELS[v] ?? v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-600">산업 패턴</span>
            <select ref={industryPatternRef} className="rounded border border-slate-300 px-2 py-2 text-sm" value={industryPatternOverride} onChange={(e) => setIndustryPatternOverride(e.target.value)}>
              <option value="auto">자동 감지</option>
              {INDUSTRY_PATTERN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          {sourceType === 'text' ? (
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="text-slate-600">본문</span>
              <textarea className="min-h-[220px] rounded border border-slate-300 px-3 py-2 text-sm" value={rawText} onChange={(e) => setRawText(e.target.value)} />
            </label>
          ) : null}
          {sourceType === 'url' ? (
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="text-slate-600">URL</span>
              <input className="rounded border border-slate-300 px-2 py-2 text-sm" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
            </label>
          ) : null}
          {sourceType === 'pdf_url' ? (
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="text-slate-600">PDF URL</span>
              <input className="rounded border border-slate-300 px-2 py-2 text-sm" value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="https://.../report.pdf" />
            </label>
          ) : null}
          {sourceType === 'pdf_upload' ? (
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="text-slate-600">PDF 업로드</span>
              <input type="file" accept="application/pdf,.pdf" className="rounded border border-slate-300 px-2 py-2 text-sm" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {sourceType !== 'text' ? (
            <button type="button" onClick={() => void handleExtract()} disabled={loading || !canExtract} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-50">
              {loading ? '원문 추출 중' : '원문 추출'}
            </button>
          ) : null}
          <button type="button" onClick={() => void handleGenerate()} disabled={loading || !canGenerate} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {loading ? '구조화 요약 생성 중' : '구조화 요약 생성'}
          </button>
          <button type="button" onClick={() => setSpec(SEMICONDUCTOR_SAMPLE_SPEC)} className="rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">반도체 샘플</button>
          <button type="button" onClick={() => setSpec(SPACE_SAMPLE_SPEC)} className="rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">우주 샘플</button>
          {sampleButtons.map(([label, industry, text]) => (
            <button key={label} type="button" onClick={() => { setIndustryName(industry); setSourceType('text'); setRawText(text); setSourcePreviewText(''); setActionStatus(`${label}을 불러왔습니다.`); }} className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              {label}
            </button>
          ))}
          <Link href="/research-center" className="rounded border border-slate-200 px-3 py-2 text-xs text-slate-600">Research Center로 이동</Link>
        </div>

        {actionStatus ? <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{actionStatus}</p> : null}
        {requestId ? <p className="mt-2 text-xs text-slate-500">요청 ID: {requestId}</p> : null}
        {error ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <p>{error}</p>
            <p className="mt-1 text-xs text-red-800">본문을 직접 붙여넣어 계속할 수 있습니다. raw AbortError나 내부 debug 코드는 기본 화면에 표시하지 않습니다.</p>
          </div>
        ) : null}
        {sourcePreviewMeta?.actionReason ? (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p className="font-semibold">{sourcePreviewMeta.actionReason.userTitleKo}</p>
            <p className="mt-1 text-xs">{sourcePreviewMeta.actionReason.userMessageKo}</p>
            <p className="mt-1 text-xs">
              다음 행동: {sourcePreviewMeta.actionReason.primaryActionLabelKo} · {sourcePreviewMeta.actionReason.actionHintKo}
            </p>
          </div>
        ) : null}
        {warnings.length > 0 ? (
          <details className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <summary className="cursor-pointer font-semibold">처리 경고 보기</summary>
            <ul className="mt-2 list-inside list-disc">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        ) : null}
      </section>

      {sourceType !== 'text' ? (
        <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">추출 텍스트 미리보기/수정</p>
          <textarea ref={extractedTextRef} className="min-h-[220px] w-full rounded border border-slate-300 px-3 py-2 text-sm" value={sourcePreviewText} onChange={(e) => setSourcePreviewText(e.target.value)} placeholder="먼저 원문 추출을 누르거나 본문을 직접 붙여넣으세요." />
          <button type="button" onClick={() => setShowRawDebug((v) => !v)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">
            {showRawDebug ? '원문/디버그 숨기기' : '원문 추출 테스트 보기'}
          </button>
          {showRawDebug ? (
            <div className="space-y-2">
              <pre className="max-h-[220px] overflow-auto rounded border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(sourcePreviewMeta, null, 2)}</pre>
              <textarea readOnly className="min-h-[160px] w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs" value={sourcePreviewRawText} />
            </div>
          ) : null}
        </section>
      ) : null}

      {activeSpec ? (
        <section className="space-y-3">
          {isDegraded ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Infographic 초안은 생성하지 못했지만, 원문 기반 요약은 사용할 수 있습니다.
              {degradedMeta?.degradedReasons?.length ? (
                <ul className="mt-2 list-inside list-disc text-xs">
                  {degradedMeta.degradedReasons.map((reason) => <li key={reason}>{DEGRADED_REASON_MESSAGE[reason] ?? '요약 품질을 보정했습니다.'}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">읽기 요약</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{activeSpec.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{activeSpec.summary}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {activeSpec.zones.map((zone) => (
                <div key={zone.id} className="rounded border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">{zone.name}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
                    {zone.items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {!isDegraded ? <ResponsiveInfographicView spec={activeSpec} /> : null}
          {!isDegraded ? <InfographicCanvas spec={activeSpec} /> : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copySummary()} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">요약 복사</button>
            <button type="button" onClick={sendToResearch} className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs text-white">Research Center로 보내기</button>
            <button type="button" onClick={focusExtractedText} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">본문 직접 수정</button>
            <button type="button" onClick={() => void handleGenerate()} disabled={loading || !canGenerate} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50">Infographic 다시 생성</button>
            <button type="button" onClick={shortenSourceText} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">원문 더 짧게 정리</button>
            <button type="button" onClick={focusArticlePattern} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">문서 성격 바꾸기</button>
            <button type="button" onClick={focusIndustryPattern} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">산업 패턴 바꾸기</button>
          </div>

          <button type="button" onClick={() => setShowJsonDebug((v) => !v)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700">
            {showJsonDebug ? 'JSON 디버그 숨기기' : 'JSON 디버그 보기'}
          </button>
          {showJsonDebug ? <pre className="max-h-[420px] overflow-auto rounded border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(activeSpec, null, 2)}</pre> : null}
        </section>
      ) : null}
    </div>
  );
}
