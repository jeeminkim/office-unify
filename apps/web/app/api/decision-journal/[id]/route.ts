import { NextResponse } from 'next/server';
import {
  DECISION_JOURNAL_OUTCOMES,
  DECISION_JOURNAL_TYPES,
  deleteDecisionJournalEntry,
  getDecisionJournalEntryById,
  updateDecisionJournalEntry,
  type DecisionJournalOutcome,
  type DecisionJournalType,
} from '@office-unify/supabase-access';

type DecisionJournalDbPatch = Parameters<typeof updateDecisionJournalEntry>[3];
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';

type PatchBody = {
  reason?: string;
  expectedTrigger?: string | null;
  invalidationCondition?: string | null;
  reviewAfterDays?: number;
  reviewDueDate?: string | null;
  laterOutcome?: string;
  outcomeNote?: string | null;
  contextPrice?: number | null;
  sectorScore?: number | null;
  sectorZone?: string | null;
  portfolioWeight?: number | null;
  name?: string | null;
  decisionType?: string;
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
  const dbPatch: DecisionJournalDbPatch = {};
  if (body.reason !== undefined) dbPatch.reason = String(body.reason).trim();
  if (body.expectedTrigger !== undefined) dbPatch.expected_trigger = body.expectedTrigger?.trim() || null;
  if (body.invalidationCondition !== undefined) dbPatch.invalidation_condition = body.invalidationCondition?.trim() || null;
  if (body.reviewAfterDays !== undefined && Number.isFinite(Number(body.reviewAfterDays))) {
    dbPatch.review_after_days = Math.floor(Number(body.reviewAfterDays));
  }
  if (body.reviewDueDate !== undefined) dbPatch.review_due_date = body.reviewDueDate?.trim() || null;
  if (body.laterOutcome !== undefined) {
    const o = String(body.laterOutcome).trim() as DecisionJournalOutcome;
    if (!DECISION_JOURNAL_OUTCOMES.includes(o)) {
      return NextResponse.json({ error: 'invalid_later_outcome' }, { status: 400 });
    }
    dbPatch.later_outcome = o;
  }
  if (body.outcomeNote !== undefined) dbPatch.outcome_note = body.outcomeNote?.trim() || null;
  if (body.contextPrice !== undefined) dbPatch.context_price = body.contextPrice;
  if (body.sectorScore !== undefined) dbPatch.sector_score = body.sectorScore;
  if (body.sectorZone !== undefined) dbPatch.sector_zone = body.sectorZone?.trim() || null;
  if (body.portfolioWeight !== undefined) dbPatch.portfolio_weight = body.portfolioWeight;
  if (body.name !== undefined) dbPatch.name = body.name?.trim() || null;
  if (body.decisionType !== undefined) {
    const dt = String(body.decisionType).trim() as DecisionJournalType;
    if (!DECISION_JOURNAL_TYPES.includes(dt)) return NextResponse.json({ error: 'invalid_decision_type' }, { status: 400 });
    dbPatch.decision_type = dt;
  }
  if (Object.keys(dbPatch).length === 0) {
    return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  }
  try {
    const existing = await getDecisionJournalEntryById(supabase, auth.userKey, id);
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await updateDecisionJournalEntry(supabase, auth.userKey, id, dbPatch);
    const next = await getDecisionJournalEntryById(supabase, auth.userKey, id);
    return NextResponse.json({ ok: true, entry: next });
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
    const existing = await getDecisionJournalEntryById(supabase, auth.userKey, id);
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    await deleteDecisionJournalEntry(supabase, auth.userKey, id);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'delete_failed' }, { status: 500 });
  }
}
