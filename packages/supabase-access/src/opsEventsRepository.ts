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
