import { repoSupabase } from './supabaseClient';

/**
 * analysis_feedback_history 전용 — Supabase select/insert 만 수행한다.
 * 중복 윈도·프로필 집계 등은 feedbackService(application)에서 처리한다.
 */
export async function selectRecentFeedbackHistoryRows(params: {
  discordUserId: string;
  chatHistoryId: number;
  personaName: string;
  feedbackType: string;
  createdAfterIso: string;
}): Promise<{ rows: { id: unknown; created_at: string }[]; error: { message: string } | null }> {
  const { data, error } = await repoSupabase
    .from('analysis_feedback_history')
    .select('id,created_at')
    .eq('discord_user_id', params.discordUserId)
    .eq('chat_history_id', params.chatHistoryId)
    .eq('persona_name', params.personaName)
    .eq('feedback_type', params.feedbackType)
    .gte('created_at', params.createdAfterIso)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    return { rows: [], error: { message: error.message } };
  }
  return { rows: data ?? [], error: null };
}

export async function insertAnalysisFeedbackHistoryRow(payload: Record<string, unknown>): Promise<{ error: { message: string } | null }> {
  const { error } = await repoSupabase.from('analysis_feedback_history').insert(payload);
  if (error) {
    return { error: { message: error.message } };
  }
  return { error: null };
}
