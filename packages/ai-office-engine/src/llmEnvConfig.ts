/**
 * 서버 환경 변수로 LLM 모델명·출력 토큰 상한(비용)을 제어한다.
 * Next/Vercel 등에서 `process.env`는 빌드 시 주입된다.
 */

import { PERSONA_CHAT_ASSISTANT_TARGET_MAX_CHARS } from '@office-unify/shared-types';

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function parseTokenCap(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function defaultGeminiPersonaMaxOut(): number {
  /** 긴 한국어 답변·스트리밍을 허용하되, env로 상한 조정 가능 */
  return Math.min(8192, 4096);
}

function defaultOpenAiPersonaMax(): number {
  return Math.min(8192, 4096);
}

/** 설정 시 `/persona-chat` Gemini 페르소나 전부에 동일 모델 적용(코드 기본·슬러그별 맵보다 우선). */
export function getOfficeUnifyGeminiPersonaChatModel(): string | undefined {
  return trimEnv('OFFICE_UNIFY_GEMINI_PERSONA_CHAT_MODEL');
}

/** 설정 시 `/persona-chat` OpenAI 페르소나 전부에 동일 모델 적용. */
export function getOfficeUnifyOpenAiPersonaChatModel(): string | undefined {
  return trimEnv('OFFICE_UNIFY_OPENAI_PERSONA_CHAT_MODEL');
}

/** 설정 시 Private Banker(J. Pierpont) OpenAI 모델. 미설정 시 코드 기본값. */
export function getOfficeUnifyOpenAiPrivateBankerModel(): string | undefined {
  return trimEnv('OFFICE_UNIFY_OPENAI_PRIVATE_BANKER_MODEL');
}

/** `/api/generate`(메인 Dev_Support) Gemini 모델. 미설정 시 gemini-2.5-flash. */
export function getOfficeUnifyGeminiGenerateModel(): string {
  return trimEnv('OFFICE_UNIFY_GEMINI_GENERATE_MODEL') ?? 'gemini-2.5-flash';
}

export function getGeminiPersonaChatMaxOutputTokens(): number {
  return parseTokenCap(
    trimEnv('OFFICE_UNIFY_GEMINI_PERSONA_CHAT_MAX_OUTPUT_TOKENS'),
    defaultGeminiPersonaMaxOut(),
    256,
    8192,
  );
}

export function getOpenAiPersonaChatMaxTokens(): number {
  return parseTokenCap(
    trimEnv('OFFICE_UNIFY_OPENAI_PERSONA_CHAT_MAX_TOKENS'),
    defaultOpenAiPersonaMax(),
    256,
    16384,
  );
}

export function getOpenAiPrivateBankerMaxTokens(): number {
  return parseTokenCap(
    trimEnv('OFFICE_UNIFY_OPENAI_PRIVATE_BANKER_MAX_TOKENS'),
    defaultOpenAiPersonaMax(),
    256,
    16384,
  );
}

/** Dev_Support 생성 한 건당 출력 토큰 상한. */
export function getGeminiGenerateMaxOutputTokens(): number {
  return parseTokenCap(trimEnv('OFFICE_UNIFY_GEMINI_GENERATE_MAX_OUTPUT_TOKENS'), 8192, 256, 32768);
}

function firstEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = trimEnv(k);
    if (v) return v;
  }
  return undefined;
}

function parseOn(raw: string | undefined, defaultVal: boolean): boolean {
  if (raw === undefined || raw === null || String(raw).trim() === '') return defaultVal;
  const s = String(raw).trim().toLowerCase();
  if (['on', 'true', '1', 'yes'].includes(s)) return true;
  if (['off', 'false', '0', 'no'].includes(s)) return false;
  return defaultVal;
}

/** `jim-simons` → `JIM_SIMONS`, `jo-il-hyeon` → `JO_IL_HYEON` */
function slugToOpenAiModelEnvSuffix(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .toUpperCase();
}

/** legacy·통합 페르소나별 OpenAI 모델명 (미설정 시 다음 단계로). */
const LEGACY_OPENAI_MODEL_ENV_BY_SLUG: Record<string, string> = {
  hindenburg: 'OPENAI_MODEL_HINDENBURG',
  'jim-simons': 'OPENAI_MODEL_SIMONS',
  'jo-il-hyeon': 'OPENAI_MODEL_JO_IL_HYEON',
};

export function getPerSlugOpenAiModelFromEnv(slug: string): string | undefined {
  const s = slug.trim().toLowerCase();
  const legacyKey = LEGACY_OPENAI_MODEL_ENV_BY_SLUG[s];
  const fromLegacy = legacyKey ? trimEnv(legacyKey) : undefined;
  if (fromLegacy) return fromLegacy;
  return trimEnv(`OFFICE_UNIFY_OPENAI_MODEL_${slugToOpenAiModelEnvSuffix(slug)}`);
}

export function getOpenAiUsageScope(): string {
  return trimEnv('OFFICE_UNIFY_OPENAI_USAGE_SCOPE') ?? 'global';
}

export function getOpenAiMonthlyMaxCalls(): number | undefined {
  const raw = firstEnv('OFFICE_UNIFY_OPENAI_MONTHLY_MAX_CALLS', 'OPENAI_MONTHLY_MAX_CALLS');
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export function getOpenAiMonthlyBudgetUsd(): number | undefined {
  const raw = firstEnv('OFFICE_UNIFY_OPENAI_MONTHLY_BUDGET_USD', 'OPENAI_MONTHLY_BUDGET_USD');
  if (!raw) return undefined;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/** 기본 on — off 시 한도를 막지 않음(성공 호출만 집계). */
export function isOpenAiBudgetEnforcementEnabled(): boolean {
  const raw = firstEnv('OFFICE_UNIFY_OPENAI_BUDGET_ENFORCEMENT', 'OPENAI_BUDGET_ENFORCEMENT');
  return parseOn(raw, true);
}

/** 기본 off — on 시 한도 초과·OpenAI 오류 시 Gemini 폴백(키 필요). */
export function isOpenAiFallbackToGeminiEnabled(): boolean {
  const raw = firstEnv('OFFICE_UNIFY_OPENAI_FALLBACK_TO_GEMINI', 'OPENAI_FALLBACK_TO_GEMINI');
  return parseOn(raw, false);
}
