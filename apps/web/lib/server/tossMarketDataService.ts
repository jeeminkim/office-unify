import 'server-only';

const DEFAULT_TOSS_API_BASE_URL = 'https://openapi.tossinvest.com';
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const MAX_SYMBOLS_PER_REQUEST = 200;

type TossOperation =
  | 'auth'
  | 'accounts'
  | 'holdings'
  | 'prices'
  | 'exchange_rate'
  | 'stock_info'
  | 'candles'
  | 'warnings';

type TossTokenResponse = {
  access_token?: string;
  accessToken?: string;
  expires_in?: number;
  expiresIn?: number;
};

type TossPriceResponse = {
  result?: Array<{
    symbol?: string;
    timestamp?: string | null;
    lastPrice?: string;
    currency?: string;
  }>;
};

type TossExchangeRateResponse = {
  result?: {
    rate?: string;
    midRate?: string;
  };
};

export type TossAccount = {
  accountNo: string;
  accountSeq: number;
  accountType: string;
};

type CurrencyAmounts = {
  krw: string;
  usd?: string | null;
};

export type TossHoldingItem = {
  symbol: string;
  name: string;
  marketCountry: 'KR' | 'US' | string;
  currency: 'KRW' | 'USD' | string;
  quantity: string;
  lastPrice: string;
  averagePurchasePrice: string;
  marketValue: {
    purchaseAmount: string;
    amount: string;
    amountAfterCost: string;
  };
  profitLoss: {
    amount: string;
    amountAfterCost: string;
    rate: string;
    rateAfterCost: string;
  };
  dailyProfitLoss: { amount: string; rate: string };
};

export type TossHoldingsOverview = {
  totalPurchaseAmount: CurrencyAmounts;
  marketValue: { amount: CurrencyAmounts; amountAfterCost: CurrencyAmounts };
  profitLoss: {
    amount: CurrencyAmounts;
    amountAfterCost: CurrencyAmounts;
    rate: string;
    rateAfterCost: string;
  };
  dailyProfitLoss: { amount: CurrencyAmounts; rate: string };
  items: TossHoldingItem[];
};

export type TossMarketPrice = {
  symbol: string;
  price: number;
  currency?: string;
  timestamp?: string;
};

export type TossStockInfo = {
  symbol: string;
  name: string;
  englishName: string;
  market: 'KOSPI' | 'KOSDAQ' | 'NYSE' | 'NASDAQ' | 'AMEX' | 'KR_ETC' | 'US_ETC' | string;
  securityType: string;
  isCommonShare: boolean;
  status: string;
  currency: string;
  koreanMarketDetail?: {
    liquidationTrading?: boolean;
    nxtSupported?: boolean;
    krxTradingSuspended?: boolean;
    nxtTradingSuspended?: boolean;
  } | null;
};

export type TossCandle = {
  timestamp: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
  currency: string;
};

export type TossStockWarning = {
  warningType: string;
  exchange?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type TossConfigStatus = {
  configured: boolean;
  credentialSource: 'official' | 'legacy' | 'missing';
  accountSeqConfigured: boolean;
  apiBaseUrl: string;
  requestTimeoutMs: number;
};

export class TossApiError extends Error {
  readonly code: string;
  readonly operation: TossOperation;
  readonly status?: number;
  readonly requestId?: string;
  readonly retryAfter?: string;

  constructor(input: {
    code: string;
    operation: TossOperation;
    message?: string;
    status?: number;
    requestId?: string;
    retryAfter?: string;
  }) {
    super(input.message ?? input.code);
    this.name = 'TossApiError';
    this.code = input.code;
    this.operation = input.operation;
    this.status = input.status;
    this.requestId = input.requestId;
    this.retryAfter = input.retryAfter;
  }
}

let tokenCache: { accessToken: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

function envValue(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function getClientId(): string | undefined {
  return envValue('TOSS_CLIENT_ID', 'TOSS_API_KEY');
}

function getClientSecret(): string | undefined {
  return envValue('TOSS_CLIENT_SECRET', 'TOSS_API_SECRET_KEY');
}

function getConfiguredAccountSeq(): number | undefined {
  const raw = envValue('TOSS_ACCOUNT_SEQ', 'TOSS_API_ACCOUNT_SEQ');
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getApiBaseUrl(): string {
  return (process.env.TOSS_API_BASE_URL?.trim() || DEFAULT_TOSS_API_BASE_URL).replace(/\/+$/, '');
}

function getRequestTimeoutMs(): number {
  const configured = Number(process.env.TOSS_API_TIMEOUT_MS ?? NaN);
  return Number.isFinite(configured) && configured >= 1_000
    ? Math.min(configured, 30_000)
    : DEFAULT_REQUEST_TIMEOUT_MS;
}

function apiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `/v1${normalized}`;
}

export function getTossConfigStatus(): TossConfigStatus {
  const official = Boolean(process.env.TOSS_CLIENT_ID?.trim() && process.env.TOSS_CLIENT_SECRET?.trim());
  const legacy = Boolean(process.env.TOSS_API_KEY?.trim() && process.env.TOSS_API_SECRET_KEY?.trim());
  return {
    configured: Boolean(getClientId() && getClientSecret()),
    credentialSource: official ? 'official' : legacy ? 'legacy' : 'missing',
    accountSeqConfigured: getConfiguredAccountSeq() != null,
    apiBaseUrl: getApiBaseUrl(),
    requestTimeoutMs: getRequestTimeoutMs(),
  };
}

export function isTossMarketDataConfigured(): boolean {
  return getTossConfigStatus().configured;
}

async function fetchWithTimeout(url: string, init: RequestInit | undefined, operation: TossOperation): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TossApiError({ code: 'toss_api_timeout', operation });
    }
    throw new TossApiError({
      code: 'toss_network_failed',
      operation,
      message: error instanceof Error ? error.message : 'toss_network_failed',
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = await response.clone().json() as {
      code?: unknown;
      error?: unknown;
      errorCode?: unknown;
      message?: unknown;
    };
    const candidate = body.code ?? body.errorCode ?? body.error;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
  } catch {
    return undefined;
  }
}

function responseRequestId(response: Response): string | undefined {
  return response.headers.get('x-request-id')
    ?? response.headers.get('x-toss-request-id')
    ?? undefined;
}

async function issueAccessToken(): Promise<string> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new TossApiError({ code: 'toss_api_not_configured', operation: 'auth' });
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetchWithTimeout(`${getApiBaseUrl()}/oauth2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  }, 'auth');
  if (!response.ok) {
    const remoteCode = await readErrorCode(response);
    throw new TossApiError({
      code: remoteCode ? `toss_token_failed:${remoteCode}` : 'toss_token_failed',
      operation: 'auth',
      status: response.status,
      requestId: responseRequestId(response),
      retryAfter: response.headers.get('retry-after') ?? undefined,
    });
  }

  const json = (await response.json()) as TossTokenResponse;
  const accessToken = (json.access_token ?? json.accessToken)?.trim();
  if (!accessToken) throw new TossApiError({ code: 'toss_token_missing', operation: 'auth' });
  const expiresIn = Number(json.expires_in ?? json.expiresIn ?? 0);
  tokenCache = {
    accessToken,
    expiresAt: Date.now() + Math.max(0, expiresIn * 1_000 - TOKEN_EXPIRY_BUFFER_MS),
  };
  return accessToken;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.accessToken;
  if (!tokenRequest) {
    tokenRequest = issueAccessToken().finally(() => {
      tokenRequest = null;
    });
  }
  return tokenRequest;
}

async function tossGet<T>(
  path: string,
  accessToken: string,
  operation: TossOperation,
  headers?: HeadersInit,
  canRetryAuth = true,
): Promise<T> {
  const response = await fetchWithTimeout(`${getApiBaseUrl()}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    },
  }, operation);
  if (response.status === 401 && canRetryAuth) {
    tokenCache = null;
    const refreshedToken = await getAccessToken();
    return tossGet<T>(path, refreshedToken, operation, headers, false);
  }
  if (!response.ok) {
    const remoteCode = await readErrorCode(response);
    throw new TossApiError({
      code: remoteCode ? `toss_api_failed:${remoteCode}` : 'toss_api_failed',
      operation,
      status: response.status,
      requestId: responseRequestId(response),
      retryAfter: response.headers.get('retry-after') ?? undefined,
    });
  }
  return (await response.json()) as T;
}

function resultArray<T>(payload: { result?: T[] } | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.result ?? [];
}

export async function fetchTossStockInfo(symbols: string[]): Promise<Map<string, TossStockInfo>> {
  const normalized = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)));
  if (normalized.length === 0) return new Map();
  const accessToken = await getAccessToken();
  const responses = await Promise.all(chunks(normalized, MAX_SYMBOLS_PER_REQUEST).map((batch) =>
    tossGet<{ result?: TossStockInfo[] }>(
      `${apiPath('/stocks')}?symbols=${encodeURIComponent(batch.join(','))}`,
      accessToken,
      'stock_info',
    ),
  ));
  const rows = responses.flatMap((response) => response.result ?? []);
  return new Map(rows.map((row) => [row.symbol.trim().toUpperCase(), row]));
}

export async function fetchTossDailyCandles(symbol: string, count = 30): Promise<TossCandle[]> {
  const accessToken = await getAccessToken();
  const safeCount = Math.max(1, Math.min(200, Math.trunc(count)));
  const response = await tossGet<{ result?: { candles?: TossCandle[] } }>(
    `${apiPath('/candles')}?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}&interval=1d&count=${safeCount}&adjusted=true`,
    accessToken,
    'candles',
  );
  return response.result?.candles ?? [];
}

export async function fetchTossStockWarnings(symbol: string): Promise<TossStockWarning[]> {
  const accessToken = await getAccessToken();
  const response = await tossGet<{ result?: TossStockWarning[] }>(
    apiPath(`/stocks/${encodeURIComponent(symbol.trim().toUpperCase())}/warnings`),
    accessToken,
    'warnings',
  );
  return response.result ?? [];
}

export async function fetchTossAccounts(): Promise<TossAccount[]> {
  const accessToken = await getAccessToken();
  const payload = await tossGet<{ result?: TossAccount[] } | TossAccount[]>(
    apiPath('/accounts'),
    accessToken,
    'accounts',
  );
  return resultArray(payload).map((row) => ({
    accountNo: String(row.accountNo ?? ''),
    accountSeq: Number(row.accountSeq),
    accountType: String(row.accountType ?? 'UNKNOWN'),
  })).filter((row) => Number.isFinite(row.accountSeq));
}

export async function fetchTossAssetSnapshot(): Promise<{
  account: TossAccount;
  holdings: TossHoldingsOverview;
  usdKrwRate?: number;
}> {
  const accessToken = await getAccessToken();
  const accounts = await fetchTossAccounts();
  const configuredSeq = getConfiguredAccountSeq();
  const account = configuredSeq != null
    ? accounts.find((candidate) => candidate.accountSeq === configuredSeq)
    : accounts.find((candidate) => candidate.accountType === 'BROKERAGE') ?? accounts[0];
  if (!account) {
    throw new TossApiError({
      code: configuredSeq != null ? 'toss_configured_account_not_found' : 'toss_account_not_found',
      operation: 'accounts',
    });
  }

  const [holdingsResponse, exchangeRateResponse] = await Promise.all([
    tossGet<{ result?: TossHoldingsOverview }>(apiPath('/holdings'), accessToken, 'holdings', {
      'X-Tossinvest-Account': String(account.accountSeq),
    }),
    tossGet<TossExchangeRateResponse>(
      `${apiPath('/exchange-rate')}?baseCurrency=USD&quoteCurrency=KRW`,
      accessToken,
      'exchange_rate',
    ).catch(() => null),
  ]);
  if (!holdingsResponse.result) {
    throw new TossApiError({ code: 'toss_holdings_missing', operation: 'holdings' });
  }

  const rate = Number(exchangeRateResponse?.result?.midRate ?? exchangeRateResponse?.result?.rate ?? NaN);
  return {
    account,
    holdings: holdingsResponse.result,
    usdKrwRate: Number.isFinite(rate) && rate > 0 ? rate : undefined,
  };
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function fetchTossMarketData(symbols: string[]): Promise<{
  prices: Map<string, TossMarketPrice>;
  usdKrwRate?: number;
}> {
  const accessToken = await getAccessToken();
  const normalizedSymbols = Array.from(
    new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)),
  );

  const priceRequests = chunks(normalizedSymbols, MAX_SYMBOLS_PER_REQUEST).map(async (batch) => {
    const query = encodeURIComponent(batch.join(','));
    return tossGet<TossPriceResponse>(`${apiPath('/prices')}?symbols=${query}`, accessToken, 'prices');
  });
  const exchangeRateRequest = tossGet<TossExchangeRateResponse>(
    `${apiPath('/exchange-rate')}?baseCurrency=USD&quoteCurrency=KRW`,
    accessToken,
    'exchange_rate',
  ).catch(() => null);
  const [priceResponses, exchangeRateResponse] = await Promise.all([
    Promise.all(priceRequests),
    exchangeRateRequest,
  ]);

  const prices = new Map<string, TossMarketPrice>();
  priceResponses.flatMap((response) => response.result ?? []).forEach((row) => {
    const symbol = row.symbol?.trim().toUpperCase();
    const price = Number(row.lastPrice ?? NaN);
    if (!symbol || !Number.isFinite(price) || price <= 0) return;
    prices.set(symbol, {
      symbol,
      price,
      currency: row.currency,
      timestamp: row.timestamp ?? undefined,
    });
  });

  const rate = Number(exchangeRateResponse?.result?.midRate ?? exchangeRateResponse?.result?.rate ?? NaN);
  return {
    prices,
    usdKrwRate: Number.isFinite(rate) && rate > 0 ? rate : undefined,
  };
}

export function resetTossTokenCacheForTests(): void {
  tokenCache = null;
  tokenRequest = null;
}
