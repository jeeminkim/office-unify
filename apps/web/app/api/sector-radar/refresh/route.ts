import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { listWebPortfolioWatchlistForUser } from '@office-unify/supabase-access';
import { normalizeSheetsApiError } from '@/lib/server/google-sheets-api';
import { buildMergedSectorRadarAnchors, SECTOR_RADAR_SHEET_NAME } from '@/lib/server/sectorRadarRegistry';
import { isSectorRadarSheetsConfigured, syncSectorRadarQuoteSheetRows } from '@/lib/server/sectorRadarSheetService';

export async function POST() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  if (!isSectorRadarSheetsConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Google Sheets quote provider is not configured.', refreshedCount: 0 },
      { status: 503 },
    );
  }
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).', refreshedCount: 0 },
      { status: 503 },
    );
  }
  try {
    const watchlist = await listWebPortfolioWatchlistForUser(supabase, auth.userKey);
    const merged = buildMergedSectorRadarAnchors(watchlist);
    const { refreshedCount } = await syncSectorRadarQuoteSheetRows(merged);
    return NextResponse.json({
      ok: true,
      refreshedCount,
      sheetName: SECTOR_RADAR_SHEET_NAME,
      nextRecommendedPollSeconds: 60,
      warnings: [],
      message: 'sector_radar_quotes 탭에 GOOGLEFINANCE 수식을 반영했습니다. 30~90초 후 요약/상태를 다시 확인하세요.',
    });
  } catch (e: unknown) {
    const normalized = normalizeSheetsApiError(e);
    return NextResponse.json(
      {
        ok: false,
        refreshedCount: 0,
        sheetName: SECTOR_RADAR_SHEET_NAME,
        nextRecommendedPollSeconds: 60,
        warnings: [normalized.code],
        message: normalized.message,
      },
      { status: 200 },
    );
  }
}
