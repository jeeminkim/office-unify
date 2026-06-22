import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import {
  fetchTossAssetSnapshot,
  getTossConfigStatus,
  isTossMarketDataConfigured,
  TossApiError,
} from '@/lib/server/tossMarketDataService';

export const dynamic = 'force-dynamic';

function maskAccountNumber(accountNo: string): string {
  const digits = accountNo.replace(/\D/g, '');
  return digits.length > 4 ? `•••• ${digits.slice(-4)}` : '••••';
}

function diagnosticResponse(error: unknown) {
  if (error instanceof TossApiError) {
    const status = error.status === 429
      ? 429
      : error.status === 401 || error.status === 403
        ? 502
        : error.code === 'toss_api_not_configured'
          ? 503
          : 502;

    const actionHint = error.code === 'toss_api_not_configured'
      ? 'Vercel 또는 .env.local에 TOSS_CLIENT_ID와 TOSS_CLIENT_SECRET을 설정하세요.'
      : error.code === 'toss_configured_account_not_found'
        ? 'TOSS_ACCOUNT_SEQ가 실제 계좌 목록의 accountSeq와 일치하는지 확인하세요.'
        : error.code === 'toss_account_not_found'
          ? '발급받은 앱에 계좌 조회 권한과 연결된 종합계좌가 있는지 확인하세요.'
          : error.status === 401 || error.status === 403
            ? 'Client ID/Secret, 앱 권한, 토큰 발급 범위를 확인하세요.'
            : error.status === 404
              ? '토스 Open API 계약 경로가 현재 문서와 일치하는지 확인하세요. 앱은 /v1 경로를 사용합니다.'
              : error.status === 429
                ? '요청 제한에 도달했습니다. Retry-After 이후 다시 시도하세요.'
                : error.code === 'toss_api_timeout'
                  ? '토스 API 응답이 지연되었습니다. 잠시 후 다시 시도하세요.'
                  : '토스 개발자 콘솔의 앱 상태·계좌 권한과 운영 로그를 확인하세요.';

    return NextResponse.json({
      ok: false,
      error: error.code,
      operation: error.operation,
      upstreamStatus: error.status,
      requestId: error.requestId,
      retryAfter: error.retryAfter,
      actionHint,
      config: getTossConfigStatus(),
    }, { status });
  }

  return NextResponse.json({
    ok: false,
    error: error instanceof Error ? error.message : 'toss_asset_fetch_failed',
    actionHint: '토스 연결 상태와 서버 운영 로그를 확인한 뒤 다시 시도하세요.',
    config: getTossConfigStatus(),
  }, { status: 502 });
}

export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;

  if (!isTossMarketDataConfigured()) {
    return NextResponse.json({
      ok: false,
      error: 'toss_api_not_configured',
      actionHint: 'Vercel 또는 .env.local에 TOSS_CLIENT_ID와 TOSS_CLIENT_SECRET을 설정하세요.',
      config: getTossConfigStatus(),
    }, { status: 503 });
  }

  try {
    const snapshot = await fetchTossAssetSnapshot();
    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      account: {
        label: '토스증권 종합계좌',
        maskedNumber: maskAccountNumber(snapshot.account.accountNo),
        accountType: snapshot.account.accountType,
        accountSeq: snapshot.account.accountSeq,
      },
      holdings: snapshot.holdings,
      usdKrwRate: snapshot.usdKrwRate,
      source: 'toss_open_api_v1',
    });
  } catch (error) {
    return diagnosticResponse(error);
  }
}
