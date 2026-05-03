import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { buildSectorWatchlistCandidateResponse } from '@/lib/server/sectorRadarWatchlistCandidatesService';
import type { SectorWatchlistCandidateResponse } from '@/lib/sectorRadarContract';
import { toSectorRadarWarningDisplayPairs } from '@/lib/sectorRadarWarningMessages';

export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  const supabase = getServiceSupabase();
  if (!supabase) {
    const w503 = ['Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'];
    const p503 = toSectorRadarWarningDisplayPairs(w503).filter((p) => p.short);
    return NextResponse.json(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
        candidates: [],
        warnings: w503,
        displayWarnings: p503.map((p) => p.short),
        displayWarningDetails: p503.map((p) => p.detail),
      } satisfies SectorWatchlistCandidateResponse,
      { status: 503 },
    );
  }

  const body = await buildSectorWatchlistCandidateResponse(supabase, auth.userKey);
  return NextResponse.json(body);
}
