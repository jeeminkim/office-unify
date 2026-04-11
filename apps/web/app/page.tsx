"use client";
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useGenerate } from '@/hooks/useGenerate';
import PromptInput from '@/components/PromptInput';
import ActionButtons from '@/components/ActionButtons';
import ResultPanel from '@/components/ResultPanel';
import SettingsModal from '@/components/SettingsModal';
import {
  saveDraft,
  getDraft,
  getRecentResults,
  getSavedTemplates,
  savePromptTemplate,
  deletePromptTemplate,
} from '@/lib/storage';
import {
  TaskType,
  DbType,
  RecentResult,
  DEFAULT_SQL_STYLE_OPTIONS,
  SqlStyleOptions,
  SavedPromptTemplate,
} from '@/lib/types';
import { Settings as SettingsIcon, Code2, AlertTriangle, History, Clock, BookmarkPlus, Trash2 } from 'lucide-react';
import { buildFollowUpPrompt, FOLLOW_UP_MAX_COUNT, enrichSqlPromptIfShort } from '@/lib/utils/promptUtils';
import { formatSqlStyleHints, parseSqlStyleHintsToOptions } from '@/lib/prompts';
import { SHOW_TREND_UI } from '@/lib/feature-flags';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [schemaContext, setSchemaContext] = useState('');
  const [sqlStyle, setSqlStyle] = useState<SqlStyleOptions>(DEFAULT_SQL_STYLE_OPTIONS);
  const [showSqlSchema, setShowSqlSchema] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [recentTasks, setRecentTasks] = useState<RecentResult[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedPromptTemplate[]>([]);
  const [templateNameDraft, setTemplateNameDraft] = useState('');

  const [sqlDbType, setSqlDbType] = useState<DbType>('postgresql');
  const [lastDbType, setLastDbType] = useState<DbType>('postgresql');
  const [lastSchemaContext, setLastSchemaContext] = useState('');
  const [lastSqlStyleHints, setLastSqlStyleHints] = useState('');
  const [followUpCount, setFollowUpCount] = useState<number>(0);
  const [preferenceHint, setPreferenceHint] = useState('');

  const refreshPreferenceHint = useCallback(async () => {
    try {
      const res = await fetch('/api/dev-support/preference-hint', { credentials: 'same-origin' });
      const data = (await res.json()) as { hint?: string };
      setPreferenceHint(typeof data.hint === 'string' ? data.hint : '');
    } catch {
      setPreferenceHint('');
    }
  }, []);

  const { generate, isLoading, error, result } = useGenerate();

  useEffect(() => {
    void refreshPreferenceHint();
  }, [refreshPreferenceHint]);

  useEffect(() => {
    queueMicrotask(() => {
      setIsReady(true);
      const savedDraft = getDraft();
      if (savedDraft) {
        setPrompt(savedDraft);
      }

      setRecentTasks(getRecentResults());
      setSavedTemplates(getSavedTemplates());
    });
  }, []);

  useEffect(() => {
    if (isReady) saveDraft(prompt);
  }, [prompt, isReady]);

  useEffect(() => {
    if (!result) return;
    queueMicrotask(() => setRecentTasks(getRecentResults()));
  }, [result]);

  const handleDataCleared = () => {
    setPrompt('');
    setSchemaContext('');
    setSqlStyle(DEFAULT_SQL_STYLE_OPTIONS);
    setSqlDbType('postgresql');
    setShowSqlSchema(false);
    setRecentTasks([]);
    setSavedTemplates(getSavedTemplates());
    setFollowUpCount(0);
  };

  const handleGenerate = (type: TaskType, dbType?: DbType) => {
    setFollowUpCount(0);
    if (type === 'sql') {
      const resolvedDb = dbType ?? 'postgresql';
      const hints = formatSqlStyleHints(sqlStyle);
      setLastDbType(resolvedDb);
      setLastSchemaContext(schemaContext);
      setLastSqlStyleHints(hints);
      const apiPrompt = enrichSqlPromptIfShort(prompt);
      generate(apiPrompt, type, {
        dbType: resolvedDb,
        schemaContext,
        sqlStyleHints: hints,
        persistPrompt: prompt,
        preferenceHint,
      });
    } else {
      generate(prompt, type, { preferenceHint });
    }
  };

  const handleSaveTemplate = () => {
    const name = templateNameDraft.trim() || `템플릿 ${new Date().toLocaleString('ko-KR')}`;
    const saved = savePromptTemplate({
      name,
      prompt,
      schemaContext,
      dbType: sqlDbType,
      sqlStyle,
    });
    if (saved) {
      setSavedTemplates(getSavedTemplates());
      setTemplateNameDraft('');
      alert('현재 입력이 템플릿으로 저장되었습니다.');
    } else {
      alert('저장에 실패했습니다.');
    }
  };

  const applyTemplate = (t: SavedPromptTemplate) => {
    setPrompt(t.prompt);
    setSchemaContext(t.schemaContext);
    setSqlStyle(t.sqlStyle);
    setSqlDbType(t.dbType);
    setLastDbType(t.dbType);
    setLastSqlStyleHints(formatSqlStyleHints(t.sqlStyle));
    setLastSchemaContext(t.schemaContext);
    setShowSqlSchema(true);
    setFollowUpCount(0);
  };

  const handleRecentClick = (task: RecentResult) => {
    setPrompt(task.prompt);
    setFollowUpCount(0);
    if (task.taskType === 'sql') {
      setShowSqlSchema(true);
      if (typeof task.schemaContext === 'string') {
        setSchemaContext(task.schemaContext);
        setLastSchemaContext(task.schemaContext);
      }
      if (task.dbType) {
        setLastDbType(task.dbType);
        setSqlDbType(task.dbType);
      }
      if (task.sqlStyleHints) {
        setLastSqlStyleHints(task.sqlStyleHints);
        setSqlStyle(parseSqlStyleHintsToOptions(task.sqlStyleHints));
      }
    }
  };

  const handleFollowUp = (followUpText: string) => {
    if (!result) return;

    const newCount = followUpCount + 1;
    setFollowUpCount(newCount);

    const newPrompt = buildFollowUpPrompt(prompt, followUpText, result, newCount);

    setPrompt(newPrompt);
    if (result.taskType === 'sql') {
      const apiPrompt = enrichSqlPromptIfShort(newPrompt);
      generate(apiPrompt, result.taskType, {
        dbType: lastDbType,
        schemaContext: lastSchemaContext,
        sqlStyleHints: lastSqlStyleHints,
        persistPrompt: newPrompt,
        preferenceHint,
      });
    } else {
      generate(newPrompt, result.taskType, { preferenceHint });
    }
  };

  if (!isReady) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-md flex items-center justify-center shadow-sm">
              <Code2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">dev_support</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/persona-chat"
              className="text-sm text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-100"
            >
              Persona chat
            </Link>
            <Link
              href="/private-banker"
              className="text-sm text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-100"
            >
              Private Banker
            </Link>
            {SHOW_TREND_UI ? (
              <Link
                href="/trend"
                className="text-sm text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-100"
              >
                Trend
              </Link>
            ) : null}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="설정 및 관리"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
              <div className="space-y-1 mb-8 border-b border-slate-100 pb-5">
                <h2 className="text-2xl font-bold text-slate-800">새 작업 시작</h2>
                <p className="text-sm text-slate-500 max-w-xl">
                  dev_support는 자연어 업무 설명으로 순서도(Mermaid), SQL, TypeScript 초안을 만듭니다. SQL은 스키마·조인·옵션을 맞추면 실무에 가깝게 나옵니다.
                </p>
                <p className="text-xs text-slate-400 max-w-xl">
                  Gemini는 서버 환경변수 GEMINI_API_KEY만 사용합니다. 브라우저에 API 키를 입력하거나 저장하지 않습니다. 피드백·최고 도출 저장·생성 개인화 힌트는 Google 로그인(허용 계정) 시 서버에 동기화됩니다.
                </p>
              </div>

              <div className="space-y-6">
                <PromptInput
                  value={prompt}
                  onChange={setPrompt}
                  schemaContext={schemaContext}
                  onSchemaChange={setSchemaContext}
                  showSchema={showSqlSchema}
                  sqlStyle={sqlStyle}
                  onSqlStyleChange={setSqlStyle}
                />
                <ActionButtons
                  onGenerate={handleGenerate}
                  isLoading={isLoading}
                  showSqlSchema={showSqlSchema}
                  onToggleSqlSchema={() => setShowSqlSchema((v) => !v)}
                  sqlDbType={sqlDbType}
                  onSqlDbTypeChange={setSqlDbType}
                />

                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-bold text-slate-600 mb-1">템플릿 이름 (선택)</label>
                      <input
                        type="text"
                        value={templateNameDraft}
                        onChange={(e) => setTemplateNameDraft(e.target.value)}
                        placeholder="예: 미납 조회·주문 집계"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-900 hover:bg-blue-50"
                    >
                      <BookmarkPlus className="w-4 h-4" />
                      현재 입력 저장
                    </button>
                  </div>
                  {savedTemplates.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 mb-2">저장된 템플릿</p>
                      <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                        {savedTemplates.map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => applyTemplate(t)}
                              className="flex-1 text-left font-medium text-slate-800 hover:text-blue-700 truncate"
                            >
                              {t.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                deletePromptTemplate(t.id);
                                setSavedTemplates(getSavedTemplates());
                              }}
                              className="shrink-0 p-1 text-slate-400 hover:text-red-600"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {followUpCount >= 3 && !isLoading && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-md animate-in fade-in flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-orange-800 text-xs font-semibold leading-relaxed">
                  수정 요청이 연속으로 많이 누적되었습니다. 컨텍스트가 {FOLLOW_UP_MAX_COUNT}회 이상 과도하게 길어지면 품질이 저하될 수 있으므로 만족스럽지 않다면 현재 결과 복사 후 새 작업으로 시작하는 것을 권장합니다.
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md animate-in fade-in flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-red-800 text-sm font-medium leading-relaxed">{error}</div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-center items-center py-16 bg-white rounded-xl shadow-sm border border-slate-200 border-dashed">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-sm text-slate-500 font-medium">안전한 환경에서 AI가 요청을 처리 중입니다...</p>
                </div>
              </div>
            )}

            {!isLoading && result && (
              <ResultPanel
                result={result}
                onFollowUp={handleFollowUp}
                isGenerating={isLoading}
                inputSchemaContext={result.taskType === 'sql' ? lastSchemaContext : undefined}
                feedbackPrompt={prompt}
                sqlContext={
                  result.taskType === 'sql'
                    ? {
                        dbType: lastDbType,
                        schemaContext: lastSchemaContext,
                        sqlStyleHints: lastSqlStyleHints,
                      }
                    : undefined
                }
                onPreferenceRefresh={refreshPreferenceHint}
              />
            )}
          </div>

          <div className="lg:col-span-4 hidden lg:block">
            <aside className="bg-white rounded-xl shadow-sm border border-slate-200 sticky top-24 overflow-hidden">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-800 text-sm">최근 작업 이력</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[calc(100vh-200px)] overflow-y-auto">
                {recentTasks.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400 text-center">최근 작업이 없습니다.</p>
                ) : (
                  recentTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleRecentClick(task)}
                      className="w-full text-left p-4 hover:bg-slate-50 transition-colors focus:bg-blue-50 focus:outline-none block group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase uppercase">
                          {task.taskType}
                        </span>
                        <div className="flex items-center text-[10px] text-slate-400 gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(task.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-700 truncate group-hover:text-blue-700 transition-colors">
                        {task.title}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onDataCleared={handleDataCleared} />
    </div>
  );
}
