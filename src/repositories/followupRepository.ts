import { repoSupabase } from './supabaseClient';
import { logger } from '../../logger';

export type FollowupPromptType = 'CHOICE' | 'NEXT_ACTION' | 'FREE_INPUT';

export type FollowupSnapshotRow = {
  id: string;
  discord_user_id: string;
  chat_history_ref: string | null;
  analysis_type: string | null;
  persona_name: string | null;
  prompt_type: FollowupPromptType;
  options: string[];
};

export async function insertFollowupSnapshot(params: {
  discordUserId: string;
  chatHistoryRef: string;
  analysisType: string;
  personaName: string | null;
  promptType: FollowupPromptType;
  options: string[];
}): Promise<{ id: string } | null> {
  const { data, error } = await repoSupabase
    .from('followup_snapshots')
    .insert({
      discord_user_id: params.discordUserId,
      chat_history_ref: params.chatHistoryRef,
      analysis_type: params.analysisType,
      persona_name: params.personaName,
      prompt_type: params.promptType,
      options: params.options
    })
    .select('id')
    .maybeSingle();

  if (error) {
    logger.warn('FOLLOWUP', 'followup_snapshots insert failed', { message: error.message });
    return null;
  }
  const id = data?.id != null ? String(data.id) : '';
  return id ? { id } : null;
}

export async function getFollowupSnapshotById(id: string): Promise<FollowupSnapshotRow | null> {
  const { data, error } = await repoSupabase
    .from('followup_snapshots')
    .select('id, discord_user_id, chat_history_ref, analysis_type, persona_name, prompt_type, options')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    if (error) logger.warn('FOLLOWUP', 'followup_snapshots select failed', { message: error.message });
    return null;
  }
  const raw = data as Record<string, unknown>;
  const opts = raw.options;
  const options = Array.isArray(opts) ? opts.map(o => String(o)) : [];
  return {
    id: String(raw.id),
    discord_user_id: String(raw.discord_user_id ?? ''),
    chat_history_ref: raw.chat_history_ref != null ? String(raw.chat_history_ref) : null,
    analysis_type: raw.analysis_type != null ? String(raw.analysis_type) : null,
    persona_name: raw.persona_name != null ? String(raw.persona_name) : null,
    prompt_type: String(raw.prompt_type) as FollowupPromptType,
    options
  };
}
