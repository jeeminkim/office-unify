import { NextResponse } from 'next/server';
import {
  DECISION_JOURNAL_TYPES,
  insertDecisionJournalEntry,
  listDecisionJournalEntries,
  type DecisionJournalType,
} from '@office-unify/supabase-access';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { logOpsEvent } from '@/lib/server/opsEventLogger';

function parseLimit(raw: string | null): number {
  const n = Number(raw ?? '50');
  return Number.isFinite(n) ? Math.min(200, Math.max(1, Math.floor(n))) : 50;
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
  const dueOnly = url.searchParams.get('dueOnly') === '1' || url.searchParams.get('dueOnly') === 'true';
  try {
    const items = await listDecisionJournalEntries(supabase, auth.userKey, {
      symbol: url.searchParams.get('symbol') ?? undefined,
      market: url.searchParams.get('market') ?? undefined,
      decisionType: url.searchParams.get('decisionType') ?? undefined,
      outcome: url.searchParams.get('outcome') ?? undefined,
      dueOnly,
      limit: parseLimit(url.searchParams.get('limit')),
    });
    return NextResponse.json({ ok: true, items });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'list_failed' }, { status: 500 });
  }
}

type PostBody = {
  market?: string;
  symbol?: string;
  name?: string;
  decisionType?: string;
  reason?: string;
  expectedTrigger?: string;
  invalidationCondition?: string;
  reviewAfterDays?: number;
  decisionDate?: string;
  contextPrice?: number;
  sectorScore?: number;
  sectorZone?: string;
  portfolioWeight?: number;
  linkedTradeJournalId?: string;
  linkedHoldingKey?: string;
};

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
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json_body' }, { status: 400 });
  }
  const dt = String(body.decisionType ?? '').trim() as DecisionJournalType;
  if (!DECISION_JOURNAL_TYPES.includes(dt)) {
    return NextResponse.json({ error: 'invalid_decision_type' }, { status: 400 });
  }
  const reason = String(body.reason ?? '').trim();
  if (!reason) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 });
  }
  try {
    const row = await insertDecisionJournalEntry(supabase, auth.userKey, {
      market: body.market?.trim() || null,
      symbol: body.symbol?.trim() || null,
      name: body.name?.trim() || null,
      decisionType: dt,
      decisionDate: body.decisionDate?.trim(),
      contextPrice: body.contextPrice,
      sectorScore: body.sectorScore,
      sectorZone: body.sectorZone?.trim(),
      portfolioWeight: body.portfolioWeight,
      reason,
      expectedTrigger: body.expectedTrigger?.trim() || null,
      invalidationCondition: body.invalidationCondition?.trim() || null,
      reviewAfterDays: body.reviewAfterDays,
      linkedTradeJournalId: body.linkedTradeJournalId?.trim() || null,
      linkedHoldingKey: body.linkedHoldingKey?.trim() || null,
    });
    return NextResponse.json({ ok: true, entry: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'insert_failed';
    if (msg.includes('does not exist') || msg.includes('schema cache')) {
      void logOpsEvent({
        userKey: auth.userKey,
        eventType: 'warning',
        severity: 'warn',
        domain: 'decision_journal',
        route: '/api/decision-journal',
        message: 'Decision journal table missing or schema cache',
        code: 'decision_journal_table_missing',
        actionHint: 'docs/sql/append_web_decision_journal.sql 적용',
      });
      return NextResponse.json(
        { error: 'decision_journal_table_missing', detail: 'docs/sql/append_web_decision_journal.sql 적용 필요' },
        { status: 503 },
      );
    }
    void logOpsEvent({
      userKey: auth.userKey,
      eventType: 'error',
      severity: 'error',
      domain: 'decision_journal',
      route: '/api/decision-journal',
      message: msg,
      code: 'decision_journal_insert_failed',
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
