"use client";

import { useMemo, useRef, useState, type ReactNode } from 'react';
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
import { buildInfographicDisplayModel } from '@/lib/infographic/infographicDisplayModel';
import { SEMICONDUCTOR_SAMPLE_SPEC, SPACE_SAMPLE_SPEC } from '@/lib/infographic/samples';
import {
  CYBERSECURITY_REGRESSION_TEXT,
  HEALTHCARE_INSTITUTIONAL_REGRESSION_TEXT,
  MARKET_COMMENTARY_REGRESSION_TEXT,
  MIXED_DOCUMENT_REGRESSION_TEXT,
  OPINION_EDITORIAL_REGRESSION_TEXT,
  SEMICONDUCTOR_REPORT_REGRESSION_TEXT,
} from '@/lib/infographic/regressionFixtures';

const SAMPLE_TEXT = `AI 데이터센터 투자는 반도체, 전력 장비, 냉각 설비, 네트워크 장비로 확산되고 있습니다.
수요가 빠르게 늘어도 전력 확보, 설비 투자 속도, 고객 집중도, 규제 리스크는 함께 확인해야 합니다.
이 자료는 산업 구조를 이해하기 위한 입력이며 투자 결론이나 주문 지시가 아닙니다.`;

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
  opinion_editorial: '의견/칼럼',
  market_commentary: '시장 코멘터리',
  thematic_analysis: '테마 분석',
  how_to_explainer: '설명/가이드',
  mixed_or_unknown: '혼합형',
};

const INDUSTRY_PATTERN_LABELS: Record<string, string> = {
  manufacturing: '제조',
  semiconductor_electronics: '반도체/전자',
  energy_resources: '에너지/자원',
  healthcare_bio: '헬스케어/바이오',
  software_platform: '소프트웨어/플랫폼',
  cybersecurity_service: '보안/서비스',
  consumer_retail: '소비재/유통',
  finance_insurance: '금융/보험',
  mobility_automotive: '모빌리티/자동차',
  media_content: '미디어/콘텐츠',
  industrials_b2b: '산업재/B2B',
  mixed_or_unknown: '혼합/미확인',
};

const DEGRADED_REASON_MESSAGE: Record<string, string> = {
  insufficient_structure: '자료 구조가 약해 카드형 요약을 먼저 표시합니다.',
  mixed_document: '설명, 의견, 홍보 문구가 섞여 있어 본문 확인이 필요합니다.',
  too_long_and_diffuse: '본문이 길고 주제가 넓습니다. 핵심 문단만 남기면 구조가 안정됩니다.',
  weak_numeric_support: '수치 근거가 부족해 차트보다 카드 요약이 적합합니다.',
  weak_zone_signal: '산업 구조 구분 신호가 약합니다. 배경, 주장, 근거, 시사점을 나눠 보세요.',
  opinion_structure_unclear: '의견형 글로 보입니다. 주장과 근거를 분리해 확인해야 합니다.',
};

const SAMPLE_BUTTONS = [
  ['반도체 리포트', '반도체', SEMICONDUCTOR_REPORT_REGRESSION_TEXT],
  ['보안 보고서', '사이버보안', CYBERSECURITY_REGRESSION_TEXT],
  ['헬스케어 보고서', '헬스케어', HEALTHCARE_INSTITUTIONAL_REGRESSION_TEXT],
  ['의견형 글', 'AI 플랫폼', OPINION_EDITORIAL_REGRESSION_TEXT],
  ['시장 코멘터리', '시장 상황', MARKET_COMMENTARY_REGRESSION_TEXT],
  ['혼합 문서', '혼합 문서', MIXED_DOCUMENT_REGRESSION_TEXT],
] as const;

function compactSeed(spec: InfographicSpec | null, fallbackText: string) {
  const summary = spec?.summary || fallbackText.slice(0, 700);
  return {
    source: 'infographic',
    title: spec?.title ?? 'Infographic URL 요약',
    summary: summary.slice(0, 900),
    questions: spec?.lineup?.slice(0, 3).map((item) => item.note || item.name) ?? [],
  };
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function ActionButton({
  children,
  disabled,
  disabledReason,
  onClick,
  primary = false,
}: {
  children: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={
          primary
            ? 'w-full rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'
            : 'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto'
        }
      >
        {children}
      </button>
      {disabled && disabledReason ? <p className="mt-1 max-w-[220px] text-[11px] text-slate-500">{disabledReason}</p> : null}
    </div>
  );
}

export default function InfographicClient() {
  const [industryName, setIndustryName] = useState('AI 데이터센터 인프라');
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
  const displayModel = useMemo(() => (activeSpec ? buildInfographicDisplayModel(activeSpec) : null), [activeSpec]);
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
  const extractDisabledReason = !industryName.trim()
    ? '산업명을 입력해야 합니다.'
    : sourceType === 'url' && !sourceUrl.trim()
      ? 'URL을 입력해야 본문을 추출할 수 있습니다.'
      : sourceType === 'pdf_url' && !pdfUrl.trim()
        ? 'PDF URL을 입력해야 합니다.'
        : sourceType === 'pdf_upload' && !pdfFile
          ? 'PDF 파일을 선택해야 합니다.'
          : loading
            ? '처리 중입니다.'
            : undefined;
  const generateDisabledReason = !industryName.trim()
    ? '산업명을 입력해야 합니다.'
    : sourceType === 'text' && !rawText.trim()
      ? '본문을 입력해야 합니다.'
      : sourceType !== 'text' && !sourcePreviewText.trim()
        ? '먼저 본문을 추출하거나 직접 붙여넣어 주세요.'
        : loading
          ? '처리 중입니다.'
          : undefined;

  const buildPayload = (overrideText?: string) => ({
    industryName: industryName.trim(),
    sourceType: 'text' as const,
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
    setActionStatus('본문을 추출하는 중입니다.');
    await extractSourceText(extractPayload(), sourceType === 'pdf_upload' ? pdfFile : null);
    setActionStatus('본문 추출이 끝났습니다. 추출 텍스트를 확인한 뒤 카드형 요약을 생성할 수 있습니다.');
  };

  const handleGenerate = async () => {
    setActionStatus('카드형 산업 요약을 생성하는 중입니다.');
    await generate(buildPayload(), null);
    setActionStatus('요약 결과를 업데이트했습니다.');
  };

  const focusArticlePattern = () => {
    setActionStatus('문서 성격 선택 영역으로 이동했습니다.');
    articlePatternRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    articlePatternRef.current?.focus();
  };

  const focusIndustryPattern = () => {
    setActionStatus('산업 패턴 선택 영역으로 이동했습니다.');
    industryPatternRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    industryPatternRef.current?.focus();
  };

  const focusExtractedText = () => {
    setActionStatus('본문 편집 영역으로 이동했습니다.');
    extractedTextRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    extractedTextRef.current?.focus();
  };

  const shortenSourceText = () => {
    const base = sourceType === 'text' ? rawText : sourcePreviewText;
    const shortened = base
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 12)
      .join('\n')
      .slice(0, 3500);
    if (sourceType === 'text') setRawText(shortened);
    else setSourcePreviewText(shortened);
    setActionStatus('본문을 더 짧게 정리했습니다. 내용을 확인한 뒤 다시 생성하세요.');
  };

  const copySummary = async () => {
    const text = activeSpec
      ? [activeSpec.title, activeSpec.summary, ...activeSpec.zones.flatMap((zone) => [`[${zone.name}]`, ...zone.items])].join('\n')
      : sourcePreviewText;
    await navigator.clipboard.writeText(text.slice(0, 5000));
    setActionStatus('요약을 클립보드에 복사했습니다.');
  };

  const sendToResearch = () => {
    window.sessionStorage.setItem('office_unify_research_seed', JSON.stringify(compactSeed(activeSpec, sourcePreviewText || rawText)));
    setActionStatus('Research Center로 보낼 compact seed를 준비했습니다.');
    window.location.href = '/research-center';
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 text-slate-800">
      <header className="min-w-0">
        <h1 className="break-keep text-2xl font-bold tracking-tight text-slate-950">Infographic Generator</h1>
        <p className="mt-2 break-words text-sm leading-relaxed text-slate-600">
          URL, PDF, 붙여넣은 본문을 카드형 산업 요약으로 정리합니다. 차트 데이터가 부족해도 읽을 수 있는 결과를 먼저 보여줍니다.
        </p>
        <p className="mt-1 break-words text-xs text-slate-500">
          현재 단계: {pipelineStage} · 문서 성격: {articlePatternLabel} · 자동 저장 없음
        </p>
      </header>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <FieldLabel label="산업명">
              <input
                className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                value={industryName}
                onChange={(event) => setIndustryName(event.target.value)}
              />
            </FieldLabel>
          </div>
          <div className="md:col-span-2">
            <FieldLabel label="입력 소스">
              <select
                className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value as InfographicInputSourceType)}
              >
                <option value="text">본문 붙여넣기</option>
                <option value="url">URL</option>
                <option value="pdf_upload">PDF 업로드</option>
                <option value="pdf_url">PDF URL</option>
              </select>
            </FieldLabel>
          </div>
          <FieldLabel label="문서 성격">
            <select
              ref={articlePatternRef}
              className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={articlePatternOverride}
              onChange={(event) => setArticlePatternOverride(event.target.value)}
            >
              <option value="auto">자동 감지</option>
              {ARTICLE_PATTERN_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {ARTICLE_PATTERN_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="산업 패턴">
            <select
              ref={industryPatternRef}
              className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={industryPatternOverride}
              onChange={(event) => setIndustryPatternOverride(event.target.value)}
            >
              <option value="auto">자동 감지</option>
              {INDUSTRY_PATTERN_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {INDUSTRY_PATTERN_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </FieldLabel>

          {sourceType === 'text' ? (
            <div className="md:col-span-2">
              <FieldLabel label="본문">
                <textarea
                  className="min-h-[220px] w-full rounded border border-slate-300 px-3 py-2 text-sm leading-relaxed"
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                />
              </FieldLabel>
            </div>
          ) : null}
          {sourceType === 'url' ? (
            <div className="md:col-span-2">
              <FieldLabel label="URL">
                <input
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://..."
                />
              </FieldLabel>
            </div>
          ) : null}
          {sourceType === 'pdf_url' ? (
            <div className="md:col-span-2">
              <FieldLabel label="PDF URL">
                <input
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  value={pdfUrl}
                  onChange={(event) => setPdfUrl(event.target.value)}
                  placeholder="https://.../report.pdf"
                />
              </FieldLabel>
            </div>
          ) : null}
          {sourceType === 'pdf_upload' ? (
            <div className="md:col-span-2">
              <FieldLabel label="PDF 업로드">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                />
              </FieldLabel>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {sourceType !== 'text' ? (
            <ActionButton
              onClick={() => void handleExtract()}
              disabled={loading || !canExtract}
              disabledReason={extractDisabledReason}
            >
              {loading ? '본문 추출 중' : '본문 추출'}
            </ActionButton>
          ) : null}
          <ActionButton
            onClick={() => void handleGenerate()}
            disabled={loading || !canGenerate}
            disabledReason={generateDisabledReason}
            primary
          >
            {loading ? '요약 생성 중' : '카드형 요약 생성'}
          </ActionButton>
          <ActionButton onClick={() => setSpec(SEMICONDUCTOR_SAMPLE_SPEC)}>반도체 샘플</ActionButton>
          <ActionButton onClick={() => setSpec(SPACE_SAMPLE_SPEC)}>우주 샘플</ActionButton>
          <Link className="rounded border border-slate-200 px-3 py-2 text-center text-sm text-slate-600" href="/research-center">
            Research Center
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE_BUTTONS.map(([label, industry, text]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setIndustryName(industry);
                setSourceType('text');
                setRawText(text);
                setSourcePreviewText('');
                setActionStatus(`${label} 샘플을 불러왔습니다.`);
              }}
              className="rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800"
            >
              {label}
            </button>
          ))}
        </div>

        {actionStatus ? <p className="mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">{actionStatus}</p> : null}
        {requestId ? <p className="mt-2 text-xs text-slate-500">요청 ID: {requestId}</p> : null}
        {error ? (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <p>{error}</p>
            <p className="mt-1 text-xs text-red-800">
              본문을 직접 붙여넣어 계속할 수 있습니다. 원본 오류나 debug 코드는 기본 화면에 먼저 노출하지 않습니다.
            </p>
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
            <ul className="mt-2 list-inside list-disc">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {sourceType !== 'text' ? (
        <section className="min-w-0 space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">추출 텍스트 미리보기/수정</p>
          <textarea
            ref={extractedTextRef}
            className="min-h-[220px] w-full rounded border border-slate-300 px-3 py-2 text-sm leading-relaxed"
            value={sourcePreviewText}
            onChange={(event) => setSourcePreviewText(event.target.value)}
            placeholder="먼저 본문 추출을 누르거나 본문을 직접 붙여넣으세요."
          />
          <button
            type="button"
            onClick={() => setShowRawDebug((value) => !value)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            {showRawDebug ? '원본/디버그 숨기기' : '원본 추출 소스 보기'}
          </button>
          {showRawDebug ? (
            <div className="space-y-2">
              <pre className="max-h-[220px] overflow-auto rounded border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(sourcePreviewMeta, null, 2)}
              </pre>
              <textarea
                readOnly
                className="min-h-[160px] w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs"
                value={sourcePreviewRawText}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {activeSpec ? (
        <section className="min-w-0 space-y-3">
          {isDegraded ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Infographic 초안은 제한적이지만 본문 기반 카드 요약은 사용할 수 있습니다.
              {degradedMeta?.degradedReasons?.length ? (
                <ul className="mt-2 list-inside list-disc text-xs">
                  {degradedMeta.degradedReasons.map((reason) => (
                    <li key={reason}>{DEGRADED_REASON_MESSAGE[reason] ?? '요약 품질을 보정했습니다.'}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {displayModel ? (
            <div className="rounded border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">카드형 결론</p>
              <h2 className="mt-1 break-keep text-lg font-semibold text-slate-900">{displayModel.title}</h2>
              <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">{displayModel.conclusion}</p>
              <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">산업 변화 3줄</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
                    {displayModel.industryChanges.map((item) => (
                      <li key={item} className="break-words">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">다음 확인 질문</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
                    {displayModel.nextQuestions.map((item) => (
                      <li key={item} className="break-words">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <ResponsiveInfographicView spec={activeSpec} />
          <div className="hidden md:block">
            <InfographicCanvas spec={activeSpec} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <ActionButton onClick={() => void copySummary()}>요약 복사</ActionButton>
            <ActionButton onClick={sendToResearch} primary>
              Research Center로 보내기
            </ActionButton>
            <ActionButton onClick={focusExtractedText}>본문 직접 수정</ActionButton>
            <ActionButton onClick={() => void handleGenerate()} disabled={loading || !canGenerate} disabledReason={generateDisabledReason}>
              다시 생성
            </ActionButton>
            <ActionButton onClick={shortenSourceText}>본문 짧게 정리</ActionButton>
            <ActionButton onClick={focusArticlePattern}>문서 성격 바꾸기</ActionButton>
            <ActionButton onClick={focusIndustryPattern}>산업 패턴 바꾸기</ActionButton>
          </div>

          <button
            type="button"
            onClick={() => setShowJsonDebug((value) => !value)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            {showJsonDebug ? 'JSON 디버그 숨기기' : 'JSON 디버그 보기'}
          </button>
          {showJsonDebug ? (
            <pre className="max-h-[420px] overflow-auto rounded border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
              {JSON.stringify(activeSpec, null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
