import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey } from '@office-unify/shared-types';

export const OPS_EVENT_TYPES = [
  'error',
  'warning',
  'info',
  'improvement',
  'user_feedback',
  'degraded',
  'recovery',
] as const;
export type OpsEventType = (typeof OPS_EVENT_TYPES)[number];

export const OPS_SEVERITIES = ['debug', 'info', 'warn', 'error', 'critical'] as const;
export type OpsSeverity = (typeof OPS_SEVERITIES)[number];

export const OPS_STATUSES = ['open', 'investigating', 'resolved', 'ignored', 'backlog'] as const;
export type OpsEventStatus = (typeof OPS_STATUSES)[number];

export type WebOpsEventRow = {
  id: string;
  user_key: string | null;
  event_type: string;
  severity: string;
  domain: string;
  route: string | null;
  component: string | null;
  message: string;
  code: string | null;
  status: string;
  action_hint: string | null;
  detail: unknown;
  fingerprint: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

export type OpsEventInsertRow = {
  user_key?: string | null;
  event_type: OpsEventType;
  severity: OpsSeverity;
  domain: string;
  route?: string | null;
  component?: string | null;
  message: string;
  code?: string | null;
  status?: OpsEventStatus;
  action_hint?: string | null;
  detail?: unknown;
  fingerprint?: string | null;
};

export type UpsertOpsEventByFingerprintInput = {
  user_key?: string | null;
  event_type: OpsEventType;
  severity: OpsSeverity;
  domain: string;
  route?: string | null;
  component?: string | null;
  message: string;
  code?: string | null;
  status?: OpsEventStatus;
  action_hint?: string | null;
  detail?: unknown;
  fingerprint: string;
};

export type UpsertOpsEventByFingerprintResult = {
  ok: boolean;
  via: 'rpc' | 'fallback';
  inserted: boolean;
  updated: boolean;
  reopened: boolean;
  ignored: boolean;
  occurrence_count: number;
  status: string;
  id?: string;
  warning?: string;
};

export type OpsEventListFilters = {
  status?: string;
  severity?: string;
  domain?: string;
  eventType?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export async function insertOpsEvent(client: SupabaseClient, row: OpsEventInsertRow): Promise<WebOpsEventRow | null> {
  const payload = {
    user_key: row.user_key ?? null,
    event_type: row.event_type,
    severity: row.severity,
    domain: row.domain,
    route: row.route ?? null,
    component: row.component ?? null,
    message: row.message,
    code: row.code ?? null,
    status: row.status ?? 'open',
    action_hint: row.action_hint ?? null,
    detail: row.detail ?? null,
    fingerprint: row.fingerprint ?? null,
    occurrence_count: 1,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };
  const { data, error } = await client.from('web_ops_events').insert(payload).select().single();
  if (error) throw error;
  return data as WebOpsEventRow;
}

export async function bumpOpsEventByFingerprint(
  client: SupabaseClient,
  fingerprint: string,
): Promise<{ id: string; occurrence_count: number } | null> {
  const { data: row, error: selErr } = await client
    .from('web_ops_events')
    .select('id, occurrence_count')
    .eq('fingerprint', fingerprint)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) return null;
  const next = (row as { id: string; occurrence_count: number }).occurrence_count + 1;
  const { error: upErr } = await client
    .from('web_ops_events')
    .update({
      occurrence_count: next,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', (row as { id: string }).id);
  if (upErr) throw upErr;
  return { id: (row as { id: string }).id, occurrence_count: next };
}

type RpcUpsertRow = {
  id: string;
  inserted: boolean;
  updated: boolean;
  reopened: boolean;
  ignored: boolean;
  occurrence_count: number;
  status: string;
  last_seen_at: string;
};

function nextStatusByPolicy(existing: string): string {
  if (existing === 'resolved') return 'open';
  if (existing === 'ignored') return 'ignored';
  if (existing === 'open' || existing === 'investigating' || existing === 'backlog') return existing;
  return 'open';
}

export async function upsertOpsEventByFingerprint(
  client: SupabaseClient,
  input: UpsertOpsEventByFingerprintInput,
): Promise<UpsertOpsEventByFingerprintResult> {
  const status = input.status ?? 'open';
  const rpcParams = {
    p_user_key: input.user_key ?? null,
    p_domain: input.domain,
    p_event_type: input.event_type,
    p_severity: input.severity,
    p_code: input.code ?? null,
    p_message: input.message,
    p_detail: (input.detail ?? null) as Record<string, unknown> | null,
    p_fingerprint: input.fingerprint,
    p_status: status,
    p_route: input.route ?? null,
    p_component: input.component ?? null,
    p_action_hint: input.action_hint ?? null,
  };

  try {
    const { data, error } = await client.rpc('upsert_web_ops_event_by_fingerprint', rpcParams);
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as RpcUpsertRow | null;
    if (row && row.id) {
      return {
        ok: true,
        via: 'rpc',
        inserted: Boolean(row.inserted),
        updated: Boolean(row.updated),
        reopened: Boolean(row.reopened),
        ignored: Boolean(row.ignored),
        occurrence_count: Number(row.occurrence_count ?? 1),
        status: String(row.status ?? status),
        id: row.id,
      };
    }
  } catch (e: unknown) {
    // fall through to app-level fallback
    const warning = e instanceof Error ? e.message : 'rpc_failed';
    const fallback = await upsertOpsEventByFingerprintFallback(client, input);
    return { ...fallback, warning: warning.slice(0, 240) };
  }

  return upsertOpsEventByFingerprintFallback(client, input);
}

async function upsertOpsEventByFingerprintFallback(
  client: SupabaseClient,
  input: UpsertOpsEventByFingerprintInput,
): Promise<UpsertOpsEventByFingerprintResult> {
  const nowIso = new Date().toISOString();
  const { data: row, error: selErr } = await client
    .from('web_ops_events')
    .select('id,status,occurrence_count')
    .eq('fingerprint', input.fingerprint)
    .maybeSingle();
  if (selErr) throw selErr;

  if (!row) {
    const inserted = await insertOpsEvent(client, {
      user_key: input.user_key ?? null,
      event_type: input.event_type,
      severity: input.severity,
      domain: input.domain,
      route: input.route ?? null,
      component: input.component ?? null,
      message: input.message,
      code: input.code ?? null,
      status: input.status ?? 'open',
      action_hint: input.action_hint ?? null,
      detail: input.detail ?? null,
      fingerprint: input.fingerprint,
    });
    return {
      ok: true,
      via: 'fallback',
      inserted: true,
      updated: false,
      reopened: false,
      ignored: false,
      occurrence_count: 1,
      status: input.status ?? 'open',
      id: inserted?.id,
    };
  }

  const existing = row as { id: string; status: string; occurrence_count: number };
  const nextStatus = nextStatusByPolicy(existing.status);
  const nextOccurrence = (existing.occurrence_count ?? 1) + 1;
  const { error: upErr } = await client
    .from('web_ops_events')
    .update({
      occurrence_count: nextOccurrence,
      last_seen_at: nowIso,
      updated_at: nowIso,
      domain: input.domain,
      event_type: input.event_type,
      severity: input.severity,
      code: input.code ?? null,
      message: input.message,
      detail: input.detail ?? null,
      route: input.route ?? null,
      component: input.component ?? null,
      action_hint: input.action_hint ?? null,
      status: nextStatus,
      resolved_at: existing.status === 'resolved' && nextStatus === 'open' ? null : undefined,
    })
    .eq('id', existing.id);
  if (upErr) throw upErr;

  return {
    ok: true,
    via: 'fallback',
    inserted: false,
    updated: true,
    reopened: existing.status === 'resolved' && nextStatus === 'open',
    ignored: nextStatus === 'ignored',
    occurrence_count: nextOccurrence,
    status: nextStatus,
    id: existing.id,
  };
}

export async function listOpsEvents(
  client: SupabaseClient,
  userKey: OfficeUserKey | null,
  filters: OpsEventListFilters = {},
): Promise<WebOpsEventRow[]> {
  const limit = filters.limit != null && Number.isFinite(filters.limit) ? Math.min(200, Math.max(1, filters.limit)) : 50;
  const offset = filters.offset != null && Number.isFinite(filters.offset) ? Math.max(0, filters.offset) : 0;
  let q = client.from('web_ops_events').select('*').order('last_seen_at', { ascending: false }).range(offset, offset + limit - 1);
  if (userKey != null) {
    q = q.eq('user_key', userKey as string);
  }
  if (filters.status?.trim()) q = q.eq('status', filters.status.trim());
  if (filters.severity?.trim()) q = q.eq('severity', filters.severity.trim());
  if (filters.domain?.trim()) q = q.eq('domain', filters.domain.trim());
  if (filters.eventType?.trim()) q = q.eq('event_type', filters.eventType.trim());
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim().replace(/%/g, '\\%')}%`;
    q = q.ilike('message', term);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WebOpsEventRow[];
}

export async function countOpsEventsOpenError(
  client: SupabaseClient,
  userKey: OfficeUserKey,
): Promise<number> {
  const { count, error } = await client
    .from('web_ops_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_key', userKey as string)
    .eq('status', 'open')
    .in('severity', ['error', 'critical']);
  if (error) throw error;
  return count ?? 0;
}

export async function getOpsEventById(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  id: string,
): Promise<WebOpsEventRow | null> {
  const { data, error } = await client
    .from('web_ops_events')
    .select('*')
    .eq('user_key', userKey as string)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as WebOpsEventRow) ?? null;
}

export type OpsEventPatch = Partial<{
  status: OpsEventStatus;
  resolution_note: string | null;
  action_hint: string | null;
  severity: OpsSeverity;
  resolved_at: string | null;
}>;

export async function updateOpsEvent(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  id: string,
  patch: OpsEventPatch,
): Promise<void> {
  const body: Record<string, unknown> = { ...patch };
  const st = patch.status;
  if (st === 'resolved') {
    body.resolved_at = patch.resolved_at ?? new Date().toISOString();
  } else if (st !== undefined) {
    body.resolved_at = null;
  }
  const { error } = await client.from('web_ops_events').update(body).eq('user_key', userKey as string).eq('id', id);
  if (error) throw error;
}

export async function deleteOpsEvent(client: SupabaseClient, userKey: OfficeUserKey, id: string): Promise<void> {
  const { error } = await client.from('web_ops_events').delete().eq('user_key', userKey as string).eq('id', id);
  if (error) throw error;
}
