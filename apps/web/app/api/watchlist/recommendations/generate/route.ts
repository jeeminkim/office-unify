import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { generateWatchlistRecommendationCandidates } from '@/lib/server/watchlistRecommendationService';

/** POST /api/watchlist/recommendations/generate — 규칙 기반 후보 생성·저장(pending) */
export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  let requestId: string | undefined;
  try {
    const body = (await req.json()) as { requestId?: string; limit?: number };
    requestId = body.requestId;
    const { candidates, qualityMeta } = await generateWatchlistRecommendationCandidates({
      supabase,
      userKey: auth.userKey as string,
      requestId,
      limit: body.limit,
    });
    return NextResponse.json({ ok: true, candidates, qualityMeta: { recommendationCandidates: qualityMeta } });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
