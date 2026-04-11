import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchOpenAiMonthlyUsage, incrementOpenAiUsage } from '@office-unify/supabase-access';
import { getKstYearMonth } from '@office-unify/shared-utils';
import { estimateOpenAiCallUsd } from './openAiUsageCost';
import {
  getOpenAiMonthlyBudgetUsd,
  getOpenAiMonthlyMaxCalls,
  getOpenAiUsageScope,
  isOpenAiBudgetEnforcementEnabled,
  isOpenAiFallbackToGeminiEnabled,
} from './llmEnvConfig';

export type OpenAiCallUsage = {
  promptTokens: number;
  completionTokens: number;
  model: string;
};

/** 스트리밍 등에서 OpenAI 호출 전에만 동일 규칙으로 막힘 여부를 판별한다. */
export async function getOpenAiBudgetBlockStatus(
  supabase: SupabaseClient,
): Promise<'ok' | 'blocked_calls' | 'blocked_usd'> {
  const scope = getOpenAiUsageScope();
  const periodYm = getKstYearMonth();
  const maxCalls = getOpenAiMonthlyMaxCalls();
  const maxUsd = getOpenAiMonthlyBudgetUsd();
  const enforce = isOpenAiBudgetEnforcementEnabled();
  const hasLimits = maxCalls != null || maxUsd != null;
  if (!enforce || !hasLimits) return 'ok';
  let row: { openai_calls: number; openai_usd_estimate: number };
  try {
    row = await fetchOpenAiMonthlyUsage(supabase, scope, periodYm);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    throw new Error(
      `OpenAI 사용량을 읽을 수 없습니다. docs/sql/append_web_llm_usage_monthly.sql 적용 및 increment_openai_usage RPC를 확인하세요. (${msg})`,
    );
  }
  if (maxCalls != null && row.openai_calls >= maxCalls) return 'blocked_calls';
  if (maxUsd != null && row.openai_usd_estimate >= maxUsd) return 'blocked_usd';
  return 'ok';
}

/** 스트리밍 등 성공한 OpenAI 호출 한 건을 월간 집계에 반영한다. */
export async function incrementOpenAiUsageAfterSuccessfulOpenAiCall(
  supabase: SupabaseClient,
  usage: OpenAiCallUsage,
): Promise<void> {
  const scope = getOpenAiUsageScope();
  const periodYm = getKstYearMonth();
  const usd = estimateOpenAiCallUsd({
    model: usage.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  });
  try {
    await incrementOpenAiUsage(supabase, {
      scope,
      periodYm,
      callsDelta: 1,
      usdDelta: usd,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    throw new Error(
      `OpenAI 응답은 받았으나 사용량 기록에 실패했습니다. append_web_llm_usage_monthly.sql·RPC를 확인하세요. (${msg})`,
    );
  }
}

/**
 * OpenAI 호출 전 월간 한도 검사(옵션) → OpenAI 실행 → 성공 시 집계.
 * 한도/오류 시 Gemini 폴백(옵션).
 */
export async function executeOpenAiWithBudgetAndGeminiFallback(params: {
  supabase: SupabaseClient;
  geminiApiKey: string;
  invokeOpenAi: () => Promise<{ text: string; usage?: OpenAiCallUsage }>;
  invokeGeminiFallback: () => Promise<string>;
}): Promise<{ text: string; providerNote?: string }> {
  const scope = getOpenAiUsageScope();
  const periodYm = getKstYearMonth();
  const maxCalls = getOpenAiMonthlyMaxCalls();
  const maxUsd = getOpenAiMonthlyBudgetUsd();
  const enforce = isOpenAiBudgetEnforcementEnabled();
  const fallback = isOpenAiFallbackToGeminiEnabled();
  const geminiKey = params.geminiApiKey?.trim() ?? '';

  const hasLimits = maxCalls != null || maxUsd != null;

  if (enforce && hasLimits) {
    let row: { openai_calls: number; openai_usd_estimate: number };
    try {
      row = await fetchOpenAiMonthlyUsage(params.supabase, scope, periodYm);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown';
      throw new Error(
        `OpenAI 사용량을 읽을 수 없습니다. docs/sql/append_web_llm_usage_monthly.sql 적용 및 increment_openai_usage RPC를 확인하세요. (${msg})`,
      );
    }
    const overCalls = maxCalls != null && row.openai_calls >= maxCalls;
    const overUsd = maxUsd != null && row.openai_usd_estimate >= maxUsd;
    if (overCalls || overUsd) {
      if (fallback && geminiKey) {
        const text = await params.invokeGeminiFallback();
        return {
          text,
          providerNote: 'OpenAI 월간 호출/추정 예산 한도로 Gemini로 응답했습니다.',
        };
      }
      throw new Error(
        overCalls
          ? `OpenAI 월간 호출 한도(${maxCalls}회)에 도달했습니다.`
          : `OpenAI 월간 추정 예산($${maxUsd})에 도달했습니다.`,
      );
    }
  }

  try {
    const out = await params.invokeOpenAi();
    const u = out.usage;
    const usd = u
      ? estimateOpenAiCallUsd({
          model: u.model,
          promptTokens: u.promptTokens,
          completionTokens: u.completionTokens,
        })
      : 0;
    try {
      await incrementOpenAiUsage(params.supabase, {
        scope,
        periodYm,
        callsDelta: 1,
        usdDelta: usd,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown';
      throw new Error(
        `OpenAI 응답은 받았으나 사용량 기록에 실패했습니다. append_web_llm_usage_monthly.sql·RPC를 확인하세요. (${msg})`,
      );
    }
    return { text: out.text };
  } catch (e: unknown) {
    if (fallback && geminiKey) {
      const text = await params.invokeGeminiFallback();
      const errMsg = e instanceof Error ? e.message : 'OpenAI error';
      return {
        text,
        providerNote: `OpenAI 호출 실패로 Gemini로 응답했습니다. (${errMsg.slice(0, 200)})`,
      };
    }
    throw e;
  }
}
