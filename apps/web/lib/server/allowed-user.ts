import 'server-only';

import type { User } from '@supabase/supabase-js';
import { parseOfficeUserKey, type OfficeUserKey } from '@office-unify/shared-types';

/** 1인 전용 허용 Google 계정 (소문자 비교) */
export const ALLOWED_PERSONA_CHAT_EMAIL = 'kingjeemin@gmail.com';

export function isAllowedPersonaChatEmail(email: string | undefined | null): boolean {
  return (email ?? '').toLowerCase().trim() === ALLOWED_PERSONA_CHAT_EMAIL;
}

/**
 * DB `user_key` / legacy `discord_user_id` 등에 넣는 안정 식별자.
 * 수동 userKey 대신 Supabase Auth `user.id`(UUID)를 사용한다.
 */
export function authUserToOfficeUserKey(user: User): OfficeUserKey | null {
  if (!isAllowedPersonaChatEmail(user.email)) return null;
  return parseOfficeUserKey(user.id);
}
