import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey } from '@office-unify/shared-types';
import type { CommitteeFollowupDraft } from '@office-unify/shared-types';

export async function insertCommitteeFollowupItem(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  params: {
    committeeTurnId: string;
    sourceReportKind: string;
    item: CommitteeFollowupDraft;
    verificationNote?: string;
  },
): Promise<{ id: string; status: string }> {
  const { data, error } = await client
    .from('committee_followup_items')
    .insert({
      user_key: userKey as string,
      committee_turn_id: params.committeeTurnId,
      source_report_kind: params.sourceReportKind,
      title: params.item.title.trim(),
      item_type: params.item.itemType,
      priority: params.item.priority,
      status: params.item.status,
      rationale: params.item.rationale,
      owner_persona: params.item.ownerPersona ?? null,
      acceptance_criteria_json: params.item.acceptanceCriteria,
      required_evidence_json: params.item.requiredEvidence,
      entities_json: params.item.entities,
      verification_note: params.verificationNote ?? null,
    })
    .select('id,status')
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error('committee_followup_items insert returned no id');
  return { id: String(data.id), status: String(data.status ?? params.item.status) };
}

export async function insertCommitteeFollowupArtifact(
  client: SupabaseClient,
  params: {
    followupItemId: string;
    artifactType: string;
    contentMd?: string;
    contentJson?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await client.from('committee_followup_artifacts').insert({
    followup_item_id: params.followupItemId,
    artifact_type: params.artifactType,
    content_md: params.contentMd ?? null,
    content_json: params.contentJson ?? null,
  });
  if (error) throw error;
}

export async function getWebCommitteeTurnForUserScope(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  turnId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('web_committee_turns')
    .select('id')
    .eq('id', turnId)
    .eq('user_key', userKey as string)
    .maybeSingle();
  if (error) throw error;
  return !!data?.id;
}

