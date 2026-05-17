import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { fetchSectorRadarItemsForRun } from '@/lib/server/sectorRadarSnapshotStore';

/** GET /api/sector-radar/items?runId= — read-only */
export async function GET(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const runId = new URL(req.url).searchParams.get('runId')?.trim() ?? '';
  if (!runId) {
    return NextResponse.json({ error: 'runId is required.' }, { status: 400 });
  }

  const { items, tableMissing } = await fetchSectorRadarItemsForRun({
    supabase,
    userKey: auth.userKey as string,
    runId,
    limit: 80,
  });

  if (tableMissing) {
    return NextResponse.json(
      {
        ok: false,
        items: [],
        actionHint: 'docs/sql/append_sector_radar_snapshots.sql 적용이 필요합니다.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    runId,
    items: items.map((it) => ({
      rank: it.rank,
      sectorKey: it.sector_key,
      sectorName: it.sector_name,
      symbol: it.symbol,
      name: it.name,
      market: it.market,
      score: it.score,
      confidence: it.confidence,
      dataStatus: it.data_status,
      selectedReasons: it.selected_reasons,
      riskFlags: it.risk_flags,
    })),
    readOnly: true,
  });
}
