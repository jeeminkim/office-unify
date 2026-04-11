/**
 * OpenAI Chat Completions usage → USD 추정(청구서 대체 아님). 모델별 단가는 공개 요금 기준 근사값.
 */

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

/** $ / 1M input tokens, $ / 1M output tokens */
const MODEL_RATES_USD_PER_MTOK: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-5-mini': { in: 0.25, out: 2 },
  'gpt-5': { in: 1.25, out: 10 },
};

function resolveRates(model: string): { in: number; out: number } {
  const m = model.trim().toLowerCase();
  if (MODEL_RATES_USD_PER_MTOK[m]) return MODEL_RATES_USD_PER_MTOK[m];
  for (const [k, v] of Object.entries(MODEL_RATES_USD_PER_MTOK)) {
    if (m.startsWith(k)) return v;
  }
  const blended = trimEnv('OFFICE_UNIFY_OPENAI_ESTIMATE_BLENDED_USD_PER_MTOK');
  if (blended) {
    const n = Number.parseFloat(blended);
    if (Number.isFinite(n) && n >= 0) {
      return { in: n, out: n };
    }
  }
  return { in: 0.3, out: 0.9 };
}

export function estimateOpenAiCallUsd(params: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const r = resolveRates(params.model);
  const usd = (params.promptTokens / 1e6) * r.in + (params.completionTokens / 1e6) * r.out;
  return Math.round(usd * 1e6) / 1e6;
}
