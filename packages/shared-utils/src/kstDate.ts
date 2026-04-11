/**
 * 한국 표준시(Asia/Seoul) 기준 **달력 날짜** 문자열 YYYY-MM-DD.
 * UTC 자정 근처에서 날짜가 하루 밀리지 않도록 서버에서만 사용할 것.
 */
export type KstDateString = string & { readonly __brand: 'KstDateString' };

export function toKstDateString(value: string): KstDateString {
  return value as KstDateString;
}

/** 기준 시각의 KST 날짜 (YYYY-MM-DD) */
export function getKstDateString(now: Date = new Date()): KstDateString {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return toKstDateString(s);
}

/** KST 기준 월 식별 `YYYY-MM` (월간 집계·예산용) */
export function getKstYearMonth(now: Date = new Date()): string {
  return getKstDateString(now).slice(0, 7);
}
