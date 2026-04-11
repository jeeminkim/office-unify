import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey, PersonaWebKey } from '@office-unify/shared-types';

/**
 * legacy `persona_memory` — 웹에서는 `discord_user_id`에 `OfficeUserKey`, `persona_name`에 `PersonaWebKey` 슬러그를 넣는다.
 */
export async function selectPersonaLongTermSummary(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  personaKey: PersonaWebKey,
): Promise<string | null> {
  const { data, error } = await client
    .from('persona_memory')
    .select('last_feedback_summary')
    .eq('discord_user_id', userKey as string)
    .eq('persona_name', personaKey as string)
    .maybeSingle();

  if (error) throw error;
  const v = data?.last_feedback_summary;
  if (v == null || typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

export async function upsertPersonaLongTermSummary(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  personaKey: PersonaWebKey,
  lastFeedbackSummary: string,
): Promise<void> {
  const { error } = await client.from('persona_memory').upsert(
    {
      discord_user_id: userKey as string,
      persona_name: personaKey as string,
      last_feedback_summary: lastFeedbackSummary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'discord_user_id,persona_name' },
  );

  if (error) throw error;
}
