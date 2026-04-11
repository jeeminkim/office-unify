import { type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

/**
 * Next.js 16+: `middleware.ts`(Edge) 대신 `proxy.ts`(Node.js 런타임).
 * Supabase 세션 갱신은 Edge 제약 없이 동작하며 Vercel 배포 오류를 피합니다.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
