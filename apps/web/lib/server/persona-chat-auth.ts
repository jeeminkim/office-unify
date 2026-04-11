import 'server-only';

import { NextResponse } from 'next/server';
import type { OfficeUserKey } from '@office-unify/shared-types';
import { createServerSupabaseAuthClient } from '@/lib/supabase/server';
import { authUserToOfficeUserKey, isAllowedPersonaChatEmail } from '@/lib/server/allowed-user';

export type PersonaChatAuthOk = { ok: true; userKey: OfficeUserKey };

export type PersonaChatAuthFail = { ok: false; response: NextResponse };

/**
 * persona chat API 전용: 세션 + 허용 이메일 검사.
 * service role DB 클라이언트와 별개로, Auth는 anon+쿠키로만 읽는다.
 */
export async function requirePersonaChatAuth(): Promise<PersonaChatAuthOk | PersonaChatAuthFail> {
  const supabase = await createServerSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized. Sign in with Google.' }, { status: 401 }),
    };
  }

  if (!isAllowedPersonaChatEmail(user.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden. This service is restricted to an allowed Google account.' },
        { status: 403 },
      ),
    };
  }

  const userKey = authUserToOfficeUserKey(user);
  if (!userKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }),
    };
  }

  return { ok: true, userKey };
}
