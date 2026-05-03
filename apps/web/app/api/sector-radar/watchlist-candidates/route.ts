import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { buildSectorWatchlistCandidateResponse } from '@/lib/server/sectorRadarWatchlistCandidatesService';
import type { SectorWatchlistCandidateResponse } from '@/lib/sectorRadarContract';

export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
        candidates: [],
        warnings: ['Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'],
      } satisfies SectorWatchlistCandidateResponse,
      { status: 503 },
    );
  }

  const body = await buildSectorWatchlistCandidateResponse(supabase, auth.userKey);
  return NextResponse.json(body);
}
