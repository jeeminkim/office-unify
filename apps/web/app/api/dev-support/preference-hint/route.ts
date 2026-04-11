import { NextResponse } from 'next/server';
import {
  buildPreferenceHintFromRows,
  fetchDevSupportPreferenceHintLines,
} from '@office-unify/supabase-access';
import { authUserToOfficeUserKey, isAllowedPersonaChatEmail } from '@/lib/server/allowed-user';
import { getServiceSupabase } from '@/lib/server/supabase-service';
import { createServerSupabaseAuthClient } from '@/lib/supabase/server';

/**
 * 로그인·허용 계정일 때만 최근 피드백을 집계한 힌트 문자열을 반환한다.
 * 비로그인은 hint 빈 문자열.
 */
export async function GET() {
  const authClient = await createServerSupabaseAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user?.email || !isAllowedPersonaChatEmail(user.email)) {
    return NextResponse.json({ hint: '' });
  }

  const userKey = authUserToOfficeUserKey(user);
  if (!userKey) {
    return NextResponse.json({ hint: '' });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ hint: '' });
  }

  try {
    const rows = await fetchDevSupportPreferenceHintLines(supabase, userKey, 24);
    const hint = buildPreferenceHintFromRows(rows);
    return NextResponse.json({ hint });
  } catch {
    return NextResponse.json({ hint: '' });
  }
}
