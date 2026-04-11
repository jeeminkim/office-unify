import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DailySessionDateKst,
  OfficeUserKey,
  PersonaChatMessageDto,
  PersonaChatMessageRole,
  PersonaWebKey,
} from '@office-unify/shared-types';
import type { KstDateString } from '@office-unify/shared-utils';

function mapMessage(row: {
  id: number | string;
  role: string;
  content: string;
  created_at: string;
}): PersonaChatMessageDto {
  return {
    id: String(row.id),
    role: row.role as PersonaChatMessageRole,
    content: row.content,
    createdAt: row.created_at,
  };
}

export async function getOrCreateWebPersonaSession(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  personaKey: PersonaWebKey,
  sessionDateKst: KstDateString,
): Promise<{ sessionId: string; sessionDateKst: DailySessionDateKst }> {
  const uk = userKey as string;
  const pk = personaKey as string;
  const d = sessionDateKst as string;

  const { data: existing, error: selErr } = await client
    .from('web_persona_chat_sessions')
    .select('id,session_date_kst')
    .eq('user_key', uk)
    .eq('persona_key', pk)
    .eq('session_date_kst', d)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing?.id) {
    return {
      sessionId: String(existing.id),
      sessionDateKst: String(existing.session_date_kst) as DailySessionDateKst,
    };
  }

  const { data: inserted, error: insErr } = await client
    .from('web_persona_chat_sessions')
    .insert({
      user_key: uk,
      persona_key: pk,
      session_date_kst: d,
    })
    .select('id,session_date_kst')
    .single();

  if (insErr) throw insErr;
  if (!inserted?.id) throw new Error('web_persona_chat_sessions insert returned no id');

  return {
    sessionId: String(inserted.id),
    sessionDateKst: String(inserted.session_date_kst) as DailySessionDateKst,
  };
}

export async function fetchWebPersonaMessagesByIds(
  client: SupabaseClient,
  sessionId: string,
  userMessageId: string,
  assistantMessageId: string,
): Promise<{ userMessage: PersonaChatMessageDto; assistantMessage: PersonaChatMessageDto }> {
  const ids = [Number(userMessageId), Number(assistantMessageId)];
  const { data, error } = await client
    .from('web_persona_chat_messages')
    .select('id,role,content,created_at')
    .eq('session_id', sessionId)
    .in('id', ids);

  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: number; role: string; content: string; created_at: string }>;
  const u = rows.find((r) => String(r.id) === userMessageId);
  const a = rows.find((r) => String(r.id) === assistantMessageId);
  if (!u || !a || u.role !== 'user' || a.role !== 'assistant') {
    throw new Error('web_persona_chat_messages: could not load messages for idempotency resume');
  }
  return {
    userMessage: mapMessage(u),
    assistantMessage: mapMessage(a),
  };
}

/**
 * 사용자·페르소나 세션에 속한 assistant 메시지 한 건만 조회(피드백·장기 기억 저장 전 검증).
 */
export async function selectWebPersonaAssistantMessageForFeedback(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  personaKey: PersonaWebKey,
  assistantMessageId: string,
): Promise<{ content: string } | null> {
  const mid = Number(assistantMessageId);
  if (!Number.isFinite(mid)) return null;

  const { data: msg, error: mErr } = await client
    .from('web_persona_chat_messages')
    .select('id, role, content, session_id')
    .eq('id', mid)
    .maybeSingle();

  if (mErr) throw mErr;
  const row = msg as { id: number; role: string; content: string; session_id: string } | null;
  if (!row || row.role !== 'assistant') return null;

  const { data: sess, error: sErr } = await client
    .from('web_persona_chat_sessions')
    .select('user_key, persona_key')
    .eq('id', row.session_id)
    .maybeSingle();

  if (sErr) throw sErr;
  const s = sess as { user_key: string; persona_key: string } | null;
  if (!s || s.user_key !== (userKey as string) || s.persona_key !== (personaKey as string)) {
    return null;
  }

  return { content: String(row.content) };
}

export async function listWebPersonaMessages(
  client: SupabaseClient,
  sessionId: string,
): Promise<PersonaChatMessageDto[]> {
  const { data, error } = await client
    .from('web_persona_chat_messages')
    .select('id,role,content,created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) =>
    mapMessage(row as { id: number; role: string; content: string; created_at: string }),
  );
}

export async function insertWebPersonaMessage(
  client: SupabaseClient,
  sessionId: string,
  role: PersonaChatMessageRole,
  content: string,
): Promise<PersonaChatMessageDto> {
  const { data, error } = await client
    .from('web_persona_chat_messages')
    .insert({ session_id: sessionId, role, content })
    .select('id,role,content,created_at')
    .single();

  if (error) throw error;
  if (!data) throw new Error('web_persona_chat_messages insert returned no row');
  return mapMessage(data as { id: number; role: string; content: string; created_at: string });
}

/**
 * user → assistant 한 번에 삽입(LLM 성공 후). 한쪽만 남는 DB 불일치를 방지한다.
 */
export async function insertWebPersonaUserAssistantPair(
  client: SupabaseClient,
  sessionId: string,
  userContent: string,
  assistantContent: string,
): Promise<{ userMessage: PersonaChatMessageDto; assistantMessage: PersonaChatMessageDto }> {
  const { data, error } = await client
    .from('web_persona_chat_messages')
    .insert([
      { session_id: sessionId, role: 'user' as const, content: userContent },
      { session_id: sessionId, role: 'assistant' as const, content: assistantContent },
    ])
    .select('id,role,content,created_at');

  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: number; role: string; content: string; created_at: string }>;
  if (rows.length !== 2) {
    throw new Error('web_persona_chat_messages pair insert expected 2 rows');
  }
  const u = rows.find((r) => r.role === 'user');
  const a = rows.find((r) => r.role === 'assistant');
  if (!u || !a) {
    throw new Error('web_persona_chat_messages pair insert missing role row');
  }
  return {
    userMessage: mapMessage(u),
    assistantMessage: mapMessage(a),
  };
}

/** 직전 KST 일(오늘보다 이전) 세션 중 가장 최근 것의 마지막 assistant 한 줄 */
export async function getPreviousKstDayAssistantHint(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  personaKey: PersonaWebKey,
  todayKst: KstDateString,
): Promise<string | null> {
  const uk = userKey as string;
  const pk = personaKey as string;
  const today = todayKst as string;

  const { data: prev, error: sErr } = await client
    .from('web_persona_chat_sessions')
    .select('id')
    .eq('user_key', uk)
    .eq('persona_key', pk)
    .lt('session_date_kst', today)
    .order('session_date_kst', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sErr) throw sErr;
  if (!prev?.id) return null;

  const { data: msg, error: mErr } = await client
    .from('web_persona_chat_messages')
    .select('content,created_at')
    .eq('session_id', prev.id)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (mErr) throw mErr;
  return msg?.content ? String(msg.content) : null;
}
