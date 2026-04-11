import { NextResponse } from 'next/server';
import { getPortfolioSummaryRead } from '@office-unify/supabase-access';
import { parseOfficeUserKey, type PortfolioSummaryResponseBody } from '@office-unify/shared-types';
import { denyUnlessPortfolioReadSecret } from '@/lib/server/portfolio-read-guard';
import { getServiceSupabase } from '@/lib/server/supabase-service';

/**
 * GET /api/portfolio/summary?userKey=<OfficeUserKey>
 * `portfolio` 테이블 행 수 기반 최소 요약(시세·스냅샷 빌드 없음).
 * Authorization: Bearer <OFFICE_UNIFY_PORTFOLIO_READ_SECRET> 필요.
 */
export async function GET(req: Request) {
  const denied = denyUnlessPortfolioReadSecret(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const userKey = parseOfficeUserKey(searchParams.get('userKey'));
  if (!userKey) {
    return NextResponse.json(
      { error: 'Missing or invalid userKey query parameter.' },
      { status: 400 },
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
    const summary = await getPortfolioSummaryRead(supabase, userKey);
    const body: PortfolioSummaryResponseBody = { summary };
    return NextResponse.json(body);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
