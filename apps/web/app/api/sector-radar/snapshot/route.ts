import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { buildSectorRadarSummaryForUser } from '@/lib/server/sectorRadarSummaryService';
import { saveSectorRadarSnapshot } from '@/lib/server/sectorRadarSnapshotStore';

/**
 * POST /api/sector-radar/snapshot
 * 요약 생성 후 DB 스냅샷 저장(명시적 write). GET summary read-only와 분리.
 */
export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  let requestId: string | undefined;
  try {
    const body = (await req.json()) as { requestId?: string };
    requestId = typeof body.requestId === 'string' ? body.requestId : undefined;
  } catch {
    requestId = undefined;
  }

  try {
    const summary = await buildSectorRadarSummaryForUser(supabase, auth.userKey, {
      isReadOnlyRoute: false,
      isExplicitRefresh: true,
    });
    const snap = await saveSectorRadarSnapshot({
      supabase,
      userKey: auth.userKey as string,
      summary,
      requestId,
    });

    return NextResponse.json({
      ok: true,
      summary,
      sectorRadarSnapshot: snap,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
