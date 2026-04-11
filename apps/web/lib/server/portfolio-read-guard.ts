import 'server-only';

import { NextResponse } from 'next/server';

/**
 * 개발·스테이징용 최소 보호: 공유 시크릿 없이는 포트폴리오 읽기 API를 열지 않는다.
 * 정식 인증으로 교체 시 이 모듈만 갈아끼우면 된다.
 *
 * 클라이언트는 `Authorization: Bearer <OFFICE_UNIFY_PORTFOLIO_READ_SECRET>` 를 보낸다.
 */
export const PORTFOLIO_READ_SECRET_ENV = 'OFFICE_UNIFY_PORTFOLIO_READ_SECRET';

/** 인증 실패·비활성 시 Response, 통과 시 null */
export function denyUnlessPortfolioReadSecret(req: Request): Response | null {
  const configured = process.env[PORTFOLIO_READ_SECRET_ENV]?.trim();
  if (!configured) {
    return NextResponse.json(
      {
        error: `${PORTFOLIO_READ_SECRET_ENV} is not set. Portfolio read APIs are disabled.`,
      },
      { status: 503 },
    );
  }

  const auth = req.headers.get('authorization');
  const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';

  if (!bearer || bearer !== configured) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization Bearer token for portfolio read access.' },
      { status: 401 },
    );
  }

  return null;
}
