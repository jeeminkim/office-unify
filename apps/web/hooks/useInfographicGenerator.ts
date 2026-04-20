"use client";

import { useCallback, useState } from 'react';
import type {
  InfographicExtractSourceTextResponseBody,
  InfographicExtractRequestBody,
  InfographicExtractResponseBody,
  InfographicInputSourceType,
  InfographicSpec,
} from '@office-unify/shared-types';

const jsonHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

export function useInfographicGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spec, setSpec] = useState<InfographicSpec | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourcePreviewText, setSourcePreviewText] = useState('');
  const [sourcePreviewRawText, setSourcePreviewRawText] = useState('');
  const [sourcePreviewMeta, setSourcePreviewMeta] = useState<{
    sourceType: InfographicInputSourceType;
    articlePattern?: string;
    industryPattern?: string;
    sourceTone?: string;
    subjectivityLevel?: string;
    structureDensity?: string;
    sourceUrl?: string;
    sourceTitle?: string;
    extractionWarnings: string[];
    extractedTextLength: number;
    rawExtractedTextLength: number;
    cleanedTextLength: number;
    cleanupApplied: boolean;
    cleanupNotes: string[];
  } | null>(null);
  const [degradedMeta, setDegradedMeta] = useState<{
    degradedReasons?: string[];
    articlePattern?: string;
    industryPattern?: string;
  } | null>(null);
  const [pipelineStage, setPipelineStage] = useState<
    'idle' | 'source_extracted' | 'cleaned_preview_ready' | 'spec_generation_succeeded' | 'spec_generation_fallback' | 'spec_generation_degraded'
  >('idle');

  const generate = useCallback(async (payload: InfographicExtractRequestBody, pdfFile?: File | null) => {
    setLoading(true);
    setError(null);
    setPipelineStage((prev) => (prev === 'cleaned_preview_ready' ? prev : 'source_extracted'));
    try {
      const hasUpload = payload.sourceType === 'pdf_upload' && pdfFile instanceof File;
      const requestInit: RequestInit = hasUpload
        ? (() => {
            const form = new FormData();
            form.set('industryName', payload.industryName);
            form.set('sourceType', payload.sourceType);
            if (payload.rawText) form.set('rawText', payload.rawText);
            if (payload.sourceUrl) form.set('sourceUrl', payload.sourceUrl);
            if (payload.pdfUrl) form.set('pdfUrl', payload.pdfUrl);
            if (payload.articlePatternOverride) form.set('articlePatternOverride', payload.articlePatternOverride);
            if (payload.industryPatternOverride) form.set('industryPatternOverride', payload.industryPatternOverride);
            form.set('pdfFile', pdfFile as File);
            return {
              method: 'POST',
              credentials: 'same-origin',
              body: form,
            } as RequestInit;
          })()
        : {
            method: 'POST',
            headers: jsonHeaders,
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          };
      const res = await fetch('/api/infographic/extract', {
        ...requestInit,
      });
      const data = (await res.json()) as InfographicExtractResponseBody & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const mode = data.spec?.sourceMeta?.extractionMode;
      if (mode === 'degraded_fallback') {
        setSpec(null);
        setDegradedMeta({
          degradedReasons: data.spec?.sourceMeta?.degradedReasons?.map(String) ?? [],
          articlePattern: data.spec?.sourceMeta?.articlePattern,
          industryPattern: data.spec?.sourceMeta?.industryPattern,
        });
        setPipelineStage('spec_generation_degraded');
        setError('원문 추출은 성공했지만 구조화 품질이 부족합니다. 추출 텍스트를 조금 더 정리해 다시 시도하세요.');
      } else {
        setSpec(data.spec);
        setDegradedMeta(null);
        setPipelineStage(
          mode === 'semantic_fallback' || mode === 'llm_repaired'
            ? 'spec_generation_fallback'
            : 'spec_generation_succeeded',
        );
      }
      setWarnings(data.warnings ?? []);
      return data.spec;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '인포그래픽 생성 실패';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const extractSourceText = useCallback(async (payload: InfographicExtractRequestBody, pdfFile?: File | null) => {
    setLoading(true);
    setError(null);
    try {
      const hasUpload = payload.sourceType === 'pdf_upload' && pdfFile instanceof File;
      const requestInit: RequestInit = hasUpload
        ? (() => {
            const form = new FormData();
            form.set('industryName', payload.industryName);
            form.set('sourceType', payload.sourceType);
            if (payload.rawText) form.set('rawText', payload.rawText);
            if (payload.sourceUrl) form.set('sourceUrl', payload.sourceUrl);
            if (payload.pdfUrl) form.set('pdfUrl', payload.pdfUrl);
            if (payload.articlePatternOverride) form.set('articlePatternOverride', payload.articlePatternOverride);
            if (payload.industryPatternOverride) form.set('industryPatternOverride', payload.industryPatternOverride);
            form.set('pdfFile', pdfFile as File);
            return {
              method: 'POST',
              credentials: 'same-origin',
              body: form,
            } as RequestInit;
          })()
        : {
            method: 'POST',
            headers: jsonHeaders,
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          };
      const res = await fetch('/api/infographic/extract-source-text', requestInit);
      const data = (await res.json()) as InfographicExtractSourceTextResponseBody & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSourcePreviewText(data.cleanedText ?? '');
      setSourcePreviewRawText(data.rawText ?? '');
      setSourcePreviewMeta(data.sourceMeta);
      setWarnings(data.warnings ?? []);
      setPipelineStage('cleaned_preview_ready');
      return data;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '원문 추출 실패';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    spec,
    warnings,
    setSpec,
    sourcePreviewText,
    sourcePreviewRawText,
    setSourcePreviewText,
    sourcePreviewMeta,
    degradedMeta,
    pipelineStage,
    generate,
    extractSourceText,
  };
}

