import { repoSupabase } from './supabaseClient';

export async function insertAnalysisClaimRows(
  rows: Record<string, unknown>[]
): Promise<{ ids: string[]; error: Error | null }> {
  if (!rows.length) return { ids: [], error: null };
  const { data, error } = await repoSupabase.from('analysis_claims').insert(rows).select('id');
  if (error) return { ids: [], error: new Error(error.message) };
  const ids = (data || []).map((d: { id: string }) => String(d.id));
  return { ids, error: null };
}

export async function findRecentClaimId(params: {
  discordUserId: string;
  chatHistoryId: number;
  analysisType: string;
  personaName: string;
}): Promise<string | null> {
  const { data, error } = await repoSupabase
    .from('analysis_claims')
    .select('id,created_at,claim_order')
    .eq('discord_user_id', params.discordUserId)
    .eq('chat_history_id', params.chatHistoryId)
    .eq('analysis_type', params.analysisType)
    .eq('persona_name', params.personaName)
    .order('created_at', { ascending: false })
    .order('claim_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ? String(data.id) : null;
}

export type ClaimRowLite = {
  id: string;
  persona_name: string;
  claim_summary: string;
  confidence_score: number;
  claim_type: string;
  is_downside_focused: boolean;
};

export async function listClaimsForChatHistory(params: {
  discordUserId: string;
  chatHistoryId: number;
  analysisType: string;
}): Promise<ClaimRowLite[]> {
  const { data, error } = await repoSupabase
    .from('analysis_claims')
    .select('id,persona_name,claim_summary,confidence_score,claim_type,is_downside_focused')
    .eq('discord_user_id', params.discordUserId)
    .eq('chat_history_id', params.chatHistoryId)
    .eq('analysis_type', params.analysisType)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return ((data || []) as any[]).map(r => ({
    id: String(r.id),
    persona_name: String(r.persona_name || ''),
    claim_summary: String(r.claim_summary || ''),
    confidence_score: Number(r.confidence_score ?? 0),
    claim_type: String(r.claim_type || ''),
    is_downside_focused: !!r.is_downside_focused
  }));
}
