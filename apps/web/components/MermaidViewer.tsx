"use client";
import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import CodeBlock from './CodeBlock';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { logDevError } from '@/lib/utils';

export type MermaidRenderState = {
  ok: boolean;
  svg: SVGSVGElement | null;
};

interface MermaidViewerProps {
  chart: string;
  /** 렌더 성공 시 컨테이너 내 SVG 참조, 실패 시 ok=false */
  onRenderStateChange?: (state: MermaidRenderState) => void;
}

export default function MermaidViewer({ chart, onRenderStateChange }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onRenderStateChange);

  useEffect(() => {
    callbackRef.current = onRenderStateChange;
  });

  const [hasError, setHasError] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const notify = (state: MermaidRenderState) => {
      callbackRef.current?.(state);
    };

    const renderChart = async () => {
      setHasError(false);
      notify({ ok: false, svg: null });
      try {
        mermaid.initialize({ startOnLoad: false, theme: 'default' });
        if (containerRef.current) {
          const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).substring(7)}`, chart);
          if (isMounted) {
            containerRef.current.innerHTML = svg;
            queueMicrotask(() => {
              if (!isMounted || !containerRef.current) return;
              const svgEl = containerRef.current.querySelector('svg');
              if (svgEl) {
                notify({ ok: true, svg: svgEl });
              } else {
                notify({ ok: false, svg: null });
              }
            });
          }
        }
      } catch (error) {
        logDevError('Mermaid 렌더링 에러', error);
        if (isMounted) {
          setHasError(true);
          setShowRaw(true);
          notify({ ok: false, svg: null });
        }
      }
    };

    if (chart) {
      renderChart();
    } else {
      notify({ ok: false, svg: null });
    }

    return () => {
      isMounted = false;
    };
  }, [chart]);

  return (
    <div className="space-y-3">
      {hasError && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-200">
          Mermaid 다이어그램 렌더링에 실패했습니다. 아래 원문 코드를 확인해주세요.
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
          <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <CodeBlock code={chart} language="mermaid" />
          </div>
        )}
      </div>
    </div>
  );
}
