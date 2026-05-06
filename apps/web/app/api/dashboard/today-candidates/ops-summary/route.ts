import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { upsertOpsEventByFingerprint } from '@/lib/server/upsertOpsEventByFingerprint';
import { summarizeTodayCandidateOps } from '@/lib/server/todayCandidatesOpsSummary';
import type { WebOpsEventRow } from '@office-unify/supabase-access';

export async function GET(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: false, warnings: ['supabase_unconfigured'] }, { status: 503 });
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days') ?? 7) || 7));
  try {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('web_ops_events')
      .select('*')
      .eq('domain', 'today_candidates')
      .eq('user_key', auth.userKey as string)
      .gte('last_seen_at', from)
      .order('last_seen_at', { ascending: false })
      .limit(300);
    if (error) throw error;
    return NextResponse.json(summarizeTodayCandidateOps((data ?? []) as WebOpsEventRow[], days));
  } catch (e: unknown) {
    const ymd = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    await upsertOpsEventByFingerprint({
      userKey: String(auth.userKey),
      domain: 'today_candidates',
      eventType: 'warning',
      severity: 'warning',
      code: 'today_candidates_ops_summary_unavailable',
      message: 'today candidates ops summary unavailable',
      detail: { reason: e instanceof Error ? e.message : 'unknown' },
      fingerprint: `today_candidates:${auth.userKey}:${ymd}:ops_summary_unavailable`,
      route: '/api/dashboard/today-candidates/ops-summary',
      component: 'today-candidates-ops-summary',
      status: 'open',
    });
    return NextResponse.json({ ok: false, warnings: ['ops_summary_unavailable'] }, { status: 200 });
  }
}
