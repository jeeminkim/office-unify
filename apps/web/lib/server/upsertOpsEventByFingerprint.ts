import type { OpsEventStatus } from '@office-unify/supabase-access';
import { upsertOpsEventByFingerprint as upsertOpsEventByFingerprintRepo } from '@office-unify/supabase-access';
import { getServiceSupabase } from './supabase-service';

export interface UpsertOpsEventByFingerprintInput {
  userKey: string;
  domain: string;
  eventType: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  detail?: Record<string, unknown>;
  fingerprint: string;
  status?: 'open' | 'investigating' | 'resolved' | 'ignored' | 'backlog';
  route?: string;
  component?: string;
  actionHint?: string;
}

export interface UpsertOpsEventByFingerprintResult {
  ok: boolean;
  via: 'rpc' | 'fallback' | 'skipped';
  inserted?: boolean;
  updated?: boolean;
  reopened?: boolean;
  ignored?: boolean;
  occurrenceCount?: number;
  status?: string;
  warning?: string;
}

const SENSITIVE_KEY_FRAGMENTS = [
  'token',
  'secret',
  'key',
  'password',
  'authorization',
  'cookie',
  'service_role',
  'api_key',
] as const;

export function sanitizeOpsDetailForUpsert(d: unknown): unknown {
  if (d == null) return d;
  if (Array.isArray(d)) return d.map((x) => sanitizeOpsDetailForUpsert(x));
  if (typeof d !== 'object') return d;
  const o = d as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEY_FRAGMENTS.some((frag) => lower.includes(frag))) out[k] = '[redacted]';
    else out[k] = sanitizeOpsDetailForUpsert(v);
  }
  return out;
}

function mapSeverity(input: 'info' | 'warning' | 'error'): { eventType: 'info' | 'warning' | 'error'; severity: 'info' | 'warn' | 'error' } {
  if (input === 'error') return { eventType: 'error', severity: 'error' };
  if (input === 'warning') return { eventType: 'warning', severity: 'warn' };
  return { eventType: 'info', severity: 'info' };
}

export async function upsertOpsEventByFingerprint(
  input: UpsertOpsEventByFingerprintInput,
  deps?: {
    supabase?: ReturnType<typeof getServiceSupabase>;
    repoUpsert?: typeof upsertOpsEventByFingerprintRepo;
  },
): Promise<UpsertOpsEventByFingerprintResult> {
  try {
    const supabase = deps?.supabase ?? getServiceSupabase();
    if (!supabase) return { ok: false, via: 'skipped', warning: 'supabase_unconfigured' };
    const repoUpsert = deps?.repoUpsert ?? upsertOpsEventByFingerprintRepo;
    const mapped = mapSeverity(input.severity);
    const detail = sanitizeOpsDetailForUpsert(input.detail ?? null) as Record<string, unknown> | null;
    const result = await repoUpsert(supabase, {
      user_key: input.userKey ?? null,
      domain: input.domain,
      event_type: mapped.eventType,
      severity: mapped.severity,
      code: input.code,
      message: input.message.slice(0, 8000),
      detail,
      fingerprint: input.fingerprint.slice(0, 500),
      status: (input.status ?? 'open') as OpsEventStatus,
      route: input.route ?? null,
      component: input.component ?? null,
      action_hint: input.actionHint?.slice(0, 4000) ?? null,
    });
    return {
      ok: result.ok,
      via: result.via,
      inserted: result.inserted,
      updated: result.updated,
      reopened: result.reopened,
      ignored: result.ignored,
      occurrenceCount: result.occurrence_count,
      status: result.status,
      warning: result.warning,
    };
  } catch (e: unknown) {
    return { ok: false, via: 'fallback', warning: e instanceof Error ? e.message : 'ops_upsert_failed' };
  }
}
