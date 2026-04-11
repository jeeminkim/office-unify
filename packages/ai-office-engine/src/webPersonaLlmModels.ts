/**
 * `/persona-chat` 웹 페르소나별 LLM 모델 기본값.
 * `OFFICE_UNIFY_*_PERSONA_CHAT_MODEL` 환경 변수가 있으면 해당 값이 슬러그별 맵·아래 기본값보다 우선한다.
 */

import {
  getOfficeUnifyGeminiPersonaChatModel,
  getOfficeUnifyOpenAiPersonaChatModel,
  getPerSlugOpenAiModelFromEnv,
} from './llmEnvConfig';

export const DEFAULT_GEMINI_WEB_PERSONA_MODEL = 'gemini-2.5-flash' as const;
export const DEFAULT_OPENAI_WEB_PERSONA_MODEL = 'gpt-4o-mini' as const;

/** Gemini 경로 — 슬러그별 모델(미등록 시 DEFAULT) */
export const GEMINI_MODEL_BY_WEB_PERSONA_SLUG: Readonly<Record<string, string>> = {
  'ray-dalio': 'gemini-2.5-flash',
  drucker: 'gemini-2.5-flash',
  cio: 'gemini-2.5-flash',
};

/** OpenAI 경로 — `webPersonaOpenAiRouting` 슬러그만 */
export const OPENAI_MODEL_BY_WEB_PERSONA_SLUG: Readonly<Record<string, string>> = {
  'jo-il-hyeon': 'gpt-4o-mini',
  hindenburg: 'gpt-4o-mini',
  'jim-simons': 'gpt-4o-mini',
};

export function resolveGeminiModelForWebPersonaSlug(slug: string): string {
  const env = getOfficeUnifyGeminiPersonaChatModel();
  if (env) return env;
  const s = slug.trim().toLowerCase();
  return GEMINI_MODEL_BY_WEB_PERSONA_SLUG[s] ?? DEFAULT_GEMINI_WEB_PERSONA_MODEL;
}

export function resolveOpenAiModelForWebPersonaSlug(slug: string): string {
  const per = getPerSlugOpenAiModelFromEnv(slug);
  if (per) return per;
  const env = getOfficeUnifyOpenAiPersonaChatModel();
  if (env) return env;
  const s = slug.trim().toLowerCase();
  return OPENAI_MODEL_BY_WEB_PERSONA_SLUG[s] ?? DEFAULT_OPENAI_WEB_PERSONA_MODEL;
}
