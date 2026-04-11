import type { SupabaseClient } from '@supabase/supabase-js';

export type OpenAiMonthlyUsageRow = {
  openai_calls: number;
  openai_usd_estimate: number;
};

export async function fetchOpenAiMonthlyUsage(
  client: SupabaseClient,
  scope: string,
  periodYm: string,
): Promise<OpenAiMonthlyUsageRow> {
  const { data, error } = await client
    .from('web_llm_usage_monthly')
    .select('openai_calls, openai_usd_estimate')
    .eq('scope', scope)
    .eq('period_ym', periodYm)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { openai_calls: 0, openai_usd_estimate: 0 };
  }
  return {
    openai_calls: Number(data.openai_calls) || 0,
    openai_usd_estimate: Number(data.openai_usd_estimate) || 0,
  };
}

export async function incrementOpenAiUsage(
  client: SupabaseClient,
  params: { scope: string; periodYm: string; callsDelta: number; usdDelta: number },
): Promise<void> {
  const { error } = await client.rpc('increment_openai_usage', {
    p_scope: params.scope,
    p_period_ym: params.periodYm,
    p_calls: params.callsDelta,
    p_usd: params.usdDelta,
  });
  if (error) throw error;
}
