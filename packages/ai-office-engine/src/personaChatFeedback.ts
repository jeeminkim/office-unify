import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey, PersonaChatFeedbackRating, PersonaWebKey } from '@office-unify/shared-types';
import { toPersonaWebKey } from '@office-unify/shared-types';
import {
  selectPersonaLongTermSummary,
  selectWebPersonaAssistantMessageForFeedback,
  upsertPersonaLongTermSummary,
} from '@office-unify/supabase-access';
import {
  formatPrivateBankerLongTermForPrompt,
  mergePrivateBankerLongTermWithFeedback,
  PRIVATE_BANKER_LT_MEMORY_KEY,
} from './privateBanker/privateBankerLongTerm';
import { PRIVATE_BANKER_PERSONA_SLUG } from './privateBanker/privateBankerPrompt';
import { formatLongTermForPrompt, mergeWebLongTermWithFeedback } from './webPersonaLongTerm';
import { resolveWebPersona } from './webPersonas/registry';

async function loadPrivateBankerLongTermRaw(
  supabase: SupabaseClient,
  userKey: OfficeUserKey,
): Promise<string | null> {
  const chatKey = toPersonaWebKey(PRIVATE_BANKER_PERSONA_SLUG);
  const [ltNew, ltLegacy] = await Promise.all([
    selectPersonaLongTermSummary(supabase, userKey, PRIVATE_BANKER_LT_MEMORY_KEY),
    selectPersonaLongTermSummary(supabase, userKey, chatKey),
  ]);
  if (ltNew?.trim()) return ltNew;
  if (ltLegacy?.trim()) return ltLegacy;
  return null;
}

/**
 * assistant 메시지에 대한 평가를 `persona_memory` 장기 기억에 반영한다.
 */
export async function applyPersonaAssistantFeedback(params: {
  supabase: SupabaseClient;
  userKey: OfficeUserKey;
  personaKeyRaw: string;
  assistantMessageId: string;
  rating: PersonaChatFeedbackRating;
  note?: string | null;
}): Promise<{ longTermMemorySummary: string | null }> {
  const slug = params.personaKeyRaw.trim().toLowerCase();

  const sessionPersonaKey: PersonaWebKey =
    slug === PRIVATE_BANKER_PERSONA_SLUG ? toPersonaWebKey(PRIVATE_BANKER_PERSONA_SLUG) : toPersonaWebKey(slug);

  const msg = await selectWebPersonaAssistantMessageForFeedback(
    params.supabase,
    params.userKey,
    sessionPersonaKey,
    params.assistantMessageId,
  );
  if (!msg) {
    throw new Error('Assistant message not found or access denied.');
  }

  if (slug === PRIVATE_BANKER_PERSONA_SLUG) {
    const prev = await loadPrivateBankerLongTermRaw(params.supabase, params.userKey);
    const merged = mergePrivateBankerLongTermWithFeedback(prev, msg.content, params.rating, params.note);
    await upsertPersonaLongTermSummary(params.supabase, params.userKey, PRIVATE_BANKER_LT_MEMORY_KEY, merged);
    const display = formatPrivateBankerLongTermForPrompt(merged).trim();
    return { longTermMemorySummary: display || null };
  }

  const def = resolveWebPersona(slug);
  if (!def) {
    throw new Error(`Unknown personaKey: ${params.personaKeyRaw}`);
  }

  const prev = await selectPersonaLongTermSummary(params.supabase, params.userKey, def.key);
  const merged = mergeWebLongTermWithFeedback(prev, msg.content, params.rating, params.note);
  await upsertPersonaLongTermSummary(params.supabase, params.userKey, def.key, merged);
  const display = formatLongTermForPrompt(merged).trim();
  return { longTermMemorySummary: display || null };
}
