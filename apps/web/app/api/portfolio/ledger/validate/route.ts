import { NextResponse } from 'next/server';
import type { PortfolioLedgerValidateResponseBody } from '@office-unify/shared-types';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { validateLedgerSql } from '@/lib/server/ledger-sql-validator';

/**
 * POST /api/portfolio/ledger/validate
 * 원장 SQL 정합성 검사(실행 없음). 세션+허용 이메일 필요.
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
  const result = validateLedgerSql(sql);
  const resBody: PortfolioLedgerValidateResponseBody = result;
  return NextResponse.json(resBody);
}
