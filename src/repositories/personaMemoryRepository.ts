import { repoSupabase } from './supabaseClient';

/** Raw row or null — 호출측에서 empty 메모리 병합 */
export async function selectPersonaMemoryRow(
  discordUserId: string,
  personaName: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await repoSupabase
    .from('persona_memory')
    .select('*')
    .eq('discord_user_id', discordUserId)
    .eq('persona_name', personaName)
    .maybeSingle();
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? null;
}

export async function upsertPersonaMemoryRow(payload: Record<string, unknown>): Promise<void> {
  const { error } = await repoSupabase
    .from('persona_memory')
    .upsert(payload, { onConflict: 'discord_user_id,persona_name' });
  if (error) throw error;
}
