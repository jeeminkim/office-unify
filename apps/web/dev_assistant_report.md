# Dev Assistant MVP Code Report

## 1. 설계 요약
- **목적**: 개발자 업무를 돕는 초경량/0원 운영 가능한 사내용 AI 시스템 완성
- **아키텍처**: Next.js App Router 기반의 Serverless 아키텍처.
- **상태 관리 & 스토리지**: 상태관리는 React 고유 상태(`useState`)를 사용하고, API 키는 브라우저 `localStorage`에만 저장하여 DB 비용 제로 및 보안 요구사항 충족
- **에러 핸들링 & UX**: LLM 응답 실패나 JSON 파싱 실패 등에 대한 에러 표시와 Mermaid 렌더링을 실패할 경우 원본 코드를 보여주는 fallback 메커니즘을 적용

## 2. 생성/수정 파일 목록
- \`lib/types.ts\`
- \`lib/storage.ts\`
- \`lib/prompts.ts\`
- \`lib/providers/base.ts\`
- \`lib/providers/gemini.ts\`
- \`app/api/generate/route.ts\`
- \`hooks/useGenerate.ts\`
- \`components/PromptInput.tsx\`
- \`components/ActionButtons.tsx\`
- \`components/ResultPanel.tsx\`
- \`components/CodeBlock.tsx\`
- \`components/MermaidViewer.tsx\`
- \`components/SettingsModal.tsx\`
- \`app/page.tsx\`
- \`app/globals.css\`

## 3. 각 파일 전체 코드

### lib/types.ts
\`\`\`typescript
export type TaskType = 'flow' | 'sql' | 'ts';

export type GenerateResponse = {
  taskType: TaskType;
  title?: string;
  content: string; 
  explanation?: string;
  mermaidCode?: string;
  example?: string;
  warnings?: string[];
  provider?: string;
  error?: string;
};

export type GenerateRequest = {
  prompt: string;
  taskType: TaskType;
  provider: string;
  apiKey: string;
};
\`\`\`

### lib/storage.ts
\`\`\`typescript
const STORAGE_KEY = 'dev_assistant_settings';

export type Settings = {
  geminiApiKey: string;
};

export const getSettings = (): Settings => {
  if (typeof window === 'undefined') return { geminiApiKey: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { geminiApiKey: '' };
    return JSON.parse(raw) as Settings;
  } catch (error) {
    console.error('설정 파싱 에러:', error);
    return { geminiApiKey: '' };
  }
};

export const saveSettings = (settings: Settings) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};
\`\`\`

### lib/prompts.ts
\`\`\`typescript
import { TaskType } from './types';

export const getSystemPrompt = (taskType: TaskType): string => {
  const baseJsonRule = \`
[응답 포맷 강제]
- 반드시 JSON 객체만 반환하라.
- markdown 코드펜스(\`\`\`json 등)를 사용하지 마라.
- 설명 문장 없이 순수 JSON만 반환하라.
- 필드가 없으면 빈 문자열 또는 생략으로 처리하라.

반드시 다음 JSON 스키마를 준수하라:
{
  "taskType": "\${taskType}",
  "title": "요약된 제목",
  "content": "핵심 내용 또는 코드",
  "explanation": "설명 내용",
  "mermaidCode": "mermaid 코드 (해당 시)",
  "example": "추가 예시 코드나 설명 (해당 시)",
  "warnings": ["주의사항 문자열 배열 (해당 시)"]
}\`;

  switch (taskType) {
    case 'flow':
      return \`당신은 업무 프로세스 설계자다. 사용자의 요청을 분석하여 시스템 흐름도를 작성하라.
- Mermaid flowchart 코드를 작성하여 "mermaidCode" 필드에 담아라.
- 단계별 업무 흐름, 분기 조건, 예외 흐름을 파악하여 구조화하라.
\${baseJsonRule}\`;
      
    case 'sql':
      return \`당신은 데이터베이스 전문가다. 사용자의 요청에 맞는 SQL 쿼리를 작성하라.
- 기본적으로 PostgreSQL 또는 MySQL 호환 표준 SQL을 작성하라.
- 작성된 SQL 코드는 "content" 필드에 담아라.
- 설계 의도와 성능 고려 포인트를 "explanation" 필드에 담아라.
\${baseJsonRule}\`;

    case 'ts':
      return \`당신은 시니어 프론트엔드/백엔드 개발자다. 사용자의 요청에 맞는 TypeScript 코드를 작성하라.
- 실행 가능하고 타입이 명확히 정의된 함수 또는 클래스 단위의 코드를 "content" 필드에 작성하라.
- 에러 처리와 안정성을 고려하라.
- 사용 예시를 "example" 필드에 작성하라.
\${baseJsonRule}\`;
  }
};
\`\`\`

### lib/providers/base.ts
\`\`\`typescript
import { GenerateRequest, GenerateResponse } from '../types';

export interface Provider {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}
\`\`\`

### lib/providers/gemini.ts
\`\`\`typescript
import { Provider } from './base';
import { GenerateRequest, GenerateResponse } from '../types';
import { getSystemPrompt } from '../prompts';

export class GeminiProvider implements Provider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const { prompt, taskType, apiKey } = request;
    
    if (!apiKey) {
      throw new Error('API Key가 설정되지 않았습니다.');
    }

    const systemPrompt = getSystemPrompt(taskType);
    
    try {
      const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${apiKey}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: \`\${systemPrompt}\\n\\n사용자 요청: \${prompt}\` }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
          }
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Gemini API 호출에 실패했습니다.');
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const cleanText = text.replace(/\`\`\`json\\n?/gi, '').replace(/\`\`\`\\n?/g, '').trim();
      
      const parsed = JSON.parse(cleanText) as GenerateResponse;
      return {
        ...parsed,
        taskType: parsed.taskType || taskType,
        provider: 'gemini',
      };
    } catch (error: any) {
      console.error('LLM 파싱 또는 네트워크 에러');
      throw new Error(error.message || '응답을 처리하는 중 오류가 발생했습니다. (JSON 형식이 아닐 수 있습니다)');
    }
  }
}
\`\`\`

### app/api/generate/route.ts
\`\`\`typescript
import { NextResponse } from 'next/server';
import { GeminiProvider } from '@/lib/providers/gemini';
import { GenerateRequest } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body: GenerateRequest = await req.json();
    
    let provider;
    if (body.provider === 'gemini') {
      provider = new GeminiProvider();
    } else {
      provider = new GeminiProvider();
    }
    
    const result = await provider.generate(body);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Route Error: Failed to generate content');
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
\`\`\`

### hooks/useGenerate.ts
\`\`\`typescript
"use client";
import { useState } from 'react';
import { TaskType, GenerateResponse } from '@/lib/types';
import { getSettings } from '@/lib/storage';

export const useGenerate = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const generate = async (prompt: string, taskType: TaskType) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    const settings = getSettings();
    const apiKey = settings.geminiApiKey;

    if (!apiKey) {
      setError('설정에서 Gemini API Key를 먼저 입력해주세요.');
      setIsLoading(false);
      return;
    }

    if (!prompt.trim()) {
      setError('업무 내용을 입력해주세요.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          taskType,
          provider: 'gemini',
          apiKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '생성에 실패했습니다.');
      }

      setResult({ ...data, taskType });
    } catch (err: any) {
      setError(err.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return { generate, isLoading, error, result };
};
\`\`\`

### components/PromptInput.tsx
\`\`\`tsx
"use client";
import { useEffect, useState } from 'react';

interface PromptInputProps {
  value: string;
  onChange: (val: string) => void;
}

export default function PromptInput({ value, onChange }: PromptInputProps) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 mb-2">
        업무 내용 입력
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예시) 회원가입 시 이메일 중복 확인 후, 비밀번호를 암호화하여 DB에 저장하고 환영 이메일을 발송하는 로직..."
        className="w-full h-32 p-4 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-none bg-white font-sans text-slate-800"
      />
    </div>
  );
}
\`\`\`

### components/ActionButtons.tsx
\`\`\`tsx
"use client";
import { TaskType } from '@/lib/types';
import { Send, TerminalSquare, GitBranch } from 'lucide-react';

interface ActionButtonsProps {
  onGenerate: (type: TaskType) => void;
  isLoading: boolean;
}

export default function ActionButtons({ onGenerate, isLoading }: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={() => onGenerate('flow')}
        disabled={isLoading}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50 transition-colors"
      >
        <GitBranch className="w-5 h-5" />
        순서도 생성
      </button>
      
      <button
        onClick={() => onGenerate('sql')}
        disabled={isLoading}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md disabled:opacity-50 transition-colors"
      >
        <TerminalSquare className="w-5 h-5" />
        SQL 생성
      </button>

      <button
        onClick={() => onGenerate('ts')}
        disabled={isLoading}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md disabled:opacity-50 transition-colors"
      >
        <Send className="w-5 h-5" />
        TypeScript 생성
      </button>
    </div>
  );
}
\`\`\`

### components/ResultPanel.tsx
\`\`\`tsx
"use client";
import { GenerateResponse } from '@/lib/types';
import CodeBlock from './CodeBlock';
import MermaidViewer from './MermaidViewer';

interface ResultPanelProps {
  result: GenerateResponse;
}

export default function ResultPanel({ result }: ResultPanelProps) {
  const { taskType, title, content, explanation, example, mermaidCode, warnings } = result;

  return (
    <div className="mt-8 border-t border-slate-200 pt-8 animate-in fade-in duration-500">
      {title && <h2 className="text-xl font-bold text-slate-800 mb-4">{title}</h2>}
      
      {warnings && warnings.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-800 rounded-r-md">
          <h4 className="font-bold flex items-center mb-1">주의사항</h4>
          <ul className="list-disc ml-5 space-y-1 text-sm">
            {warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {taskType === 'flow' && mermaidCode && (
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">순서도 시각화</h3>
            <MermaidViewer chart={mermaidCode} />
          </section>
        )}

        {content && taskType !== 'flow' && (
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">
              {taskType === 'sql' ? 'SQL 코드' : 'TypeScript 구현'}
            </h3>
            <CodeBlock code={content} language={taskType === 'sql' ? 'sql' : 'typescript'} />
          </section>
        )}

        {explanation && (
          <section className="bg-slate-50 p-5 rounded-md border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">설명</h3>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{explanation}</p>
          </section>
        )}

        {example && (
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">사용 예시</h3>
            <CodeBlock code={example} language={taskType === 'sql' ? 'sql' : 'typescript'} />
          </section>
        )}
      </div>
    </div>
  );
}
\`\`\`

### components/CodeBlock.tsx
\`\`\`tsx
"use client";
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = 'typescript' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('복사 실패');
    }
  };

  return (
    <div className="relative group rounded-md overflow-hidden bg-slate-900 border border-slate-800 my-4">
      <div className="flex justify-between items-center px-4 py-2 bg-slate-800/50">
        <span className="text-xs text-slate-400">{language}</span>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span>복사됨</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>코드 복사</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-sm text-slate-50 font-mono">
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
\`\`\`

### components/MermaidViewer.tsx
\`\`\`tsx
"use client";
import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import CodeBlock from './CodeBlock';

interface MermaidViewerProps {
  chart: string;
}

export default function MermaidViewer({ chart }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const renderChart = async () => {
      setHasError(false);
      try {
        mermaid.initialize({ startOnLoad: false, theme: 'default' });
        if (containerRef.current) {
          const { svg } = await mermaid.render(\`mermaid-\${Math.random().toString(36).substring(7)}\`, chart);
          if (isMounted) {
            containerRef.current.innerHTML = svg;
          }
        }
      } catch (error) {
        console.error('Mermaid 렌더링 에러');
        if (isMounted) {
          setHasError(true);
        }
      }
    };

    if (chart) {
      renderChart();
    }

    return () => {
      isMounted = false;
    };
  }, [chart]);

  if (hasError) {
    return (
      <div className="space-y-2">
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-200">
          Mermaid 다이어그램 렌더링에 실패했습니다. 아래 원문 코드를 확인해주세요.
        </div>
        <CodeBlock code={chart} language="mermaid" />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm overflow-x-auto">
      <div ref={containerRef} className="flex justify-center" />
    </div>
  );
}
\`\`\`

### components/SettingsModal.tsx
\`\`\`tsx
"use client";
import { useState, useEffect } from 'react';
import { Settings, getSettings, saveSettings } from '@/lib/storage';
import { X, KeyRound } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setApiKey(getSettings().geminiApiKey);
    }
  }, [isOpen]);

  const handleSave = () => {
    saveSettings({ geminiApiKey: apiKey.trim() });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-bold text-slate-800">설정</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AI Studio에서 발급받은 API Key"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
            <p className="mt-2 text-xs text-slate-500">
              API Key는 브라우저 내부(localStorage)에만 저장되며 서버로 전송되지 않습니다.
            </p>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 rounded-md shadow-sm transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
\`\`\`

### app/page.tsx
\`\`\`tsx
"use client";
import { useState, useEffect } from 'react';
import { useGenerate } from '@/hooks/useGenerate';
import PromptInput from '@/components/PromptInput';
import ActionButtons from '@/components/ActionButtons';
import ResultPanel from '@/components/ResultPanel';
import SettingsModal from '@/components/SettingsModal';
import { getSettings } from '@/lib/storage';
import { Settings as SettingsIcon, Code2, AlertCircle } from 'lucide-react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const { generate, isLoading, error, result } = useGenerate();

  useEffect(() => {
    setIsReady(true);
    const settings = getSettings();
    if (!settings.geminiApiKey) {
      setIsSettingsOpen(true);
    }
  }, []);

  if (!isReady) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-md flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">K-Dev Assistant</h1>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="설정"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
          <div className="space-y-1 mb-6">
            <h2 className="text-2xl font-bold text-slate-800">무엇을 도와드릴까요?</h2>
            <p className="text-sm text-slate-500">
              업무 요구사항을 자연어로 입력하고 원하는 형태의 결과물을 원클릭으로 생성하세요.
            </p>
          </div>

          <PromptInput value={prompt} onChange={setPrompt} />
          
          <ActionButtons onGenerate={(type) => generate(prompt, type)} isLoading={isLoading} />
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md animate-in fade-in flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        )}

        {isLoading && (
          <div className="mt-8 flex justify-center items-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 animate-pulse">생성 중입니다. 잠시만 기다려주세요...</p>
            </div>
          </div>
        )}

        {!isLoading && result && (
          <ResultPanel result={result} />
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
\`\`\`

### app/globals.css
\`\`\`css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: Arial, Helvetica, sans-serif;
}
\`\`\`

## 4. 실행 방법
\`\`\`bash
# 1. 프로젝트 디렉토리로 이동
cd C:\Users\user\.gemini\antigravity\Kpop\dev-assistant

# 2. 패키지 설치
npm install

# 3. 개발 서버 실행 (기본 3000포트)
npm run dev

# 4. 브라우저에서 접속
http://localhost:3000
\`\`\`

## 5. 수동 검증 시나리오
1. **API 키 없이 작동 시도**: 처음 접속 시 우상단 설정 또는 자동오픈된 모달 없이 임의로 생성 버튼 클릭 -> 에러 발생 `설정에서 Gemini API Key를 먼저 입력해주세요.` 확인. (콘솔에 키 노출 확인 안됨)
2. **Key 입력 & 저장**: 설정 버튼을 누르고 유효한 Gemini 키를 입력 후 저장 -> localStorage에 `dev_assistant_settings`가 기록되었는지 확인.
3. **TypeScript 코드 생성(성공케이스)**: `이메일 유효성을 검증하고 실패하면 에러를 던지는 함수를 만들어줘` 라는 프롬프트 입력 -> TypeScript 생성 버튼 클릭. -> 로딩스피너 이후 CodeBlock과 복사 버튼, 설명, 예시가 각각 분리되어 뷰어에 표시되는지 확인.
4. **Mermaid 렌더링 검수**: `사용자 로그인 이후 회원 여부에 따라 가입화면으로 보내는 플로우 만들어줘` -> 순서도 생성 클릭 -> Mermaid 렌더링 확인.
5. **Mermaid 렌더링 에러(Fallback)**: 만일 Mermaid가 이상한 문법이 반환되어 렌더링 실패 시, `Mermaid 다이어그램 렌더링에 실패했습니다...` 경고 메시지와 함께 Mermaid 원문 코드블록이 노출되는지 확인.

## 6. 다음 리팩토링 포인트
1. **LLM Provider 확장 모델**: 현재 단일 Provider(Gemini)에 하드코딩된 로직을 `base.ts` 인터페이스를 확장해 `OpenAIProvider`, `AnthropicProvider` 등으로 다형성에 맞게 추가 개발.
2. **저장 및 히스토리 관리**: API 방식이라 데이터가 날아가는 걸 방지하기 위해 로컬의 IndexedDB를 사용한 과거 이력 저장(클라이언트 자체 캐싱 기능 도입).
3. **SQL 스키마 Context 탑재**: DB 종류 옵션을 UI로 뺌과 동시에, 사내 DB DDL을 Context로 주입해서 더 정확한 엔터프라이즈 맞춤형 코드 및 SQL이 설계되게끔 확장.
