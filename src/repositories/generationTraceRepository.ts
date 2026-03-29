import { logger } from '../../logger';
import { repoSupabase } from './supabaseClient';
import type { AnalysisGenerationTraceInsertContract } from '../types/dbSchemaContract';

type TraceBase = Omit<
  AnalysisGenerationTraceInsertContract,
  'provider_name' | 'model_name' | 'estimated_cost_usd'
>;

/** Supabase insert only — extended columns 실패 시 base 컬럼으로 한 번 더 시도(기존 파이프라인 동일). */
export async function insertGenerationTraceExtendedOrBase(params: {
  extended: AnalysisGenerationTraceInsertContract;
  base: TraceBase;
}): Promise<void> {
  const ext = params.extended;
  const traceRowBase: Record<string, unknown> = {
    discord_user_id: ext.discord_user_id,
    chat_history_id: ext.chat_history_id,
    analysis_type: ext.analysis_type,
    persona_name: ext.persona_name,
    input_context_hash: ext.input_context_hash ?? null,
    memory_snapshot: ext.memory_snapshot ?? {},
    evidence_snapshot: ext.evidence_snapshot ?? {},
    output_summary: ext.output_summary ?? null,
    latency_ms: null,
    token_hint_in: null,
    token_hint_out: null
  };
  const traceRowExtended: Record<string, unknown> = {
    ...traceRowBase,
    provider_name: ext.provider_name ?? null,
    model_name: ext.model_name ?? null,
    estimated_cost_usd: ext.estimated_cost_usd ?? null
  };

  let { error } = await repoSupabase.from('analysis_generation_trace').insert(traceRowExtended);
  if (error) {
    logger.warn('TRACE', 'analysis_generation_trace extended insert failed; fallback to base columns', {
      message: error.message
    });
    const retry = await repoSupabase.from('analysis_generation_trace').insert(traceRowBase);
    error = retry.error || null;
    if (error) throw error;
  }
  logger.info('TRACE', 'analysis_generation_trace stored', {
    discordUserId: ext.discord_user_id,
    analysisType: ext.analysis_type,
    personaName: ext.persona_name,
    providerName: ext.provider_name ?? null,
    modelName: ext.model_name ?? null
  });
}
