import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey, PortfolioSummaryDto } from '@office-unify/shared-types';

function userScopeFilter(userKey: OfficeUserKey): string {
  const id = userKey as string;
  return `discord_user_id.eq.${id},user_id.eq.${id}`;
}

/**
 * DB에 저장된 `portfolio` 행 수만 집계(시세·스냅샷 빌드 없음, 읽기 전용).
 * legacy `portfolioService.buildPortfolioSnapshot` 과 달리 가격 API를 호출하지 않는다.
 */
export async function getPortfolioSummaryRead(
  client: SupabaseClient,
  userKey: OfficeUserKey,
): Promise<PortfolioSummaryDto> {
  const { count, error } = await client
    .from('portfolio')
    .select('*', { count: 'exact', head: true })
    .or(userScopeFilter(userKey));

  if (error) throw error;

  return {
    positionCount: count ?? 0,
    generatedAt: new Date().toISOString(),
  };
}
