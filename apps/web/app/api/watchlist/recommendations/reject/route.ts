import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { rejectWatchlistRecommendation } from '@/lib/server/watchlistRecommendationService';

export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  let body: { recommendationId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const id = body.recommendationId?.trim();
  if (!id) {
    return NextResponse.json({ error: 'recommendationId is required.' }, { status: 400 });
  }

  const result = await rejectWatchlistRecommendation({
    supabase,
    userKey: auth.userKey as string,
    recommendationId: id,
  });

  return NextResponse.json({ ok: result.ok });
}
