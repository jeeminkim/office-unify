import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TossHoldingItem, TossHoldingsOverview } from '@/lib/server/tossMarketDataService';

export type TossPortfolioSyncSnapshot = {
  account: { accountSeq: number; accountType: string };
  holdings: TossHoldingsOverview;
};

export type TossPortfolioSyncResult = {
  syncRunId: string;
  holdingCount: number;
  insertedCount: number;
  updatedCount: number;
  closedCount: number;
};

type LedgerRow = {
  user_key: string;
  market: 'KR' | 'US';
  symbol: string;
  name: string;
  qty: number;
  avg_price: number | null;
  source: 'toss';
  source_account_seq: number;
  source_synced_at: string;
  source_status: 'active';
  source_fingerprint: string;
  updated_at: string;
};

function finiteNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function marketOf(item: TossHoldingItem): 'KR' | 'US' {
  return item.marketCountry === 'US' || item.currency === 'USD' ? 'US' : 'KR';
}

function symbolOf(item: TossHoldingItem): string {
  const symbol = item.symbol.trim().toUpperCase();
  return marketOf(item) === 'KR' && /^\d+$/.test(symbol) ? symbol.padStart(6, '0') : symbol;
}

function holdingFingerprint(input: {
  accountSeq: number;
  market: string;
  symbol: string;
  quantity: number;
  averagePurchasePrice: number;
}): string {
  return createHash('sha256')
    .update([
      input.accountSeq,
      input.market,
      input.symbol,
      input.quantity,
      input.averagePurchasePrice,
    ].join('|'))
    .digest('hex');
}

function toLedgerRow(userKey: string, accountSeq: number, item: TossHoldingItem, syncedAt: string): LedgerRow {
  const market = marketOf(item);
  const symbol = symbolOf(item);
  const quantity = finiteNumber(item.quantity);
  const averagePurchasePrice = finiteNumber(item.averagePurchasePrice);
  return {
    user_key: userKey,
    market,
    symbol,
    name: item.name.trim() || symbol,
    qty: quantity,
    avg_price: averagePurchasePrice > 0 ? averagePurchasePrice : null,
    source: 'toss',
    source_account_seq: accountSeq,
    source_synced_at: syncedAt,
    source_status: 'active',
    source_fingerprint: holdingFingerprint({
      accountSeq,
      market,
      symbol,
      quantity,
      averagePurchasePrice,
    }),
    updated_at: syncedAt,
  };
}

function toSnapshotRow(
  syncRunId: string,
  userKey: string,
  accountSeq: number,
  item: TossHoldingItem,
  observedAt: string,
) {
  return {
    sync_run_id: syncRunId,
    user_key: userKey,
    account_seq: accountSeq,
    market: marketOf(item),
    symbol: symbolOf(item),
    name: item.name.trim() || symbolOf(item),
    currency: item.currency,
    quantity: finiteNumber(item.quantity),
    average_purchase_price: finiteNumber(item.averagePurchasePrice) || null,
    last_price: finiteNumber(item.lastPrice) || null,
    purchase_amount: finiteNumber(item.marketValue.purchaseAmount) || null,
    market_value: finiteNumber(item.marketValue.amount) || null,
    profit_loss: finiteNumber(item.profitLoss.amount),
    profit_loss_rate: finiteNumber(item.profitLoss.rate),
    daily_profit_loss: finiteNumber(item.dailyProfitLoss.amount),
    daily_profit_loss_rate: finiteNumber(item.dailyProfitLoss.rate),
    observed_at: observedAt,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'toss_portfolio_sync_failed';
}

export function isTossSyncSchemaMissing(error: unknown): boolean {
  const message = errorMessage(error);
  return /toss_asset_sync_runs|toss_holding_snapshots|source_account_seq|source_status|source_fingerprint|schema cache|does not exist/i.test(message);
}

export async function applyTossPortfolioSync(
  supabase: SupabaseClient,
  userKey: string,
  snapshot: TossPortfolioSyncSnapshot,
): Promise<TossPortfolioSyncResult> {
  const syncedAt = new Date().toISOString();
  const accountSeq = snapshot.account.accountSeq;
  const items = snapshot.holdings.items.filter((item) => finiteNumber(item.quantity) > 0);
  let syncRunId: string | null = null;

  try {
    const runInsert = await supabase
      .from('toss_asset_sync_runs')
      .insert({
        user_key: userKey,
        account_seq: accountSeq,
        account_type: snapshot.account.accountType,
        sync_mode: 'apply',
        status: 'running',
        holding_count: items.length,
        metadata: { source: 'toss_open_api_v1' },
      })
      .select('id')
      .single();
    if (runInsert.error) throw runInsert.error;
    syncRunId = String(runInsert.data.id);

    const existingResult = await supabase
      .from('web_portfolio_holdings')
      .select('id,market,symbol,source,source_account_seq,source_status')
      .eq('user_key', userKey);
    if (existingResult.error) throw existingResult.error;

    const existingRows = existingResult.data ?? [];
    const existingKeys = new Set(existingRows.map((row) => `${row.market}:${String(row.symbol).toUpperCase()}`));
    const ledgerRows = items.map((item) => toLedgerRow(userKey, accountSeq, item, syncedAt));
    const incomingKeys = new Set(ledgerRows.map((row) => `${row.market}:${row.symbol}`));
    const insertedCount = ledgerRows.filter((row) => !existingKeys.has(`${row.market}:${row.symbol}`)).length;
    const updatedCount = ledgerRows.length - insertedCount;

    if (ledgerRows.length > 0) {
      const upsert = await supabase
        .from('web_portfolio_holdings')
        .upsert(ledgerRows, { onConflict: 'user_key,market,symbol' });
      if (upsert.error) throw upsert.error;
    }

    const closedIds = existingRows
      .filter((row) => row.source === 'toss')
      .filter((row) => Number(row.source_account_seq) === accountSeq)
      .filter((row) => row.source_status !== 'closed')
      .filter((row) => !incomingKeys.has(`${row.market}:${String(row.symbol).toUpperCase()}`))
      .map((row) => String(row.id));

    if (closedIds.length > 0) {
      const close = await supabase
        .from('web_portfolio_holdings')
        .update({
          qty: 0,
          source_status: 'closed',
          source_synced_at: syncedAt,
          updated_at: syncedAt,
        })
        .in('id', closedIds);
      if (close.error) throw close.error;
    }

    if (items.length > 0) {
      const snapshotInsert = await supabase
        .from('toss_holding_snapshots')
        .insert(items.map((item) => toSnapshotRow(syncRunId as string, userKey, accountSeq, item, syncedAt)));
      if (snapshotInsert.error) throw snapshotInsert.error;
    }

    const runUpdate = await supabase
      .from('toss_asset_sync_runs')
      .update({
        status: 'success',
        inserted_count: insertedCount,
        updated_count: updatedCount,
        closed_count: closedIds.length,
        completed_at: syncedAt,
      })
      .eq('id', syncRunId);
    if (runUpdate.error) throw runUpdate.error;

    return {
      syncRunId,
      holdingCount: items.length,
      insertedCount,
      updatedCount,
      closedCount: closedIds.length,
    };
  } catch (error) {
    if (syncRunId) {
      await supabase
        .from('toss_asset_sync_runs')
        .update({
          status: 'failed',
          error_code: errorMessage(error).slice(0, 300),
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncRunId);
    }
    throw error;
  }
}
