import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { approveWatchlistRecommendation } from '@/lib/server/watchlistRecommendationService';

/** POST /api/watchlist/recommendations/approve — 승인 시에만 관심종목 write */
export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  let body: { recommendationId?: string; symbol?: string; market?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const result = await approveWatchlistRecommendation({
    supabase,
    userKey: auth.userKey as string,
    recommendationId: body.recommendationId,
    symbol: body.symbol,
    market: body.market,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, actionHint: result.actionHint }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    alreadyExists: result.alreadyExists ?? false,
    actionHint: result.actionHint,
  });
}
