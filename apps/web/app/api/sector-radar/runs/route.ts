import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';

/** GET /api/sector-radar/runs — read-only 최근 스냅샷 run 목록 */
export async function GET(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const url = new URL(req.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') ?? '10') || 10));

  try {
    const { data: runs, error } = await supabase
      .from('sector_radar_runs')
      .select('id,run_date,generated_at,status,degraded,summary,reason_code')
      .eq('user_key', auth.userKey as string)
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (error) {
      const missing = error.message.includes('sector_radar_runs') || error.message.includes('does not exist');
      return NextResponse.json(
        {
          ok: false,
          runs: [],
          actionHint: missing ? 'docs/sql/append_sector_radar_snapshots.sql 적용이 필요합니다.' : error.message,
        },
        { status: missing ? 503 : 500 },
      );
    }

    const withCounts = await Promise.all(
      (runs ?? []).map(async (r) => {
        const row = r as { id: string; run_date: string; generated_at: string; status: string; degraded: boolean; summary: string | null };
        const { count } = await supabase
          .from('sector_radar_items')
          .select('id', { count: 'exact', head: true })
          .eq('run_id', row.id);
        return { ...row, itemCount: count ?? 0 };
      }),
    );

    return NextResponse.json({ ok: true, runs: withCounts, readOnly: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
