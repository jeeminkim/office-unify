import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import {
  listWebPortfolioHoldingsForUser,
  listWebPortfolioWatchlistForUser,
  patchPortfolioHoldingTickers,
  patchPortfolioWatchlistTickers,
} from '@office-unify/supabase-access';

type ApplyBody = {
  targetType: 'holding' | 'watchlist';
  market: string;
  symbol: string;
  googleTicker: string;
  quoteSymbol?: string;
};

function normSym(market: string, symbol: string): string {
  return market === 'KR' ? symbol.trim().toUpperCase().padStart(6, '0') : symbol.trim().toUpperCase();
}

export async function POST(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const market = body.market === 'US' || body.market === 'KR' ? body.market : null;
  const googleTicker = body.googleTicker?.trim();
  if (!market || !googleTicker) {
    return NextResponse.json({ error: 'market, symbol, googleTicker are required.' }, { status: 400 });
  }
  const symbolKey = normSym(market, body.symbol ?? '');
  if (!symbolKey) {
    return NextResponse.json({ error: 'symbol is required.' }, { status: 400 });
  }

  const quoteSymbol = body.quoteSymbol?.trim() || null;

  try {
    if (body.targetType === 'holding') {
      const holdings = await listWebPortfolioHoldingsForUser(supabase, auth.userKey);
      const row = holdings.find((h) => h.market === market && normSym(h.market, h.symbol) === symbolKey);
      if (!row) {
        return NextResponse.json({ error: 'Holding not found.' }, { status: 404 });
      }
      await patchPortfolioHoldingTickers(supabase, auth.userKey, market, row.symbol, {
        google_ticker: googleTicker,
        quote_symbol: quoteSymbol,
      });
    } else if (body.targetType === 'watchlist') {
      const list = await listWebPortfolioWatchlistForUser(supabase, auth.userKey);
      const row = list.find((w) => w.market === market && normSym(w.market, w.symbol) === symbolKey);
      if (!row) {
        return NextResponse.json({ error: 'Watchlist row not found.' }, { status: 404 });
      }
      await patchPortfolioWatchlistTickers(supabase, auth.userKey, market, row.symbol, {
        google_ticker: googleTicker,
        quote_symbol: quoteSymbol,
      });
    } else {
      return NextResponse.json({ error: 'targetType must be holding or watchlist.' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      updated: true,
      message: 'ticker override를 저장했습니다. 시세 새로고침을 실행하세요.',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
