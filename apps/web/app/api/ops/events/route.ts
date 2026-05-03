import { NextResponse } from 'next/server';
import {
  insertOpsEvent,
  listOpsEvents,
  OPS_EVENT_TYPES,
  OPS_SEVERITIES,
  type OpsEventType,
  type OpsSeverity,
} from '@office-unify/supabase-access';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { sanitizeOpsDetail } from '@/lib/server/opsEventLogger';

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? '50');
  return Number.isFinite(n) ? Math.min(200, Math.max(1, Math.floor(n))) : 50;
}

function parseOffset(raw: string | null): number {
  const n = Number(raw ?? '0');
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function rowToApi(r: {
  id: string;
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
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
}) {
  return {
    id: r.id,
    eventType: r.event_type,
    severity: r.severity,
    domain: r.domain,
    route: r.route ?? undefined,
    component: r.component ?? undefined,
    message: r.message,
    code: r.code ?? undefined,
    status: r.status,
    actionHint: r.action_hint ?? undefined,
    detail: r.detail ?? undefined,
    occurrenceCount: r.occurrence_count,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    resolvedAt: r.resolved_at ?? undefined,
    resolutionNote: r.resolution_note ?? undefined,
  };
}

export async function GET(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  try {
    const items = await listOpsEvents(supabase, auth.userKey, {
      status: url.searchParams.get('status') ?? undefined,
      severity: url.searchParams.get('severity') ?? undefined,
      domain: url.searchParams.get('domain') ?? undefined,
      eventType: url.searchParams.get('eventType') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
      limit: parseLimit(url.searchParams.get('limit')),
      offset: parseOffset(url.searchParams.get('offset')),
    });
    return NextResponse.json({ ok: true, items: items.map(rowToApi) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'list_failed';
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return NextResponse.json({ ok: true, items: [], note: 'ops_events_table_missing' });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const POST_EVENT_TYPES = new Set(['improvement', 'user_feedback', 'error', 'warning']);

export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json_body' }, { status: 400 });
  }
  const eventType = String(body.eventType ?? '').trim() as OpsEventType;
  if (!POST_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: 'invalid_event_type' }, { status: 400 });
  }
  if (!OPS_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json({ error: 'invalid_event_type' }, { status: 400 });
  }
  const domain = String(body.domain ?? '').trim();
  if (!domain) return NextResponse.json({ error: 'domain_required' }, { status: 400 });
  const message = String(body.message ?? '').trim();
  if (!message) return NextResponse.json({ error: 'message_required' }, { status: 400 });

  const sevRaw = String(body.severity ?? 'info').trim() as OpsSeverity;
  const severity: OpsSeverity = OPS_SEVERITIES.includes(sevRaw) ? sevRaw : 'info';

  const detailRaw = body.detail;
  const detail =
    detailRaw != null && typeof detailRaw === 'object' && !Array.isArray(detailRaw)
      ? (sanitizeOpsDetail(detailRaw) as Record<string, unknown>)
      : null;

  const status =
    eventType === 'improvement' || eventType === 'user_feedback' ? 'backlog' : 'open';

  try {
    const row = await insertOpsEvent(supabase, {
      user_key: auth.userKey,
      event_type: eventType,
      severity,
      domain,
      route: typeof body.route === 'string' ? body.route : null,
      component: typeof body.component === 'string' ? body.component : null,
      message,
      code: typeof body.code === 'string' ? body.code : null,
      status,
      action_hint: typeof body.actionHint === 'string' ? body.actionHint : null,
      detail,
      fingerprint: null,
    });
    return NextResponse.json({ ok: true, id: row?.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'insert_failed';
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      return NextResponse.json(
        { error: 'ops_events_table_missing', detail: 'docs/sql/append_web_ops_events.sql 적용 필요' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
