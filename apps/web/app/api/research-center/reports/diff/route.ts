import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { fetchResearchReportDiff } from '@/lib/server/researchReportHistoryStore';

/** GET /api/research-center/reports/diff — read-only, DB write 없음 */
export async function GET(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const url = new URL(req.url);
  const symbol = url.searchParams.get('symbol')?.trim() ?? '';
  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required.' }, { status: 400 });
  }

  const previousId = url.searchParams.get('previousId')?.trim() || undefined;
  const currentId = url.searchParams.get('currentId')?.trim() || undefined;

  const { diff, tableMissing } = await fetchResearchReportDiff({
    supabase,
    userKey: auth.userKey as string,
    symbol,
    previousId,
    currentId,
  });

  return NextResponse.json({
    ok: true,
    readOnly: true,
    reportDiff: diff,
    tableMissing: tableMissing || undefined,
  });
}
