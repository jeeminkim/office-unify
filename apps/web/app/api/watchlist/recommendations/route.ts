import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { listPendingRecommendations } from '@/lib/server/watchlistRecommendationService';

/** GET /api/watchlist/recommendations — pending 관심 등록 후보, read-only */
export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const candidates = await listPendingRecommendations({ supabase, userKey: auth.userKey as string });
  return NextResponse.json({
    ok: true,
    readOnly: true,
    candidates,
    qualityMeta: {
      recommendationCandidates: {
        status: candidates.length > 0 ? 'ok' : 'empty',
        generatedCount: candidates.length,
        pendingApprovalCount: candidates.length,
        sourceMix: {},
      },
    },
  });
}
