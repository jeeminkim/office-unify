import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { listWebPortfolioHoldingsForUser } from '@office-unify/supabase-access';
import {
  isGoogleFinanceQuoteConfigured,
  syncGoogleFinanceQuoteSheetRows,
} from '@/lib/server/googleFinanceSheetQuoteService';

export async function POST() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  if (!isGoogleFinanceQuoteConfigured()) {
    return NextResponse.json(
      { error: 'Google Sheets quote provider is not configured.' },
      { status: 503 },
    );
  }
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }
  try {
    const holdings = await listWebPortfolioHoldingsForUser(supabase, auth.userKey);
    await syncGoogleFinanceQuoteSheetRows(
      holdings.map((holding) => ({
        market: holding.market,
        symbol: holding.symbol,
        displayName: holding.name,
      })),
    );
    return NextResponse.json({
      ok: true,
      refreshRequested: true,
      message: 'Google Sheets 계산 반영 후 잠시 뒤 다시 조회하세요.',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

