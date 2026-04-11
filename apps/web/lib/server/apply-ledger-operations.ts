import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey, ParsedLedgerOperation } from '@office-unify/shared-types';
import {
  deletePortfolioHolding,
  deletePortfolioWatchlist,
  upsertPortfolioHolding,
  upsertPortfolioWatchlist,
} from '@office-unify/supabase-access';

export async function applyLedgerOperations(
  client: SupabaseClient,
  userKey: OfficeUserKey,
  operations: ParsedLedgerOperation[],
): Promise<number> {
  let applied = 0;
  for (const op of operations) {
    switch (op.kind) {
      case 'insert_holding':
        await upsertPortfolioHolding(client, userKey, op.row);
        applied += 1;
        break;
      case 'insert_watchlist':
        await upsertPortfolioWatchlist(client, userKey, op.row);
        applied += 1;
        break;
      case 'delete_holding':
        await deletePortfolioHolding(client, userKey, op.market, op.symbol);
        applied += 1;
        break;
      case 'delete_watchlist':
        await deletePortfolioWatchlist(client, userKey, op.market, op.symbol);
        applied += 1;
        break;
      default:
        break;
    }
  }
  return applied;
}
