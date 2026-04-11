import { NextResponse } from 'next/server';
import type { PortfolioLedgerApplyResponseBody } from '@office-unify/shared-types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { applyLedgerOperations } from '@/lib/server/apply-ledger-operations';
import { validateLedgerSql } from '@/lib/server/ledger-sql-validator';
import { getServiceSupabase } from '@/lib/server/supabase-service';

/**
 * POST /api/portfolio/ledger/apply
 * 검증 후 원장 반영(INSERT upsert / DELETE). 세션 사용자 키로만 기록.
 */
export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const sql = typeof (body as { sql?: unknown })?.sql === 'string' ? (body as { sql: string }).sql : '';
  const validated = validateLedgerSql(sql);
  if (!validated.ok || validated.errors.length > 0) {
    const resBody: PortfolioLedgerApplyResponseBody = {
      ok: false,
      applied: 0,
      errors: validated.errors.length ? validated.errors : ['SQL 검증에 실패했습니다.'],
    };
    return NextResponse.json(resBody, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, applied: 0, errors: ['Supabase가 설정되지 않았습니다.'] },
      { status: 503 },
    );
  }

  try {
    const applied = await applyLedgerOperations(supabase, auth.userKey, validated.operations);
    const resBody: PortfolioLedgerApplyResponseBody = { ok: true, applied };
    return NextResponse.json(resBody);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const isMissing =
      msg.includes('web_portfolio_holdings') ||
      msg.includes('web_portfolio_watchlist') ||
      msg.includes('does not exist');
    const hint = isMissing
      ? `${msg} — Supabase에 docs/sql/append_web_portfolio_ledger.sql 을 적용했는지 확인하세요.`
      : msg;
    const resBody: PortfolioLedgerApplyResponseBody = { ok: false, applied: 0, errors: [hint] };
    return NextResponse.json(resBody, { status: 500 });
  }
}
