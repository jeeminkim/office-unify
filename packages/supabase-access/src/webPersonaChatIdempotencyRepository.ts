import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PersonaChatMessageResponseBody,
  PersonaChatProcessingStage,
  PersonaChatRequestRowDto,
  PersonaChatRequestStatus,
} from '@office-unify/shared-types';

/** 멱등 해시 — user_key + persona + content */
export function hashPersonaChatMessageContent(
  userKey: string,
  personaKey: string,
  content: string,
): string {
  return `${userKey}::${personaKey}::${content}`;
}

function mapRow(row: Record<string, unknown>): PersonaChatRequestRowDto {
  const responseJson = row.response_json;
  return {
    id: String(row.id),
    userKey: String(row.user_key),
    idempotencyKey: String(row.idempotency_key),
    personaKey: String(row.persona_key),
    contentHash: String(row.content_hash),
    userContent: String(row.user_content),
    status: row.status as PersonaChatRequestStatus,
    processingStage: (row.processing_stage ?? null) as PersonaChatProcessingStage,
    llmAssistantText: row.llm_assistant_text == null ? null : String(row.llm_assistant_text),
    responseJson:
      responseJson && typeof responseJson === 'object'
        ? (responseJson as PersonaChatMessageResponseBody)
        : null,
    userMessageId: row.user_message_id == null ? null : String(row.user_message_id),
    assistantMessageId: row.assistant_message_id == null ? null : String(row.assistant_message_id),
    errorMessage: row.error_message == null ? null : String(row.error_message),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function fetchPersonaChatRequestRow(
  client: SupabaseClient,
  userKey: string,
  idempotencyKey: string,
): Promise<PersonaChatRequestRowDto | null> {
  const { data, error } = await client
    .from('web_persona_chat_requests')
    .select('*')
    .eq('user_key', userKey)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function insertPendingPersonaChatRequest(
  client: SupabaseClient,
  params: {
    userKey: string;
    idempotencyKey: string;
    personaKey: string;
    contentHash: string;
    userContent: string;
  },
): Promise<PersonaChatRequestRowDto | 'duplicate'> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('web_persona_chat_requests')
    .insert({
      user_key: params.userKey,
      idempotency_key: params.idempotencyKey,
      persona_key: params.personaKey,
      content_hash: params.contentHash,
      user_content: params.userContent,
      status: 'pending',
      processing_stage: null,
      llm_assistant_text: null,
      response_json: null,
      user_message_id: null,
      assistant_message_id: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return 'duplicate';
    }
    throw error;
  }
  if (!data) throw new Error('web_persona_chat_requests insert returned no row');
  return mapRow(data as Record<string, unknown>);
}

export async function updatePersonaChatRequestRow(
  client: SupabaseClient,
  id: string,
  patch: Partial<{
    status: PersonaChatRequestStatus;
    processingStage: PersonaChatProcessingStage;
    llmAssistantText: string | null;
    responseJson: PersonaChatMessageResponseBody | null;
    userMessageId: string | null;
    assistantMessageId: string | null;
    errorMessage: string | null;
    contentHash: string;
    userContent: string;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.processingStage !== undefined) row.processing_stage = patch.processingStage;
  if (patch.llmAssistantText !== undefined) row.llm_assistant_text = patch.llmAssistantText;
  if (patch.responseJson !== undefined) row.response_json = patch.responseJson;
  if (patch.userMessageId !== undefined) row.user_message_id = patch.userMessageId;
  if (patch.assistantMessageId !== undefined) row.assistant_message_id = patch.assistantMessageId;
  if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage;
  if (patch.contentHash !== undefined) row.content_hash = patch.contentHash;
  if (patch.userContent !== undefined) row.user_content = patch.userContent;

  const { error } = await client.from('web_persona_chat_requests').update(row).eq('id', id);

  if (error) throw error;
}
