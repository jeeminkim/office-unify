import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountSummaryDto, OfficeUserKey } from '@office-unify/shared-types';

type AccountRow = {
  id: string;
  account_name: string;
  account_type: string;
};

/**
 * legacy `tradeService.listUserAccounts`와 동일한 읽기 전용 조회.
 * DB 컬럼 `discord_user_id`에는 `OfficeUserKey` 문자열을 전달한다(리포지토리 내부에서만 컬럼명 사용).
 */
export async function listAccountsForUser(
  client: SupabaseClient,
  userKey: OfficeUserKey,
): Promise<AccountSummaryDto[]> {
  const { data, error } = await client
    .from('accounts')
    .select('id,account_name,account_type')
    .eq('discord_user_id', userKey as string)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as AccountRow[];
  return rows.map((r) => ({
    id: r.id,
    accountName: r.account_name,
    accountType: r.account_type,
  }));
}
