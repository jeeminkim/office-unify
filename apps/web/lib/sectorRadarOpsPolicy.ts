const DEFAULT_THROTTLE_MINUTES = 30;
const OVERHEATED_THROTTLE_MINUTES = 24 * 60;

const OPS_SECTOR_ALIAS: Record<string, string> = {
  '조선-lng-소재': 'shipping-lng-material',
  '조선-lng-소재-': 'shipping-lng-material',
  shipping_lng_material: 'shipping-lng-material',
  'shipping-lng-material': 'shipping-lng-material',
  airline_travel: 'airline-travel',
  etf_income: 'etf-income',
};

export function classifySectorRadarWarningPolicy(code: string): {
  isOperationalError: boolean;
  isObservationWarning: boolean;
  throttleMinutes: number;
} {
  if (code === 'sector_radar_score_overheated') {
    return { isOperationalError: false, isObservationWarning: true, throttleMinutes: OVERHEATED_THROTTLE_MINUTES };
  }
  return { isOperationalError: true, isObservationWarning: false, throttleMinutes: DEFAULT_THROTTLE_MINUTES };
}

export function normalizeSectorRadarOpsKey(input: string): string {
  const normalized = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const base = OPS_SECTOR_ALIAS[normalized] ?? normalized;
  if (!base) return 'unknown-sector';
  if (base.length <= 72) return base;
  const hash = Array.from(base).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0).toString(16);
  return `${base.slice(0, 48)}-${hash}`;
}

export function buildSectorRadarScoreFingerprint(input: {
  userKey?: string | null;
  sectorKey: string;
  code: string;
}): string {
  const user = String(input.userKey ?? '').trim() || 'default';
  const sector = normalizeSectorRadarOpsKey(input.sectorKey);
  return `sector_radar:${user}:${sector}:${input.code}`.slice(0, 500);
}

export function shouldSkipSectorRadarOpsByThrottle(input: {
  code: string;
  lastSeenAt: string;
  throttleMinutes: number;
  nowMs?: number;
}): boolean {
  const now = input.nowMs ?? Date.now();
  const last = Date.parse(input.lastSeenAt);
  if (!Number.isFinite(last)) return false;
  const codeThrottle =
    input.code === 'sector_radar_score_overheated' ? OVERHEATED_THROTTLE_MINUTES : input.throttleMinutes;
  return now - last < codeThrottle * 60_000;
}
