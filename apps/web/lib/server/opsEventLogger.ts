import 'server-only';

import {
  bumpOpsEventByFingerprint,
  insertOpsEvent,
  type OpsEventInsertRow,
  type OpsEventType,
  type OpsSeverity,
} from '@office-unify/supabase-access';
import { getServiceSupabase } from '@/lib/server/supabase-service';

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

export type LogOpsEventInput = {
  userKey?: string | null;
  eventType: OpsEventType;
  severity?: OpsSeverity;
  domain: string;
  route?: string;
  component?: string;
  message: string;
  code?: string;
  actionHint?: string;
  detail?: Record<string, unknown>;
  fingerprint?: string;
  /** fingerprint 기본값에 포함 (선택) */
  symbol?: string | null;
  status?: OpsEventInsertRow['status'];
};

function isSensitiveKeyName(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((frag) => lower.includes(frag));
}

export function sanitizeOpsDetail(d: unknown): unknown {
  if (d == null) return d;
  if (Array.isArray(d)) return d.map((x) => sanitizeOpsDetail(x));
  if (typeof d !== 'object') return d;
  const o = d as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (isSensitiveKeyName(k)) {
      out[k] = '[redacted]';
    } else {
      out[k] = sanitizeOpsDetail(v) as unknown;
    }
  }
  return out;
}

function defaultFingerprint(input: LogOpsEventInput): string | undefined {
  if (input.fingerprint) return input.fingerprint.slice(0, 500);
  const code = input.code ?? '';
  const route = input.route ?? '';
  const sym = input.symbol ?? '';
  if (!code && !route && !sym) return undefined;
  const uk = input.userKey != null && String(input.userKey).trim() !== '' ? String(input.userKey) : '_';
  return `${uk}:${input.domain}:${code}:${route}:${sym}`.slice(0, 500);
}

function isUniqueFingerprintViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code === '23505';
}

/**
 * 운영 관측 로그. 실패해도 throw 하지 않으며, 원 API 응답에는 영향 없음.
 */
export async function logOpsEvent(input: LogOpsEventInput): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    if (!supabase) return;

    const severity: OpsSeverity = input.severity ?? (input.eventType === 'error' ? 'error' : 'info');
    const detail = input.detail != null ? (sanitizeOpsDetail(input.detail) as Record<string, unknown>) : null;
    const fingerprint = defaultFingerprint(input) ?? undefined;

    const row: OpsEventInsertRow = {
      user_key: input.userKey ?? null,
      event_type: input.eventType,
      severity,
      domain: input.domain,
      route: input.route ?? null,
      component: input.component ?? null,
      message: input.message.slice(0, 8000),
      code: input.code?.slice(0, 500) ?? null,
      status: input.status ?? 'open',
      action_hint: input.actionHint?.slice(0, 4000) ?? null,
      detail,
      fingerprint: fingerprint ?? null,
    };

    if (fingerprint) {
      const bumped = await bumpOpsEventByFingerprint(supabase, fingerprint);
      if (bumped) return;
    }

    try {
      await insertOpsEvent(supabase, row);
    } catch (e: unknown) {
      if (fingerprint && isUniqueFingerprintViolation(e)) {
        await bumpOpsEventByFingerprint(supabase, fingerprint);
        return;
      }
      throw e;
    }
  } catch (e: unknown) {
    console.warn('[logOpsEvent] failed', e instanceof Error ? e.message : e);
  }
}
