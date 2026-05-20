export type TodayBriefRequestOptions = {
  exposureDays: number;
  forceRefresh: boolean;
  includeDiagnostics: boolean;
  requestId: string;
  ymdKst: string;
};

const DEFAULT_EXPOSURE_DAYS = 7;

function todayYmdKst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");
}

function safeBoolean(value: string | null, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  if (["1", "true", "yes", "y"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "n"].includes(value.toLowerCase())) return false;
  return defaultValue;
}

function safeExposureDays(value: string | null): number {
  const n = Number(value ?? DEFAULT_EXPOSURE_DAYS);
  if (!Number.isFinite(n)) return DEFAULT_EXPOSURE_DAYS;
  return Math.min(30, Math.max(1, Math.trunc(n)));
}

function readRequestUrl(req?: Request): URL {
  if (!req) return new URL("http://localhost/api/dashboard/today-brief");
  return new URL(req.url);
}

export function parseTodayBriefRouteRequest(
  req?: Request,
  now: Date = new Date(),
): TodayBriefRequestOptions {
  const url = readRequestUrl(req);
  const requestId =
    req?.headers.get("x-request-id")?.trim() ||
    url.searchParams.get("requestId")?.trim() ||
    `today_brief_${now.getTime()}`;

  return {
    exposureDays: safeExposureDays(url.searchParams.get("exposureDays") ?? url.searchParams.get("days")),
    forceRefresh: safeBoolean(url.searchParams.get("forceRefresh"), false),
    includeDiagnostics: safeBoolean(url.searchParams.get("includeDiagnostics"), true),
    requestId,
    ymdKst: todayYmdKst(now),
  };
}
