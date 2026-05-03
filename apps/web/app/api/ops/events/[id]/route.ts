import { NextResponse } from 'next/server';
import {
  deleteOpsEvent,
  getOpsEventById,
  OPS_SEVERITIES,
  OPS_STATUSES,
  updateOpsEvent,
  type OpsEventStatus,
  type OpsSeverity,
} from '@office-unify/supabase-access';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';

type PatchBody = {
  status?: string;
  resolutionNote?: string | null;
  actionHint?: string | null;
  severity?: string;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json_body' }, { status: 400 });
  }

  const patch: Parameters<typeof updateOpsEvent>[3] = {};
  if (body.status !== undefined) {
    const s = String(body.status).trim() as OpsEventStatus;
    if (!OPS_STATUSES.includes(s)) return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
    patch.status = s;
  }
  if (body.resolutionNote !== undefined) patch.resolution_note = body.resolutionNote?.trim() || null;
  if (body.actionHint !== undefined) patch.action_hint = body.actionHint?.trim() || null;
  if (body.severity !== undefined) {
    const sev = String(body.severity).trim() as OpsSeverity;
    if (!OPS_SEVERITIES.includes(sev)) return NextResponse.json({ error: 'invalid_severity' }, { status: 400 });
    patch.severity = sev;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }

  try {
    const existing = await getOpsEventById(supabase, auth.userKey, id);
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await updateOpsEvent(supabase, auth.userKey, id, patch);
    const next = await getOpsEventById(supabase, auth.userKey, id);
    return NextResponse.json({ ok: true, item: next });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  try {
    const existing = await getOpsEventById(supabase, auth.userKey, id);
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await deleteOpsEvent(supabase, auth.userKey, id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'delete_failed' }, { status: 500 });
  }
}
