import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import {
  listWebPortfolioHoldingsForUser,
  listWebPortfolioWatchlistForUser,
} from '@office-unify/supabase-access';
import { buildTickerSuggestionFromInput, type TickerSuggestResponse } from '@/lib/server/tickerSuggestFromInput';

export async function GET(req: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const marketRaw = (searchParams.get('market') ?? '').trim().toUpperCase();
  const market = marketRaw === 'KR' || marketRaw === 'US' ? marketRaw : null;
  if (!market) {
    return NextResponse.json({ ok: false, error: 'market must be KR or US.' } satisfies TickerSuggestResponse, {
      status: 400,
    });
  }

  const symbol = searchParams.get('symbol') ?? '';
  const name = searchParams.get('name') ?? '';

  try {
    const [holdings, watchlist] = await Promise.all([
      listWebPortfolioHoldingsForUser(supabase, auth.userKey),
      listWebPortfolioWatchlistForUser(supabase, auth.userKey),
    ]);

    const body = buildTickerSuggestionFromInput({
      market,
      symbol,
      name,
      holdings: holdings.map((h) => ({
        market: h.market,
        symbol: h.symbol,
        name: h.name,
        sector: h.sector,
      })),
      watchlist: watchlist.map((w) => ({
        market: w.market,
        symbol: w.symbol,
        name: w.name,
        sector: w.sector,
      })),
    });

    if (!body.ok && body.error === 'symbol_or_name_required') {
      return NextResponse.json(body satisfies TickerSuggestResponse, { status: 400 });
    }

    return NextResponse.json(body satisfies TickerSuggestResponse);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message } satisfies TickerSuggestResponse, { status: 500 });
  }
}
