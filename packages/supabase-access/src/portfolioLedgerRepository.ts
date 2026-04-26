import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OfficeUserKey,
  PortfolioLedgerHoldingInput,
  PortfolioLedgerWatchlistInput,
} from '@office-unify/shared-types';

export type WebPortfolioHoldingRow = {
  market: string;
  symbol: string;
  name: string;
  google_ticker: string | null;
  quote_symbol: string | null;
  sector: string | null;
  investment_memo: string | null;
  qty: number | string | null;
  avg_price: number | string | null;
  target_price: number | string | null;
  judgment_memo: string | null;
  updated_at?: string | null;
};

export type WebPortfolioWatchlistRow = {
  market: string;
  symbol: string;
  name: string;
  google_ticker: string | null;
  quote_symbol: string | null;
  sector: string | null;
  investment_memo: string | null;
  interest_reason: string | null;
  desired_buy_range: string | null;
  observation_points: string | null;
  priority: string | null;
  updated_at?: string | null;
};

export type WebPortfolioTradeEventRow = {
  id: string;
  user_key: string;
  market: string;
  symbol: string;
  name: string | null;
  event_type: 'buy' | 'sell' | 'correct';
  trade_date: string;
  quantity: number | string | null;
  price: number | string | null;
  fee_krw: number | string | null;
  tax_krw: number | string | null;
  realized_pnl_krw: number | string | null;
  realized_pnl_rate: number | string | null;
  memo: string | null;
  reason: string | null;
  before_quantity: number | string | null;
  before_avg_price: number | string | null;
  after_quantity: number | string | null;
  after_avg_price: number | string | null;
  source: string | null;
  created_at: string | null;
};

export async function listWebPortfolioHoldingsForUser(
  client: SupabaseClient,
  userKey: OfficeUserKey,
): Promise<WebPortfolioHoldingRow[]> {
  const { data, error } = await client
    .from('web_portfolio_holdings')
    .select(
      'market,symbol,name,google_ticker,quote_symbol,sector,investment_memo,qty,avg_price,target_price,judgment_memo,updated_at',
    )
    .eq('user_key', userKey as string)
    .order('market', { ascending: true })
    .order('symbol', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WebPortfolioHoldingRow[];
}

export async function listWebPortfolioWatchlistForUser(
  client: SupabaseClient,
  userKey: OfficeUserKey,
): Promise<WebPortfolioWatchlistRow[]> {
  const { data, error } = await client
    .from('web_portfolio_watchlist')
    .select(
      'market,symbol,name,google_ticker,quote_symbol,sector,investment_memo,interest_reason,desired_buy_range,observation_points,priority,updated_at',
    )
    .eq('user_key', userKey as string)
    .order('market', { ascending: true })
    .order('symbol', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WebPortfolioWatchlistRow[];
}

export async function upsertPortfolioHolding(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  row: PortfolioLedgerHoldingInput,
): Promise<void> {
  const pk = userKey as string;
  const payload: Record<string, unknown> = {
    user_key: pk,
    market: row.market,
    symbol: row.symbol.trim(),
    name: row.name.trim(),
    sector: row.sector ?? null,
    investment_memo: row.investment_memo ?? null,
    qty: row.qty ?? null,
    avg_price: row.avg_price ?? null,
    target_price: row.target_price ?? null,
    judgment_memo: row.judgment_memo ?? null,
    updated_at: new Date().toISOString(),
  };
  if (row.google_ticker !== undefined) {
    payload.google_ticker = row.google_ticker?.trim() || null;
  }
  if (row.quote_symbol !== undefined) {
    payload.quote_symbol = row.quote_symbol?.trim() || null;
  }
  const { error } = await client.from('web_portfolio_holdings').upsert(payload, { onConflict: 'user_key,market,symbol' });
  if (error) throw error;
}

export async function upsertPortfolioWatchlist(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  row: PortfolioLedgerWatchlistInput,
): Promise<void> {
  const pk = userKey as string;
  const payload: Record<string, unknown> = {
    user_key: pk,
    market: row.market,
    symbol: row.symbol.trim(),
    name: row.name.trim(),
    sector: row.sector ?? null,
    investment_memo: row.investment_memo ?? null,
    interest_reason: row.interest_reason ?? null,
    desired_buy_range: row.desired_buy_range ?? null,
    observation_points: row.observation_points ?? null,
    priority: row.priority ?? null,
    updated_at: new Date().toISOString(),
  };
  if (row.google_ticker !== undefined) {
    payload.google_ticker = row.google_ticker?.trim() || null;
  }
  if (row.quote_symbol !== undefined) {
    payload.quote_symbol = row.quote_symbol?.trim() || null;
  }
  const { error } = await client.from('web_portfolio_watchlist').upsert(payload, { onConflict: 'user_key,market,symbol' });
  if (error) throw error;
}

export async function deletePortfolioHolding(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  market: 'KR' | 'US',
  symbol: string,
): Promise<void> {
  const { error } = await client
    .from('web_portfolio_holdings')
    .delete()
    .eq('user_key', userKey as string)
    .eq('market', market)
    .eq('symbol', symbol.trim());
  if (error) throw error;
}

export async function deletePortfolioWatchlist(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  market: 'KR' | 'US',
  symbol: string,
): Promise<void> {
  const { error } = await client
    .from('web_portfolio_watchlist')
    .delete()
    .eq('user_key', userKey as string)
    .eq('market', market)
    .eq('symbol', symbol.trim());
  if (error) throw error;
}

export async function patchPortfolioHoldingTickers(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  market: 'KR' | 'US',
  symbol: string,
  fields: { google_ticker: string | null; quote_symbol?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = {
    google_ticker: fields.google_ticker,
    updated_at: new Date().toISOString(),
  };
  if (fields.quote_symbol !== undefined) {
    patch.quote_symbol = fields.quote_symbol;
  }
  const { error } = await client
    .from('web_portfolio_holdings')
    .update(patch)
    .eq('user_key', userKey as string)
    .eq('market', market)
    .eq('symbol', symbol.trim());
  if (error) throw error;
}

export async function patchPortfolioWatchlistTickers(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  market: 'KR' | 'US',
  symbol: string,
  fields: { google_ticker: string | null; quote_symbol?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = {
    google_ticker: fields.google_ticker,
    updated_at: new Date().toISOString(),
  };
  if (fields.quote_symbol !== undefined) {
    patch.quote_symbol = fields.quote_symbol;
  }
  const { error } = await client
    .from('web_portfolio_watchlist')
    .update(patch)
    .eq('user_key', userKey as string)
    .eq('market', market)
    .eq('symbol', symbol.trim());
  if (error) throw error;
}

export async function insertPortfolioTradeEvent(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  row: {
    market: 'KR' | 'US';
    symbol: string;
    name?: string | null;
    event_type: 'buy' | 'sell' | 'correct';
    trade_date?: string;
    quantity?: number | null;
    price?: number | null;
    fee_krw?: number | null;
    tax_krw?: number | null;
    realized_pnl_krw?: number | null;
    realized_pnl_rate?: number | null;
    memo?: string | null;
    reason?: string | null;
    before_quantity?: number | null;
    before_avg_price?: number | null;
    after_quantity?: number | null;
    after_avg_price?: number | null;
    source?: string | null;
  },
): Promise<{ id: string }> {
  const payload: Record<string, unknown> = {
    user_key: userKey as string,
    market: row.market,
    symbol: row.symbol.trim().toUpperCase(),
    name: row.name?.trim() || null,
    event_type: row.event_type,
    trade_date: row.trade_date ?? new Date().toISOString().slice(0, 10),
    quantity: row.quantity ?? null,
    price: row.price ?? null,
    fee_krw: row.fee_krw ?? 0,
    tax_krw: row.tax_krw ?? 0,
    realized_pnl_krw: row.realized_pnl_krw ?? null,
    realized_pnl_rate: row.realized_pnl_rate ?? null,
    memo: row.memo ?? null,
    reason: row.reason ?? null,
    before_quantity: row.before_quantity ?? null,
    before_avg_price: row.before_avg_price ?? null,
    after_quantity: row.after_quantity ?? null,
    after_avg_price: row.after_avg_price ?? null,
    source: row.source ?? 'portfolio_ledger',
  };
  const { data, error } = await client
    .from('web_portfolio_trade_events')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw error;
  return { id: String(data.id) };
}

export async function listPortfolioTradeEventsForSymbol(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  market: 'KR' | 'US',
  symbol: string,
): Promise<WebPortfolioTradeEventRow[]> {
  const { data, error } = await client
    .from('web_portfolio_trade_events')
    .select(
      'id,user_key,market,symbol,name,event_type,trade_date,quantity,price,fee_krw,tax_krw,realized_pnl_krw,realized_pnl_rate,memo,reason,before_quantity,before_avg_price,after_quantity,after_avg_price,source,created_at',
    )
    .eq('user_key', userKey as string)
    .eq('market', market)
    .eq('symbol', symbol.trim().toUpperCase())
    .order('trade_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as WebPortfolioTradeEventRow[];
}
