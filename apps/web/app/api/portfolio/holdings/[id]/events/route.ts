import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { listPortfolioTradeEventsForSymbol } from '@office-unify/supabase-access';

type Params = { params: Promise<{ id: string }> };

function parseHoldingId(rawId: string): { market: 'KR' | 'US'; symbol: string } | null {
  const [marketRaw, ...rest] = decodeURIComponent(rawId).split(':');
  const symbol = rest.join(':').trim().toUpperCase();
  const market = marketRaw === 'KR' || marketRaw === 'US' ? marketRaw : null;
  if (!market || !symbol) return null;
  return { market, symbol };
}

function toNumber(v: number | string | null | undefined): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(_req: Request, context: Params) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  const parsed = parseHoldingId((await context.params).id);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid id. Use market:symbol.' }, { status: 400 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }
  try {
    const rows = await listPortfolioTradeEventsForSymbol(supabase, auth.userKey, parsed.market, parsed.symbol);
    return NextResponse.json({
      ok: true,
      events: rows.map((row) => ({
        id: row.id,
        market: row.market,
        symbol: row.symbol,
        eventType: row.event_type,
        tradeDate: row.trade_date,
        quantity: toNumber(row.quantity),
        price: toNumber(row.price),
        beforeQuantity: toNumber(row.before_quantity),
        afterQuantity: toNumber(row.after_quantity),
        beforeAvgPrice: toNumber(row.before_avg_price),
        afterAvgPrice: toNumber(row.after_avg_price),
        realizedPnlKrw: toNumber(row.realized_pnl_krw),
        memo: row.memo ?? undefined,
        reason: row.reason ?? undefined,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
