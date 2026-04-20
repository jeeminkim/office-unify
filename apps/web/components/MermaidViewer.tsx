"use client";
import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import CodeBlock from './CodeBlock';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { logDevError } from '@/lib/utils';
import {
  detectDiagramType,
  extractMermaid,
  logMermaidEvent,
  sanitizeForLog,
  sanitizeMermaid,
} from '@/lib/mermaid/pipeline';

export type MermaidRenderState = {
  ok: boolean;
  svg: SVGSVGElement | null;
  sanitized?: string;
  reason?: string;
  phase?: 'idle' | 'parse' | 'render';
};

interface MermaidViewerProps {
  chart: string;
  /** 렌더 성공 시 컨테이너 내 SVG 참조, 실패 시 ok=false */
  onRenderStateChange?: (state: MermaidRenderState) => void;
}

type MermaidValidateResult =
  | { ok: true }
  | { ok: false; reason: string; line?: number; column?: number };

async function validateMermaid(input: string): Promise<MermaidValidateResult> {
  try {
    await mermaid.parse(input, { suppressErrors: false });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown parse error';
    const lineMatch = message.match(/line\s+(\d+)/i);
    const columnMatch = message.match(/col(?:umn)?\s+(\d+)/i);
    return {
      ok: false,
      reason: message,
      line: lineMatch ? Number(lineMatch[1]) : undefined,
      column: columnMatch ? Number(columnMatch[1]) : undefined,
    };
  }
}

export default function MermaidViewer({ chart, onRenderStateChange }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onRenderStateChange);
  const requestIdRef = useRef('flow-init');

  useEffect(() => {
    callbackRef.current = onRenderStateChange;
  });

  useEffect(() => {
    requestIdRef.current = `flow-${crypto.randomUUID()}`;
  }, []);

  const [hasError, setHasError] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const phaseRef = useRef<'parse' | 'render'>('parse');
  const [parseStatus, setParseStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [renderStatus, setRenderStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const extractedChart = extractMermaid(chart);
  const sanitizedChart = sanitizeMermaid(extractedChart);

  useEffect(() => {
    logMermaidEvent('MERMAID_SANITIZE_APPLIED', {
      requestId: requestIdRef.current,
      rawLength: chart?.length ?? 0,
      extractedLength: extractedChart.length,
      sanitizedLength: sanitizedChart.length,
      diagramType: detectDiagramType(sanitizedChart),
      sample: sanitizeForLog(sanitizedChart),
    });
  }, [chart, extractedChart, sanitizedChart]);

  useEffect(() => {
    let isMounted = true;

    const notify = (state: MermaidRenderState) => {
      callbackRef.current?.(state);
    };

    const renderChart = async () => {
      setHasError(false);
      setErrorReason(null);
      setParseStatus('idle');
      setRenderStatus('idle');
      phaseRef.current = 'parse';
      notify({ ok: false, svg: null, sanitized: sanitizedChart, phase: 'idle' });
      try {
        mermaid.initialize({ startOnLoad: false, theme: 'default' });
        const validation = await validateMermaid(sanitizedChart);
        if (!validation.ok) {
          setParseStatus('fail');
          logMermaidEvent('MERMAID_PARSE_FAIL', {
            requestId: requestIdRef.current,
            reason: validation.reason,
            line: validation.line,
            column: validation.column,
            rawLength: chart?.length ?? 0,
            sanitizedLength: sanitizedChart.length,
            diagramType: detectDiagramType(sanitizedChart),
            sample: sanitizeForLog(sanitizedChart),
          });
          logMermaidEvent('MERMAID_RENDER_FALLBACK', {
            requestId: requestIdRef.current,
            phase: 'parse',
            reason: validation.reason,
            rawLength: chart?.length ?? 0,
            sanitizedLength: sanitizedChart.length,
            diagramType: detectDiagramType(sanitizedChart),
          });
          if (isMounted) {
            setHasError(true);
            setShowRaw(true);
            setErrorReason(validation.reason);
            notify({
              ok: false,
              svg: null,
              sanitized: sanitizedChart,
              reason: validation.reason,
              phase: 'parse',
            });
          }
          return;
        }
        setParseStatus('ok');
        phaseRef.current = 'render';
        logMermaidEvent('MERMAID_PARSE_OK', {
          requestId: requestIdRef.current,
          rawLength: chart?.length ?? 0,
          sanitizedLength: sanitizedChart.length,
          diagramType: detectDiagramType(sanitizedChart),
        });
        if (containerRef.current) {
          let svg = '';
          try {
            const renderResult = await mermaid.render(
              `mermaid-${Math.random().toString(36).substring(7)}`,
              sanitizedChart
            );
            svg = renderResult.svg;
            setRenderStatus('ok');
            logMermaidEvent('MERMAID_RENDER_OK', {
              requestId: requestIdRef.current,
              rawLength: chart?.length ?? 0,
              sanitizedLength: sanitizedChart.length,
              diagramType: detectDiagramType(sanitizedChart),
            });
          } catch (renderError) {
            setRenderStatus('fail');
            const renderReason =
              renderError instanceof Error ? renderError.message : 'render error';
            logMermaidEvent('MERMAID_RENDER_FAIL', {
              requestId: requestIdRef.current,
              reason: renderReason,
              rawLength: chart?.length ?? 0,
              sanitizedLength: sanitizedChart.length,
              diagramType: detectDiagramType(sanitizedChart),
            });
            logMermaidEvent('MERMAID_RENDER_FALLBACK', {
              requestId: requestIdRef.current,
              phase: 'render',
              reason: renderReason,
              rawLength: chart?.length ?? 0,
              sanitizedLength: sanitizedChart.length,
              diagramType: detectDiagramType(sanitizedChart),
            });
            throw renderError;
          }
          if (isMounted) {
            containerRef.current.innerHTML = svg;
            queueMicrotask(() => {
              if (!isMounted || !containerRef.current) return;
              const svgEl = containerRef.current.querySelector('svg');
              if (svgEl) {
                notify({
                  ok: true,
                  svg: svgEl,
                  sanitized: sanitizedChart,
                  phase: 'render',
                });
              } else {
                notify({
                  ok: false,
                  svg: null,
                  sanitized: sanitizedChart,
                  phase: 'render',
                });
              }
            });
          }
        }
      } catch (error) {
        logDevError('Mermaid 렌더링 에러', error);
        const reason = error instanceof Error ? error.message : 'render error';
        if (isMounted) {
          setHasError(true);
          setShowRaw(true);
          setErrorReason(reason);
          notify({
            ok: false,
            svg: null,
            sanitized: sanitizedChart,
            reason,
            phase: phaseRef.current,
          });
        }
      }
    };

    if (sanitizedChart) {
      renderChart();
    } else {
      notify({ ok: false, svg: null, sanitized: sanitizedChart, phase: 'idle' });
    }

    return () => {
      isMounted = false;
    };
  }, [chart, sanitizedChart]);

  return (
    <div className="space-y-3">
      {hasError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm font-semibold">Flow 이미지를 생성하지 못했습니다</p>
          <p className="mt-1 text-sm">
            생성된 Mermaid 문법에 문제가 있어 이미지 대신 원문을 표시합니다.
          </p>
          {errorReason && (
            <p className="mt-2 text-xs text-amber-800/80">상세 오류: {errorReason}</p>
          )}
        </div>
      )}

      <div className={`bg-white p-6 rounded-md border border-slate-200 shadow-sm overflow-x-auto ${hasError ? 'hidden' : 'block'}`}>
        <div ref={containerRef} className="flex justify-center" />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowRaw(!showRaw)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Mermaid 원문 보기
        </button>
        {showRaw && (
          <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200 space-y-2">
            <div className="overflow-x-auto rounded-md border border-slate-200 max-w-full">
              <CodeBlock code={sanitizedChart} language="mermaid" />
            </div>
            {process.env.NODE_ENV !== 'production' && hasError && (
              <details className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <summary className="cursor-pointer text-xs text-slate-700">
                  개발 모드 원문(raw) 보기
                </summary>
                <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
                  <CodeBlock code={chart} language="text" />
                </div>
              </details>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(sanitizedChart);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              수정 요청에 붙여넣기용 Mermaid 복사
            </button>
            {process.env.NODE_ENV !== 'production' && (
              <details className="rounded-md border border-dashed border-slate-300 bg-white p-2">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                  Mermaid Debug Panel (dev only)
                </summary>
                <div className="mt-2 space-y-2 text-xs">
                  <p className="text-slate-600">
                    parse: <strong>{parseStatus}</strong> / render: <strong>{renderStatus}</strong>
                  </p>
                  <div className="overflow-x-auto rounded border border-slate-200">
                    <CodeBlock code={chart} language="text" />
                  </div>
                  <div className="overflow-x-auto rounded border border-slate-200">
                    <CodeBlock code={extractedChart} language="text" />
                  </div>
                  <div className="overflow-x-auto rounded border border-slate-200">
                    <CodeBlock code={sanitizedChart} language="mermaid" />
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
