import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey } from '@office-unify/shared-types';

const EXCERPT_MAX = 2000;

export function buildCommitteeTranscriptExcerpt(topic: string, lines: { displayName: string; content: string }[]): string {
  const head = topic.trim().slice(0, 400);
  const body = lines
    .map((l) => `${l.displayName}: ${l.content.replace(/\s+/g, ' ').trim()}`)
    .join(' | ');
  const combined = [head, body].filter(Boolean).join(' · ');
  if (combined.length <= EXCERPT_MAX) return combined;
  return `${combined.slice(0, EXCERPT_MAX - 1)}…`;
}

export async function insertWebCommitteeTurn(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  topic: string,
  transcriptExcerpt: string,
): Promise<string> {
  const { data, error } = await client
    .from('web_committee_turns')
    .insert({
      user_key: userKey as string,
      topic: topic.slice(0, 8000),
      transcript_excerpt: transcriptExcerpt.slice(0, EXCERPT_MAX),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error('web_committee_turns insert returned no id');
  return String(data.id);
}

export async function updateWebCommitteeTurnExcerpt(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  turnId: string,
  transcriptExcerpt: string,
): Promise<void> {
  const { error } = await client
    .from('web_committee_turns')
    .update({
      transcript_excerpt: transcriptExcerpt.slice(0, EXCERPT_MAX),
      updated_at: new Date().toISOString(),
    })
    .eq('id', turnId)
    .eq('user_key', userKey as string);

  if (error) throw error;
}

export async function getWebCommitteeTurnForUser(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  turnId: string,
): Promise<{ id: string; topic: string; transcript_excerpt: string | null } | null> {
  const { data, error } = await client
    .from('web_committee_turns')
    .select('id,topic,transcript_excerpt')
    .eq('id', turnId)
    .eq('user_key', userKey as string)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) return null;
  return {
    id: String(data.id),
    topic: String(data.topic ?? ''),
    transcript_excerpt: data.transcript_excerpt != null ? String(data.transcript_excerpt) : null,
  };
}
