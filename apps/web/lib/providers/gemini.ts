import { getGeminiGenerateMaxOutputTokens, getOfficeUnifyGeminiGenerateModel } from '@office-unify/ai-office-engine';
import { Provider } from './base';
import { GenerateRequest, GenerateResponse } from '../types';
import { getSystemPrompt, buildSqlUserPrompt } from '../prompts';
import { ApiError, logDevError } from '../utils';
import { extractJsonObject, normalizeGenerateResponse } from '../parsers/generateResponse';

export class GeminiProvider implements Provider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const { prompt, taskType, apiKey, dbType, schemaContext, sqlStyleHints, preferenceHint } =
      request;

    const key = (typeof apiKey === 'string' && apiKey.trim().length > 0 ? apiKey : process.env.GEMINI_API_KEY)?.trim();
    if (!key) {
      throw new ApiError('API Key가 설정되지 않았습니다.', 401);
    }

    const systemPrompt = getSystemPrompt(taskType);

    const baseUserText =
      taskType === 'sql'
        ? buildSqlUserPrompt(
            prompt,
            dbType ?? 'postgresql',
            typeof schemaContext === 'string' ? schemaContext : '',
            typeof sqlStyleHints === 'string' ? sqlStyleHints : undefined
          )
        : `사용자 요청:\n${prompt}`;

    const hintBlock =
      typeof preferenceHint === 'string' && preferenceHint.trim().length > 0
        ? `\n\n[사용자 누적 피드백 힌트 — 참고만, 스키마·사실을 바꾸지 말 것]\n${preferenceHint.trim()}`
        : '';

    const userText = `${baseUserText}${hintBlock}`;

    try {
      const model = getOfficeUnifyGeminiGenerateModel();
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userText}` }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: getGeminiGenerateMaxOutputTokens(),
            },
          }),
        },
      );

      if (!res.ok) {
        if (res.status === 429) {
          throw new ApiError('API 사용량 제한(Rate Limit)을 초과했습니다. 잠시 후 다시 시도해주세요.', 429);
        }
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new ApiError('인증 오류이거나 잘못된 요청입니다. (API Key 확인 필요)', 401);
        }
        throw new ApiError('Gemini API 호출에 실패했습니다.', res.status);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new ApiError('LLM에서 빈 응답을 반환했습니다.', 500);

      const parsed = extractJsonObject(text);
      return normalizeGenerateResponse(parsed, taskType, text);

    } catch (error: unknown) {
      const status =
        error instanceof ApiError ? error.statusCode : 500;
      logDevError('GeminiProvider 처리 에러 (StatusCode 포함)', status, error);
      if (error instanceof ApiError) throw error;
      throw new ApiError('네트워크 또는 알 수 없는 오류가 발생했습니다.', 500);
    }
  }
}
