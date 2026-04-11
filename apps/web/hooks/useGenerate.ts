"use client";
import { useState } from 'react';
import { TaskType, GenerateResponse, DbType } from '@/lib/types';
import { saveRecentResult } from '@/lib/storage';

export type GenerateOptions = {
  dbType?: DbType;
  schemaContext?: string;
  sqlStyleHints?: string;
  /** enrich 등으로 API body와 다를 때, 최근 이력에 넣을 원문 프롬프트 */
  persistPrompt?: string;
  /** 서버 집계 피드백 힌트(로그인 시 홈에서 주입) */
  preferenceHint?: string;
};

export const useGenerate = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const generate = async (
    prompt: string,
    taskType: TaskType,
    options?: GenerateOptions
  ) => {
    setIsLoading(true);
    setError(null);

    if (!prompt.trim()) {
      setError('업무 내용을 입력해주세요.');
      setIsLoading(false);
      return;
    }

    try {
      const body: Record<string, unknown> = {
        prompt,
        taskType,
        provider: 'gemini',
      };

      if (taskType === 'sql') {
        body.dbType = options?.dbType ?? 'postgresql';
        body.schemaContext =
          typeof options?.schemaContext === 'string' ? options.schemaContext : '';
        body.sqlStyleHints =
          typeof options?.sqlStyleHints === 'string' ? options.sqlStyleHints : '';
      }

      if (typeof options?.preferenceHint === 'string' && options.preferenceHint.trim()) {
        body.preferenceHint = options.preferenceHint.trim();
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '생성에 실패했습니다.');
      }

      setResult(data);

      const baseTitle = data.title || `${prompt.substring(0, 30)}...`;
      const storedPrompt = options?.persistPrompt ?? prompt;
      saveRecentResult({
        taskType: data.taskType,
        title: baseTitle,
        prompt: storedPrompt,
        ...(taskType === 'sql' && options
          ? {
              schemaContext:
                typeof options.schemaContext === 'string' ? options.schemaContext : '',
              dbType: options.dbType ?? 'postgresql',
              sqlStyleHints:
                typeof options.sqlStyleHints === 'string' ? options.sqlStyleHints : '',
            }
          : {}),
      });

    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return { generate, isLoading, error, result };
};
