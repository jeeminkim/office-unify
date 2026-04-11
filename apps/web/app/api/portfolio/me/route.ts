import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';

/**
 * GET /api/portfolio/me
 * 로그인 세션의 OfficeUserKey(Supabase Auth user.id)를 반환한다.
 * SQL 시드(`seed_portfolio_from_book_csv.sql`)의 YOUR_OFFICE_USER_KEY 치환값으로 사용.
 */
export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ userKey: auth.userKey as string });
}
