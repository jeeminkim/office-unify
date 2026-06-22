import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { fetchTossAssetSnapshot, isTossMarketDataConfigured } from '@/lib/server/tossMarketDataService';
import { applyTossPortfolioSync, isTossSyncSchemaMissing } from '@/lib/server/tossPortfolioSyncService';
import { logOpsEvent } from '@/lib/server/opsEventLogger';

export const dynamic = 'force-dynamic';

type SyncRequest = {
  confirm?: boolean;
};

export async function POST(request: Request) {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  let body: SyncRequest;
  try {
    body = await request.json() as SyncRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json({
      ok: false,
      error: 'confirmation_required',
      actionHint: 'confirm=true로 다시 요청해야 포트폴리오 원장이 변경됩니다.',
    }, { status: 400 });
  }
  if (!isTossMarketDataConfigured()) {
    return NextResponse.json({ ok: false, error: 'toss_api_not_configured' }, { status: 503 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: false,
      error: 'supabase_not_configured',
      actionHint: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 설정을 확인하세요.',
    }, { status: 503 });
  }

  try {
    const snapshot = await fetchTossAssetSnapshot();
    const result = await applyTossPortfolioSync(supabase, auth.userKey, snapshot);
    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      ...result,
      message: `토스 보유 ${result.holdingCount}개를 원장에 동기화했습니다.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'toss_portfolio_sync_failed';
    const schemaMissing = isTossSyncSchemaMissing(error);
    void logOpsEvent({
      userKey: auth.userKey,
      eventType: 'error',
      severity: 'error',
      domain: 'portfolio',
      route: '/api/assets/toss/sync',
      message,
      code: schemaMissing ? 'toss_sync_schema_missing' : 'toss_portfolio_sync_failed',
    });
    return NextResponse.json({
      ok: false,
      error: schemaMissing ? 'toss_sync_schema_missing' : 'toss_portfolio_sync_failed',
      actionHint: schemaMissing
        ? 'docs/sql/append_toss_investment_os.sql을 Supabase에 적용한 뒤 다시 시도하세요.'
        : '토스 연결 상태와 운영 로그를 확인한 뒤 다시 시도하세요.',
    }, { status: schemaMissing ? 503 : 502 });
  }
}
