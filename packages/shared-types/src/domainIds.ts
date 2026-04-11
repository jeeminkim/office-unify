/**
 * 애플리케이션 도메인의 사용자 식별자.
 *
 * 현재 DB 스키마(legacy)는 `discord_user_id` 컬럼에 외부 사용자 키를 저장한다.
 * API·DTO에서는 해당 컬럼명을 노출하지 않고 `userKey` + `OfficeUserKey`로만 다룬다.
 * 웹 전용 1인 인증에서는 Supabase Auth `user.id`(UUID)를 `OfficeUserKey`로 쓸 수 있다.
 * (향후 다중 사용자·외부 IdP 매핑 시 이 타입의 의미만 확장하면 된다.)
 */
export type OfficeUserKey = string & { readonly __brand: 'OfficeUserKey' };

/** 쿼리/헤더 등에서 받은 문자열을 도메인 키로 정규화한다. 실패 시 null. */
export function parseOfficeUserKey(raw: string | null | undefined): OfficeUserKey | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  return s as OfficeUserKey;
}
