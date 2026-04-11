"use client";
import { useState, useCallback, useEffect } from 'react';
import { GenerateResponse } from '@/lib/types';
import CodeBlock from './CodeBlock';
import MermaidViewer, { type MermaidRenderState } from './MermaidViewer';
import {
  AlertCircle,
  Sparkles,
  CornerDownRight,
  Download,
  Copy,
  Smile,
  Frown,
  AlertTriangle,
  ImageDown,
  FileText,
  ClipboardList,
} from 'lucide-react';
import {
  formatResultAsMarkdown,
  downloadTextFile,
  downloadTextFileMarkdown,
  sanitizeFilename,
  buildFlowTextExport,
  downloadSvgAsPng,
  extractFirstTsFunction,
} from '@/lib/utils';
import { saveFeedbackTier } from '@/lib/storage';
import type { DbType } from '@/lib/types';
import { computeResultConfidence, type ConfidenceLevel } from '@/lib/confidence';

interface ResultPanelProps {
  result: GenerateResponse;
  onFollowUp: (prompt: string) => void;
  isGenerating: boolean;
  /** SQL 신뢰도 계산용: 마지막 생성 시 사용한 스키마 컨텍스트 */
  inputSchemaContext?: string;
  /** 이번 결과에 대응하는 사용자 프롬프트(서버 피드백·저장용) */
  feedbackPrompt: string;
  /** SQL일 때만: 저장·피드백에 함께 넣을 컨텍스트 */
  sqlContext?: { dbType: DbType; schemaContext: string; sqlStyleHints: string };
  /** 서버 피드백 반영 후 preference 힌트 갱신 */
  onPreferenceRefresh?: () => void;
}

function confidenceBadgeClass(level: ConfidenceLevel): string {
  switch (level) {
    case 'HIGH':
      return 'border-green-300 bg-green-100 text-green-900';
    case 'MEDIUM':
      return 'border-yellow-300 bg-yellow-100 text-yellow-900';
    case 'LOW':
      return 'border-red-300 bg-red-50 text-red-800';
  }
}

async function copyToClipboard(text: string, okMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    alert(okMessage);
  } catch {
    alert('복사에 실패했습니다.');
  }
}

/** Flow 내보내기·시각화 분기 (taskType 정규화 후에도 안전하게) */
function isFlowResult(r: GenerateResponse): boolean {
  return r.taskType === 'flow';
}

const FlowTaskView = ({
  result,
  onMermaidRenderState,
}: {
  result: GenerateResponse;
  onMermaidRenderState: (state: MermaidRenderState) => void;
}) => (
  <>
    {result.mermaidCode && (
      <section>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">프로세스 시각화</h3>
        <MermaidViewer chart={result.mermaidCode} onRenderStateChange={onMermaidRenderState} />
      </section>
    )}
    {result.content && (
      <section>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">프로세스 요약</h3>
        <div className="text-sm text-slate-700 bg-white p-5 border border-slate-200 rounded-md shadow-sm whitespace-pre-wrap leading-relaxed">
          {result.content}
        </div>
      </section>
    )}
    {result.explanation && (
      <section>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">
          상세 설명 · 프로세스 요약
        </h3>
        <div className="text-sm text-slate-600 bg-blue-50 p-5 rounded-md border border-blue-100 whitespace-pre-wrap leading-relaxed">
          {result.explanation}
        </div>
      </section>
    )}
  </>
);

const CodeTaskView = ({ result, isSql }: { result: GenerateResponse; isSql: boolean }) => (
  <>
    {result.explanation && (
      <section className="bg-slate-50 p-5 rounded-md border border-slate-100 text-slate-700 leading-relaxed whitespace-pre-wrap">
        <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wider">
          {isSql ? '설계·주의·성능 (SQL)' : 'Explanation'}
        </h3>
        {result.explanation}
      </section>
    )}
    {result.content && (
      <section>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">
          {isSql ? 'SQL 코드' : 'TypeScript 구현'}
        </h3>
        <CodeBlock code={result.content} language={isSql ? 'sql' : 'typescript'} />
      </section>
    )}
    {result.example && (
      <section>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">사용 예시</h3>
        <CodeBlock code={result.example} language={isSql ? 'sql' : 'typescript'} />
      </section>
    )}
  </>
);

function flowExportBaseName(result: GenerateResponse): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  if (result.title?.trim()) {
    return `${sanitizeFilename(result.title)}_${dateStr}`;
  }
  return `flow_result_${dateStr}`;
}

const exportBtnClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-bold transition-colors min-h-[2.5rem]';

export default function ResultPanel({
  result,
  onFollowUp,
  isGenerating,
  inputSchemaContext,
  feedbackPrompt,
  sqlContext,
  onPreferenceRefresh,
}: ResultPanelProps) {
  const [followUpText, setFollowUpText] = useState('');
  const [feedback, setFeedback] = useState<'top' | 'ok' | 'weak' | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [serverFbMsg, setServerFbMsg] = useState<string | null>(null);
  const [serverFbLoading, setServerFbLoading] = useState(false);
  const [mermaidState, setMermaidState] = useState<MermaidRenderState>({ ok: false, svg: null });
  const [pngExporting, setPngExporting] = useState(false);

  const handleMermaidRenderState = useCallback((state: MermaidRenderState) => {
    setMermaidState(state);
  }, []);

  useEffect(() => {
    setMermaidState({ ok: false, svg: null });
  }, [result.taskType, result.title, result.mermaidCode, result.content]);

  useEffect(() => {
    setFeedback(null);
    setFeedbackNote('');
    setServerFbMsg(null);
    setServerFbLoading(false);
  }, [result.taskType, result.title, result.content, result.mermaidCode]);

  const flowPngReady = isFlowResult(result) && mermaidState.ok && mermaidState.svg !== null;
  const isFlow = isFlowResult(result);

  const submitFollowUp = () => {
    if (!followUpText.trim()) return;
    onFollowUp(followUpText);
    setFollowUpText('');
  };

  const handleExportMd = () => {
    const md = formatResultAsMarkdown(result);
    const sanitizedTitle = (result.title || 'task_result').replace(/[\/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
    downloadTextFileMarkdown(`dev_support_${sanitizedTitle}.md`, md);
  };

  const handleExportFlowTxt = () => {
    const text = buildFlowTextExport(result);
    const name = `${flowExportBaseName(result)}.txt`;
    downloadTextFile(name, text, 'text/plain;charset=utf-8');
  };

  const handleExportFlowPng = async () => {
    if (!mermaidState.svg || !mermaidState.ok) {
      alert('PNG로 저장할 다이어그램이 없습니다. Mermaid가 정상 렌더된 뒤 다시 시도해 주세요.');
      return;
    }
    setPngExporting(true);
    try {
      const name = `${flowExportBaseName(result)}.png`;
      await downloadSvgAsPng(mermaidState.svg, name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'PNG 저장에 실패했습니다.';
      alert(msg);
    } finally {
      setPngExporting(false);
    }
  };

  const handleCopySqlWarnings = async () => {
    if (!result.warnings?.length) return;
    const text = result.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      alert('경고·주의 내용이 클립보드에 복사되었습니다.');
    } catch {
      alert('복사에 실패했습니다.');
    }
  };

  const handleCopyMd = async () => {
    const md = formatResultAsMarkdown(result);
    try {
      await navigator.clipboard.writeText(md);
      alert('전체 결과가 마크다운으로 복사되었습니다.');
    } catch {
      alert('복사에 실패했습니다.');
    }
  };

  const submitTierFeedback = async (tier: 'top' | 'ok' | 'weak') => {
    if (feedback) return;
    saveFeedbackTier(tier);
    setFeedback(tier);
    setServerFbMsg(null);
    setServerFbLoading(true);
    try {
      const res = await fetch('/api/dev-support/feedback', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: tier,
          taskType: result.taskType,
          prompt: feedbackPrompt,
          note: feedbackNote.trim() || undefined,
          result,
          sqlContext: result.taskType === 'sql' ? sqlContext : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; saved?: boolean };
      if (res.status === 401) {
        setServerFbMsg(
          '로컬 통계만 반영되었습니다. 서버 저장·개인화는 Google 로그인(허용 계정) 후 가능합니다.',
        );
      } else if (res.status === 403) {
        setServerFbMsg('이 계정은 서버 피드백을 사용할 수 없습니다. 로컬 통계만 반영되었습니다.');
      } else if (!res.ok) {
        setServerFbMsg(data.error ?? '서버 반영에 실패했습니다.');
      } else {
        if (tier === 'top' && data.saved) {
          setServerFbMsg(
            '최고 평가로 순서도(Markdown)·SQL/TS 스냅샷이 서버에 저장되었습니다.',
          );
        } else if (tier !== 'top') {
          setServerFbMsg('피드백이 서버에 반영되어 이후 생성 프롬프트에 참고됩니다.');
        } else {
          setServerFbMsg('서버에 반영되었습니다.');
        }
        onPreferenceRefresh?.();
      }
    } catch {
      setServerFbMsg('네트워크 오류로 서버 반영에 실패했습니다. 로컬 통계는 저장되었습니다.');
    } finally {
      setServerFbLoading(false);
    }
  };

  const hasWarnings = result.warnings && result.warnings.length > 0;
  const sqlWarningBlock = result.taskType === 'sql' && hasWarnings;

  const confidence = computeResultConfidence(result, inputSchemaContext);

  const handleCopyMermaid = () => {
    if (!result.mermaidCode?.trim()) {
      alert('복사할 Mermaid 코드가 없습니다.');
      return;
    }
    void copyToClipboard(result.mermaidCode.trim(), 'Mermaid 코드가 복사되었습니다.');
  };

  const handleCopySqlOnly = () => {
    if (!result.content?.trim()) {
      alert('복사할 SQL이 없습니다.');
      return;
    }
    void copyToClipboard(result.content.trim(), 'SQL만 복사되었습니다.');
  };

  const handleCopySqlAndWarningsNoExplanation = () => {
    const parts: string[] = [];
    if (result.content?.trim()) {
      parts.push('-- SQL\n' + result.content.trim());
    }
    if (result.warnings?.length) {
      parts.push(
        '\n-- 경고\n' + result.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')
      );
    }
    if (parts.length === 0) {
      alert('복사할 내용이 없습니다.');
      return;
    }
    void copyToClipboard(parts.join('\n'), 'SQL과 경고가 복사되었습니다. (explanation 제외)');
  };

  const handleCopyTsFunctionOnly = () => {
    if (!result.content?.trim()) {
      alert('복사할 코드가 없습니다.');
      return;
    }
    const fn = extractFirstTsFunction(result.content);
    void copyToClipboard(fn, '첫 함수 블록이 복사되었습니다.');
  };

  return (
    <div className="mt-8 border-t border-slate-200 pt-8 animate-in fade-in duration-500">

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${confidenceBadgeClass(confidence.level)}`}
          title={`${confidence.label} — ${confidence.detail}`}
        >
          {confidence.badgeShortKo}
        </span>
        <span className="text-xs text-slate-500 max-w-prose">{confidence.detail}</span>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {result.title && <h2 className="text-xl font-bold text-slate-800">{result.title}</h2>}
          {result.provider && (
            <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-100">
              <Sparkles className="w-3 h-3" />
              Generated by {result.provider.toUpperCase()}
            </div>
          )}
        </div>

        <div className="rounded-xl border-2 border-slate-200 bg-slate-50/90 p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">결과 내보내기</p>
          <div className="flex flex-wrap gap-2">
            {isFlow ? (
              <>
                <button
                  type="button"
                  onClick={handleExportFlowPng}
                  disabled={!flowPngReady || pngExporting}
                  title={
                    flowPngReady
                      ? '현재 화면의 Mermaid 다이어그램을 PNG로 저장'
                      : '다이어그램이 그려진 뒤 활성화됩니다'
                  }
                  className={`${exportBtnClass} border-blue-300 bg-white text-blue-900 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-55`}
                >
                  <ImageDown className="h-4 w-4 shrink-0" />
                  {pngExporting ? 'PNG 저장 중…' : 'PNG 저장'}
                </button>
                <button
                  type="button"
                  onClick={handleExportFlowTxt}
                  className={`${exportBtnClass} border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50`}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  TXT 저장
                </button>
                <button
                  type="button"
                  onClick={handleCopyMermaid}
                  disabled={!result.mermaidCode?.trim()}
                  className={`${exportBtnClass} border-violet-300 bg-white text-violet-900 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Copy className="h-4 w-4 shrink-0" />
                  Mermaid 복사
                </button>
                <button
                  type="button"
                  onClick={handleCopyMd}
                  className={`${exportBtnClass} border-slate-300 bg-white text-slate-800 hover:bg-white`}
                >
                  <Copy className="h-4 w-4 shrink-0" />
                  MD 복사
                </button>
                <button
                  type="button"
                  onClick={handleExportMd}
                  className={`${exportBtnClass} border-slate-300 bg-white text-slate-800 hover:bg-slate-100`}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  MD 다운로드
                </button>
              </>
            ) : result.taskType === 'sql' ? (
              <>
                <button
                  type="button"
                  onClick={handleCopySqlOnly}
                  className={`${exportBtnClass} border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50`}
                >
                  <Copy className="h-4 w-4 shrink-0" />
                  SQL만 복사
                </button>
                <button
                  type="button"
                  onClick={handleCopySqlAndWarningsNoExplanation}
                  className={`${exportBtnClass} border-amber-300 bg-white text-amber-950 hover:bg-amber-50`}
                >
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  SQL+경고 (설명 제외)
                </button>
                <button
                  type="button"
                  onClick={handleCopyMd}
                  className={`${exportBtnClass} border-slate-300 bg-white text-slate-800 hover:bg-white`}
                >
                  <Copy className="h-4 w-4 shrink-0" />
                  MD 복사
                </button>
                <button
                  type="button"
                  onClick={handleExportMd}
                  className={`${exportBtnClass} border-slate-300 bg-white text-slate-800 hover:bg-slate-100`}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  MD 다운로드
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCopyTsFunctionOnly}
                  className={`${exportBtnClass} border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50`}
                >
                  <Copy className="h-4 w-4 shrink-0" />
                  함수만 복사
                </button>
                <button
                  type="button"
                  onClick={handleCopyMd}
                  className={`${exportBtnClass} border-slate-300 bg-white text-slate-800 hover:bg-white`}
                >
                  <Copy className="h-4 w-4 shrink-0" />
                  MD 복사
                </button>
                <button
                  type="button"
                  onClick={handleExportMd}
                  className={`${exportBtnClass} border-slate-300 bg-white text-slate-800 hover:bg-slate-100`}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  MD 다운로드
                </button>
              </>
            )}
          </div>
          {isFlow && !flowPngReady && (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              PNG 저장은 Mermaid 다이어그램이 화면에 그려진 뒤 활성화됩니다. TXT·MD는 바로 사용할 수 있습니다.
            </p>
          )}
        </div>
      </div>

      {sqlWarningBlock && (
        <div
          className="mb-6 rounded-xl border-2 border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50/80 p-5 shadow-sm ring-2 ring-amber-200/60"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h4 className="text-base font-bold text-amber-950 flex flex-wrap items-center gap-2">
                  가정·누락·주의 (SQL)
                  <span className="text-xs font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                    복사해 검토·이슈 트래킹에 활용
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={handleCopySqlWarnings}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100/80"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  경고 전체 복사
                </button>
              </div>
              <pre className="mb-3 select-all whitespace-pre-wrap rounded-md border border-amber-200/80 bg-white/90 p-3 text-xs font-mono text-amber-950 leading-relaxed">
                {result.warnings!.map((w, i) => `${i + 1}. ${w}`).join('\n\n')}
              </pre>
              <ul className="space-y-2 text-sm text-amber-950 font-medium leading-relaxed">
                {result.warnings!.map((warn, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-600 font-bold shrink-0">{i + 1}.</span>
                    <span className="break-words">{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!sqlWarningBlock && hasWarnings && (
        <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-800 rounded-r-md flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h4 className="font-bold">주의사항</h4>
              <button
                type="button"
                onClick={async () => {
                  const text = result.warnings!.map((w, i) => `${i + 1}. ${w}`).join('\n\n');
                  try {
                    await navigator.clipboard.writeText(text);
                    alert('주의사항이 복사되었습니다.');
                  } catch {
                    alert('복사에 실패했습니다.');
                  }
                }}
                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100"
              >
                <ClipboardList className="w-3 h-3" />
                복사
              </button>
            </div>
            <pre className="mb-2 select-all whitespace-pre-wrap rounded bg-white/60 p-2 text-xs font-mono">
              {result.warnings!.map((w, i) => `${i + 1}. ${w}`).join('\n\n')}
            </pre>
            <ul className="list-disc ml-5 space-y-1 text-sm">
              {result.warnings!.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {isFlow ? (
          <FlowTaskView result={result} onMermaidRenderState={handleMermaidRenderState} />
        ) : (
          <CodeTaskView result={result} isSql={result.taskType === 'sql'} />
        )}
      </div>

      <div className="mt-10 space-y-3 border-t border-slate-100 pt-6">
        <div className="text-center">
          <span className="text-sm font-medium text-slate-700">이번 도출을 어떻게 평가하시나요?</span>
          <p className="mt-1 text-xs text-slate-500">
            <strong className="text-slate-600">최고</strong>만 서버에 Flow(md)·SQL·TS 예시가 저장됩니다. 그 외 평가는 이후 생성에 참고되는 피드백으로 쌓입니다.
          </p>
        </div>
        <div className="mx-auto max-w-md">
          <label className="mb-2 block text-left text-[11px] font-bold text-slate-500">
            메모 (선택 · 괜찮음/아쉬움에서 특히 유용)
          </label>
          <textarea
            value={feedbackNote}
            onChange={(e) => setFeedbackNote(e.target.value.slice(0, 500))}
            disabled={feedback !== null || serverFbLoading}
            placeholder="예: 표현이 길다, Oracle 힌트를 더 주세요…"
            rows={2}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 disabled:opacity-50"
          />
          <p className="mt-0.5 text-right text-[10px] text-slate-400">{feedbackNote.length}/500</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => void submitTierFeedback('top')}
            disabled={feedback !== null || serverFbLoading}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              feedback === 'top'
                ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-300'
                : feedback !== null
                  ? 'opacity-40'
                  : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-900'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            최고 (서버 저장)
          </button>
          <button
            type="button"
            onClick={() => void submitTierFeedback('ok')}
            disabled={feedback !== null || serverFbLoading}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              feedback === 'ok'
                ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-200'
                : feedback !== null
                  ? 'opacity-40'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Smile className="h-4 w-4" />
            괜찮음
          </button>
          <button
            type="button"
            onClick={() => void submitTierFeedback('weak')}
            disabled={feedback !== null || serverFbLoading}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              feedback === 'weak'
                ? 'bg-red-50 text-red-800 ring-2 ring-red-200'
                : feedback !== null
                  ? 'opacity-40'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Frown className="h-4 w-4" />
            아쉬움
          </button>
        </div>
        {serverFbLoading ? (
          <p className="text-center text-xs text-slate-500">서버 반영 중…</p>
        ) : null}
        {serverFbMsg ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-700">
            {serverFbMsg}
          </p>
        ) : null}
      </div>

      <div className="mt-6 bg-slate-100 p-5 rounded-lg border border-slate-200">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
          <CornerDownRight className="w-4 h-4 text-slate-500" />
          결과가 마음에 들지 않나요? 추가 수정을 요청하세요.
        </label>
        <div className="flex gap-2">
          <input type="text" value={followUpText} onChange={(e) => setFollowUpText(e.target.value)} disabled={isGenerating} onKeyDown={(e) => { if (e.key === 'Enter') submitFollowUp(); }} placeholder="예시) Oracle용으로 변경해줘, 타입스크립트 제네릭을 적용해줘..." className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50" />
          <button type="button" onClick={submitFollowUp} disabled={isGenerating || !followUpText.trim()} className="px-6 py-2 bg-slate-800 text-white text-sm font-bold rounded-md hover:bg-slate-900 transition-colors disabled:opacity-50">수정 생성</button>
        </div>
      </div>
    </div>
  );
}
