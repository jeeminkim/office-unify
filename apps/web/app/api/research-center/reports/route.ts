import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import {
  buildResearchReportHistoryMeta,
  findLatestResearchReport,
  shouldReuseResearchReport,
} from '@/lib/server/researchReportHistoryStore';

/** GET /api/research-center/reports?symbol=&market= — read-only, DB write 없음 */
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

  const { row, tableMissing } = await findLatestResearchReport({
    supabase,
    userKey: auth.userKey as string,
    symbol,
  });
  const reuseDecision = shouldReuseResearchReport({ latest: row, forceRefresh: false });
  const reportHistory = buildResearchReportHistoryMeta(row, reuseDecision, tableMissing);

  return NextResponse.json({
    ok: true,
    readOnly: true,
    latestReport: row
      ? {
          id: row.id,
          symbol: row.symbol,
          name: row.name,
          market: row.market,
          reportDate: row.report_date,
          generatedAt: row.generated_at,
          reportSummary: row.report_summary,
          reportBodyPreview: row.report_body?.slice(0, 2000),
        }
      : null,
    reportHistory,
  });
}
