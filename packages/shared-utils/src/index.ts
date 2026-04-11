/**
 * legacy `formParsing`에서 Discord 전용 의존 없이 발췌한 순수 파서.
 */
export function parseNumberStrict(value: string): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeSymbol(value: string): string {
  return (value || '').trim().toUpperCase();
}

export function parsePositiveAmount(value: string): number | null {
  const amount = parseNumberStrict(value);
  if (amount === null || amount <= 0) return null;
  return amount;
}

export function sanitizeDescription(value: string): string {
  return (value || '').trim();
}

export type { KstDateString } from './kstDate';
export { getKstDateString, getKstYearMonth, toKstDateString } from './kstDate';
