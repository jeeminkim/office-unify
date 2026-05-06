/**
 * Shared-only helpers for Sector Radar naming.
 * Must remain pure (no env/supabase/google API access).
 */

const SECTOR_LABEL_ALIAS_TO_KEYS: Record<string, string> = {
  "바이오/헬스케어": "bio",
  "k-콘텐츠/미디어": "k_content",
  "ai/전력인프라": "ai_power_infra",
  "소비/유통": "consumer_retail",
  "항공/여행": "airline_travel",
  "금융/핀테크": "finance_fintech",
  "사이버보안": "cybersecurity",
  "전기차/자율주행": "ev_autonomous",
  "etf/인컴": "etf_income",
  "조선/lng/소재": "shipping_lng_material",
};

export function normalizeSectorLabelForLookup(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

export function getSectorKeyByAliasName(name: string | null | undefined): string | null {
  const normalized = normalizeSectorLabelForLookup(name);
  if (!normalized) return null;
  return SECTOR_LABEL_ALIAS_TO_KEYS[normalized] ?? null;
}
