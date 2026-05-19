import 'server-only';

import { getSpreadsheetSheets } from '@/lib/server/google-sheets-api';
import { US_MARKET_SEED_ANCHORS, fetchUsMarketYahooQuoteMap } from '@/lib/server/usMarketMorningSummary';
import {
  isGoogleFinanceQuoteConfigured,
  readGoogleFinanceQuoteSheetRows,
  type GoogleFinanceQuoteRow,
} from '@/lib/server/googleFinanceSheetQuoteService';
import { buildGoogleSheetsRepairPlan, type GoogleSheetsRepairPlan } from '@/lib/server/googleSheetsRepair';

export type GoogleFinanceQuoteSource =
  | 'google_sheets_readback'
  | 'yahoo_fallback'
  | 'internal_cache'
  | 'unknown';

export type GoogleFinanceAnchorReadbackStatus =
  | 'ok'
  | 'missing'
  | 'parse_failed'
  | 'stale'
  | 'unsupported'
  | 'unknown';

export type GoogleFinanceTabProbeStatus = 'found' | 'missing' | 'read_failed' | 'not_checked';

export type GoogleFinanceTabProbe = {
  name: string;
  role: 'primary' | 'fallback' | 'legacy';
  status: GoogleFinanceTabProbeStatus;
  note?: string;
};

export type GoogleFinanceTabGuide = {
  primaryTab: string;
  fallbackTabs: string[];
  legacyTabs: string[];
  probeOrder: string[];
  probes: GoogleFinanceTabProbe[];
  tabActionHint: string;
};

export type GoogleFinanceAnchorResult = {
  key: string;
  label: string;
  symbol: string;
  googleTicker: string;
  expectedFormula: string;
  readbackPrice?: number;
  readbackName?: string;
  readbackStatus: GoogleFinanceAnchorReadbackStatus;
  source: GoogleFinanceQuoteSource;
  lastCheckedAt: string;
  actionHint?: string;
  /** @deprecated use readbackStatus + source — Sheets read-back OK only */
  ok: boolean;
};

export type GoogleFinanceSetupCheckResult = {
  readOnly: true;
  status: 'ok' | 'degraded' | 'failed' | 'not_configured';
  generatedAt: string;
  overallQuoteSource: GoogleFinanceQuoteSource | 'mixed';
  /** @deprecated use tabGuide.probeOrder — kept for API compat */
  expectedTabs: string[];
  tabGuide: GoogleFinanceTabGuide;
  sqlVsSheetsNote: string;
  statusNarrative: string;
  portfolioQuotesTab: {
    configuredName: string;
    tabFound: boolean;
    readSucceeded: boolean;
    readbackUnavailable: boolean;
    rowCount: number;
    okRows: number;
    parseFailedRows: number;
    missingRows: number;
  };
  usAnchor: {
    requested: number;
    /** Sheets read-back OK count (not Yahoo) */
    ok: number;
    coverageLabel: string;
    fetchFailed: boolean;
    emptyReason?: string;
    summary: {
      sheetsAnchorOk: number;
      fallbackOnly: number;
      missing: number;
      rangeOrPermissionError: number;
    };
    results: GoogleFinanceAnchorResult[];
  };
  usMarketGatingNote: string;
  sampleFormulas: string[];
  sampleFormulasUnprefixed: string[];
  portfolioQuotesSampleTsv: string;
  sampleTable: {
    columns: string[];
    exampleRow: Record<string, string>;
  };
  /** 행동 중심 점검 순서 */
  userSetupSteps: Array<{ step: number; label: string; description?: string }>;
  /** @deprecated prefer userSetupSteps — kept for compat */
  setupChecklist: Array<{ label: string; description: string }>;
  developerApis: Array<{ method: string; path: string; note?: string }>;
  actionHint: string;
  warnings: string[];
  /** Confirmed write only — plan 생성은 read-only, apply는 별도 POST */
  repairPlan: GoogleSheetsRepairPlan;
  repairModeNote: string;
};

const FALLBACK_TABS = ['US_Anchor', '시세', 'Quotes'] as const;
const LEGACY_TABS = ['sector_radar_quotes', 'portfolio_quote_candidates'] as const;

const SAMPLE_FORMULAS_PREFIXED = [
  '=GOOGLEFINANCE("NYSEARCA:SPY","price")',
  '=GOOGLEFINANCE("NASDAQ:QQQ","price")',
  '=GOOGLEFINANCE("NYSEARCA:DIA","price")',
  '=GOOGLEFINANCE("NASDAQ:TSLA","price")',
  '=GOOGLEFINANCE("NASDAQ:NVDA","price")',
  '=GOOGLEFINANCE("NASDAQ:AAPL","price")',
  '=GOOGLEFINANCE("NASDAQ:MSFT","price")',
  '=GOOGLEFINANCE("KRX:005930","price")',
  '=GOOGLEFINANCE("KRX:000660","price")',
];

const SAMPLE_FORMULAS_UNPREFIXED = [
  '=GOOGLEFINANCE("SPY","price")',
  '=GOOGLEFINANCE("QQQ","price")',
  '=GOOGLEFINANCE("TSLA","price")',
];

export const PORTFOLIO_QUOTES_SAMPLE_TSV = `symbol\tgoogle_ticker\tprice\tname\tvolume\tmarketcap\ttradetime\tstatus
SPY\tNYSEARCA:SPY\t=IFERROR(GOOGLEFINANCE(B2,"price"),"")\t=IFERROR(GOOGLEFINANCE(B2,"name"),"")\t=IFERROR(GOOGLEFINANCE(B2,"volume"),"")\t=IFERROR(GOOGLEFINANCE(B2,"marketcap"),"")\t=IFERROR(GOOGLEFINANCE(B2,"tradetime"),"")\t=IF(C2="","missing","ok")
QQQ\tNASDAQ:QQQ\t=IFERROR(GOOGLEFINANCE(B3,"price"),"")\t=IFERROR(GOOGLEFINANCE(B3,"name"),"")\t=IFERROR(GOOGLEFINANCE(B3,"volume"),"")\t=IFERROR(GOOGLEFINANCE(B3,"marketcap"),"")\t=IFERROR(GOOGLEFINANCE(B3,"tradetime"),"")\t=IF(C3="","missing","ok")
TSLA\tNASDAQ:TSLA\t=IFERROR(GOOGLEFINANCE(B4,"price"),"")\t=IFERROR(GOOGLEFINANCE(B4,"name"),"")\t=IFERROR(GOOGLEFINANCE(B4,"volume"),"")\t=IFERROR(GOOGLEFINANCE(B4,"marketcap"),"")\t=IFERROR(GOOGLEFINANCE(B4,"tradetime"),"")\t=IF(C4="","missing","ok")
NVDA\tNASDAQ:NVDA\t=IFERROR(GOOGLEFINANCE(B5,"price"),"")\t=IFERROR(GOOGLEFINANCE(B5,"name"),"")\t=IFERROR(GOOGLEFINANCE(B5,"volume"),"")\t=IFERROR(GOOGLEFINANCE(B5,"marketcap"),"")\t=IFERROR(GOOGLEFINANCE(B5,"tradetime"),"")\t=IF(C5="","missing","ok")
AAPL\tNASDAQ:AAPL\t=IFERROR(GOOGLEFINANCE(B6,"price"),"")\t=IFERROR(GOOGLEFINANCE(B6,"name"),"")\t=IFERROR(GOOGLEFINANCE(B6,"volume"),"")\t=IFERROR(GOOGLEFINANCE(B6,"marketcap"),"")\t=IFERROR(GOOGLEFINANCE(B6,"tradetime"),"")\t=IF(C6="","missing","ok")
MSFT\tNASDAQ:MSFT\t=IFERROR(GOOGLEFINANCE(B7,"price"),"")\t=IFERROR(GOOGLEFINANCE(B7,"name"),"")\t=IFERROR(GOOGLEFINANCE(B7,"volume"),"")\t=IFERROR(GOOGLEFINANCE(B7,"marketcap"),"")\t=IFERROR(GOOGLEFINANCE(B7,"tradetime"),"")\t=IF(C7="","missing","ok")`;

const USER_SETUP_STEPS: GoogleFinanceSetupCheckResult['userSetupSteps'] = [
  { step: 1, label: 'Google Sheets에서 portfolio_quotes 탭을 확인합니다.' },
  { step: 2, label: '샘플 표를 복사해 A1부터 붙여넣습니다.', description: '아래 「portfolio_quotes 샘플 표 복사」 버튼 사용' },
  { step: 3, label: 'price 열에 값이 1개 이상 나오는지 확인합니다.', description: 'marketcap/tradetime은 비어 있을 수 있음' },
  { step: 4, label: '앱에서 「시세 새로고침 요청」을 누릅니다.' },
  { step: 5, label: '「시세 상태 확인」으로 rowStatus·anchor OK가 늘었는지 봅니다.' },
  { step: 6, label: 'Today Brief를 다시 실행합니다.' },
  {
    step: 7,
    label: '그래도 0/18이면 Action Item으로 저장하고 설정을 점검합니다.',
    description: 'SQL 문제가 아니라 Sheets·GOOGLEFINANCE read-back 문제일 수 있음',
  },
];

const DEVELOPER_APIS: GoogleFinanceSetupCheckResult['developerApis'] = [
  { method: 'GET', path: '/api/portfolio/quotes/status', note: 'rowStatus·anchor 요약' },
  { method: 'POST', path: '/api/portfolio/quotes/refresh', note: '사용자 명시 시에만' },
  { method: 'GET', path: '/api/system/google-finance-setup', note: 'read-only 점검 (repairPlan 포함, write 0)' },
  {
    method: 'POST',
    path: '/api/system/google-finance-setup/repair/apply',
    note: 'confirm=true일 때만 Sheets write',
  },
];

const REPAIR_MODE_NOTE =
  'Sheets Repair Assistant는 사용자가 「적용」을 눌렀을 때만 탭/헤더/수식을 write합니다. GET 점검·미리보기는 read-only이며, 기존 셀 값은 기본적으로 덮어쓰지 않습니다.';

const ANCHOR_SAMPLE_COUNT = 18;

const SQL_VS_SHEETS_NOTE =
  'SQL 준비 상태가 정상이더라도 Google Sheets의 GOOGLEFINANCE 수식이 비어 있으면 미국 anchor는 0으로 나옵니다. 이 경우 미국 종목은 일반 관찰 후보가 아니라 데이터 점검 카드로 분리됩니다. quote provider·Sheets 문제일 수 있으며 SQL 문제로 단정하지 마세요.';

function expectedFormula(googleTicker: string): string {
  return `=GOOGLEFINANCE("${googleTicker}","price")`;
}

function findSheetRowForAnchor(rows: GoogleFinanceQuoteRow[], anchor: (typeof US_MARKET_SEED_ANCHORS)[number]) {
  const want = new Set(
    [anchor.googleTicker, anchor.quoteSymbol, anchor.key].map((s) => s.trim().toUpperCase()).filter(Boolean),
  );
  for (const row of rows) {
    const gt = row.googleTicker?.trim().toUpperCase() ?? '';
    const sym = row.symbol?.trim().toUpperCase() ?? '';
    const key = row.normalizedKey?.toUpperCase() ?? '';
    if (want.has(gt) || want.has(sym) || key.includes(anchor.quoteSymbol)) return row;
  }
  return null;
}

function mapRowToReadbackStatus(row: GoogleFinanceQuoteRow | null): GoogleFinanceAnchorReadbackStatus {
  if (!row) return 'missing';
  switch (row.rowStatus) {
    case 'ok':
      return 'ok';
    case 'parse_failed':
      return 'parse_failed';
    case 'formula_pending':
      return 'stale';
    case 'ticker_mismatch':
      return 'unsupported';
    case 'empty_price':
    case 'missing_row':
      return 'missing';
    default:
      return 'unknown';
  }
}

function sourceLabel(source: GoogleFinanceQuoteSource, status: GoogleFinanceAnchorReadbackStatus): string {
  if (source === 'google_sheets_readback' && status === 'ok') return 'Sheets read-back OK';
  if (source === 'yahoo_fallback') return 'Fallback only';
  if (status === 'missing') return 'Sheets missing';
  if (status === 'parse_failed') return 'Range parse failed';
  if (status === 'unsupported') return 'Unsupported attribute';
  if (status === 'stale') return 'Formula pending';
  return 'Unknown';
}

async function loadSpreadsheetTabTitles(): Promise<Set<string>> {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!id) return new Set();
  try {
    const sheets = await getSpreadsheetSheets(id);
    return new Set(sheets.map((s) => s.title));
  } catch {
    return new Set();
  }
}

function buildTabGuide(input: {
  primaryTab: string;
  configured: boolean;
  tabFound: boolean;
  readSucceeded: boolean;
  readbackUnavailable: boolean;
  sheetTitles: Set<string>;
}): GoogleFinanceTabGuide {
  const { primaryTab, configured, tabFound, readSucceeded, readbackUnavailable, sheetTitles } = input;
  const probeOrder = [primaryTab, ...FALLBACK_TABS];
  const fallbackTabs = [...FALLBACK_TABS];
  const legacyTabs = [...LEGACY_TABS];

  const probes: GoogleFinanceTabProbe[] = [];

  const primaryStatus: GoogleFinanceTabProbeStatus = !configured
    ? 'not_checked'
    : readbackUnavailable
      ? 'read_failed'
      : tabFound && readSucceeded
        ? 'found'
        : tabFound
          ? 'found'
          : 'missing';

  probes.push({
    name: primaryTab,
    role: 'primary',
    status: primaryStatus,
    note: '앱이 US anchor·portfolio 시세 read-back에 사용하는 1순위 탭',
  });

  for (const name of FALLBACK_TABS) {
    probes.push({
      name,
      role: 'fallback',
      status: !configured ? 'not_checked' : sheetTitles.has(name) ? 'found' : 'missing',
      note: '보조/호환 탭 — 앱 read-back 1순위는 portfolio_quotes',
    });
  }

  for (const name of LEGACY_TABS) {
    probes.push({
      name,
      role: 'legacy',
      status: !configured ? 'not_checked' : sheetTitles.has(name) ? 'found' : 'missing',
      note: 'Sector Radar 등 다른 기능용 — US anchor 점검과 별개',
    });
  }

  const anyFallbackFound = FALLBACK_TABS.some((t) => sheetTitles.has(t));
  let tabActionHint =
    '탭 탐색 순서: 1) portfolio_quotes → 2) US_Anchor → 3) 시세 → 4) Quotes. 앱 read-back은 portfolio_quotes 기준입니다.';

  if (configured && !tabFound && !readbackUnavailable) {
    tabActionHint =
      '먼저 portfolio_quotes 탭을 만들고 아래 샘플 표를 복사해 A1부터 붙여 넣으세요. price·status가 ok인지 확인한 뒤 시세 새로고침·Today Brief를 다시 실행하세요.';
  } else if (configured && readbackUnavailable) {
    tabActionHint =
      'portfolio_quotes 탭은 있지만 range를 읽지 못했습니다. 탭 이름, 서비스 계정 권한, A1 범위·컬럼 구조를 확인하세요.';
  } else if (configured && anyFallbackFound && !tabFound) {
    tabActionHint =
      '보조 탭(US_Anchor·시세·Quotes)은 감지됐지만 앱의 1순위 read-back은 portfolio_quotes입니다. 가능하면 portfolio_quotes 기준으로 샘플 표를 맞추세요.';
  }

  return {
    primaryTab,
    fallbackTabs,
    legacyTabs,
    probeOrder,
    probes,
    tabActionHint,
  };
}

function buildStatusNarrative(input: {
  sheetsAnchorOk: number;
  fallbackOnly: number;
  rangeOrPermissionError: number;
  readbackUnavailable: boolean;
  status: GoogleFinanceSetupCheckResult['status'];
}): string {
  const { sheetsAnchorOk, fallbackOnly, rangeOrPermissionError, readbackUnavailable, status } = input;
  if (readbackUnavailable || rangeOrPermissionError > 0) {
    return '탭은 있지만 range를 읽지 못했습니다. 탭 이름, 권한, A1 범위를 확인하세요.';
  }
  if (sheetsAnchorOk > 0) {
    return 'Google Sheets read-back이 일부 확인됐습니다. 미국 후보 평가가 제한적으로 가능해집니다.';
  }
  if (fallbackOnly > 0) {
    return 'fallback 데이터는 있지만 Google Sheets read-back은 확인되지 않았습니다. 앱 설정 점검 기준으로는 아직 degraded입니다.';
  }
  if (status === 'failed' || (sheetsAnchorOk === 0 && fallbackOnly === 0)) {
    return '미국 anchor 시세를 가져오지 못했습니다. portfolio_quotes 탭과 샘플 수식을 먼저 확인하세요.';
  }
  return 'Sheets·anchor 상태를 아래 순서대로 점검하세요.';
}

function buildActionHint(input: {
  status: GoogleFinanceSetupCheckResult['status'];
  sheetsAnchorOk: number;
  fallbackOnly: number;
  tabActionHint: string;
  statusNarrative: string;
}): string {
  if (input.status === 'not_configured') {
    return 'GOOGLE_SERVICE_ACCOUNT_JSON·GOOGLE_SHEETS_SPREADSHEET_ID를 설정하세요. 이 화면은 Sheets를 자동 수정하지 않습니다.';
  }
  return `${input.statusNarrative} ${input.tabActionHint}`.trim();
}

export async function runGoogleFinanceSetupCheck(): Promise<GoogleFinanceSetupCheckResult> {
  const generatedAt = new Date().toISOString();
  const configured = isGoogleFinanceQuoteConfigured();
  const sheetName = process.env.PORTFOLIO_QUOTES_SHEET_NAME?.trim() || 'portfolio_quotes';
  const warnings: string[] = [];

  let tabFound = false;
  let readSucceeded = false;
  let readbackUnavailable = false;
  let rowCount = 0;
  let okRows = 0;
  let parseFailedRows = 0;
  let missingRows = 0;
  let sheetRows: GoogleFinanceQuoteRow[] = [];

  const sheetTitles = configured ? await loadSpreadsheetTabTitles() : new Set<string>();

  if (configured) {
    try {
      const data = await readGoogleFinanceQuoteSheetRows();
      tabFound = data.tabFound ?? true;
      readSucceeded = true;
      sheetRows = data.rows;
      rowCount = data.rows.length;
      for (const row of data.rows) {
        if (row.rowStatus === 'ok') okRows += 1;
        else if (row.rowStatus === 'parse_failed') parseFailedRows += 1;
        else missingRows += 1;
      }
    } catch (e: unknown) {
      readbackUnavailable = true;
      warnings.push(e instanceof Error ? e.message : 'sheet_read_failed');
      readSucceeded = false;
      if (sheetTitles.has(sheetName)) tabFound = true;
    }
  } else {
    readbackUnavailable = true;
    warnings.push('googlefinance_not_configured');
  }

  const tabGuide = buildTabGuide({
    primaryTab: sheetName,
    configured,
    tabFound,
    readSucceeded,
    readbackUnavailable,
    sheetTitles,
  });

  const anchors = US_MARKET_SEED_ANCHORS.slice(0, ANCHOR_SAMPLE_COUNT);
  const anchorSymbols = anchors.map((a) => a.quoteSymbol);
  let yahooFailed = true;
  let yahooMap = new Map<string, { regularMarketPrice?: number }>();
  try {
    const yahoo = await fetchUsMarketYahooQuoteMap(anchorSymbols);
    yahooMap = yahoo.map;
    yahooFailed = yahoo.fetchFailed;
  } catch {
    yahooFailed = true;
  }

  let sheetsAnchorOk = 0;
  let fallbackOnly = 0;
  let missing = 0;
  let rangeOrPermissionError = 0;

  const results: GoogleFinanceAnchorResult[] = anchors.map((anchor) => {
    const row = readSucceeded ? findSheetRowForAnchor(sheetRows, anchor) : null;
    let readbackStatus = mapRowToReadbackStatus(row);
    let source: GoogleFinanceQuoteSource = 'unknown';
    let readbackPrice: number | undefined = row?.price;
    let actionHint: string | undefined;

    if (row && readbackStatus === 'ok' && readbackPrice != null && readbackPrice > 0) {
      source = 'google_sheets_readback';
      sheetsAnchorOk += 1;
    } else if (readbackStatus === 'parse_failed') {
      source = readSucceeded ? 'google_sheets_readback' : 'unknown';
      rangeOrPermissionError += 1;
      actionHint = 'Sheets 셀에 #REF!·#N/A가 없는지, range와 ticker prefix를 확인하세요.';
    } else if (!readSucceeded || !row) {
      const yahooRow = yahooMap.get(anchor.quoteSymbol.toUpperCase());
      const yPrice = Number(yahooRow?.regularMarketPrice ?? NaN);
      if (!yahooFailed && Number.isFinite(yPrice) && yPrice > 0) {
        source = 'yahoo_fallback';
        readbackStatus = 'missing';
        readbackPrice = yPrice;
        fallbackOnly += 1;
        actionHint =
          'fallback 데이터는 확인됐지만 Google Sheets read-back은 확인되지 않았습니다. Google Sheets에서 샘플 수식을 직접 확인하세요.';
      } else {
        source = 'unknown';
        missing += 1;
        actionHint = readbackUnavailable
          ? 'Sheets read-back을 사용할 수 없습니다. GOOGLE_SHEETS_SPREADSHEET_ID·서비스 계정을 확인하세요.'
          : `${anchor.googleTicker} 행이 portfolio_quotes에 없습니다. 샘플 표를 A1부터 붙여 넣으세요.`;
      }
    } else if (readbackStatus === 'stale') {
      source = 'google_sheets_readback';
      missing += 1;
      actionHint = 'GOOGLEFINANCE 계산이 대기 중일 수 있습니다. 1분 후 refresh·재확인하세요.';
    } else {
      source = 'google_sheets_readback';
      missing += 1;
      actionHint = 'price 셀이 비어 있으면 ticker prefix·수식 attribute를 확인하세요.';
    }

    const ok = readbackStatus === 'ok' && source === 'google_sheets_readback';

    return {
      key: anchor.key,
      label: anchor.label,
      symbol: anchor.quoteSymbol,
      googleTicker: anchor.googleTicker,
      expectedFormula: expectedFormula(anchor.googleTicker),
      readbackPrice,
      readbackStatus,
      source,
      lastCheckedAt: generatedAt,
      actionHint: actionHint ? `${sourceLabel(source, readbackStatus)} — ${actionHint}` : sourceLabel(source, readbackStatus),
      ok,
    };
  });

  const anchorRequested = anchors.length;
  let overallQuoteSource: GoogleFinanceSetupCheckResult['overallQuoteSource'] = 'unknown';
  if (sheetsAnchorOk > 0 && fallbackOnly > 0) overallQuoteSource = 'mixed';
  else if (sheetsAnchorOk > 0) overallQuoteSource = 'google_sheets_readback';
  else if (fallbackOnly > 0) overallQuoteSource = 'yahoo_fallback';

  let status: GoogleFinanceSetupCheckResult['status'] = 'ok';
  if (!configured) status = 'not_configured';
  else if (sheetsAnchorOk === 0 && fallbackOnly === 0) status = 'failed';
  else if (
    readbackUnavailable ||
    fallbackOnly > 0 ||
    sheetsAnchorOk < anchorRequested * 0.5 ||
    parseFailedRows > 0
  ) {
    status = 'degraded';
  }

  const statusNarrative = buildStatusNarrative({
    sheetsAnchorOk,
    fallbackOnly,
    rangeOrPermissionError,
    readbackUnavailable,
    status,
  });

  const usMarketGatingNote =
    'US 후보 일반 노출은 Sheets read-back 또는 신뢰 가능한 quote source가 충분할 때만 허용됩니다. anchor가 0이면 TSLA/NFLX 등은 일반 관찰 후보가 아니라 데이터 점검 카드로 분리됩니다.';

  const expectedTabs = [...tabGuide.probeOrder, ...tabGuide.legacyTabs];

  const setupChecklist = USER_SETUP_STEPS.map((s) => ({
    label: `${s.step}. ${s.label}`,
    description: s.description ?? '',
  }));

  const repairPlan = await buildGoogleSheetsRepairPlan();

  return {
    readOnly: true,
    status,
    generatedAt,
    overallQuoteSource,
    expectedTabs,
    tabGuide,
    sqlVsSheetsNote: SQL_VS_SHEETS_NOTE,
    statusNarrative,
    portfolioQuotesTab: {
      configuredName: sheetName,
      tabFound,
      readSucceeded,
      readbackUnavailable: readbackUnavailable || !configured,
      rowCount,
      okRows,
      parseFailedRows,
      missingRows,
    },
    usAnchor: {
      requested: anchorRequested,
      ok: sheetsAnchorOk,
      coverageLabel: `${sheetsAnchorOk}/${anchorRequested}`,
      fetchFailed: yahooFailed && !readSucceeded,
      emptyReason: sheetsAnchorOk === 0 ? (fallbackOnly > 0 ? 'fallback_only' : 'anchors_empty') : undefined,
      summary: {
        sheetsAnchorOk,
        fallbackOnly,
        missing,
        rangeOrPermissionError,
      },
      results,
    },
    usMarketGatingNote,
    sampleFormulas: SAMPLE_FORMULAS_PREFIXED,
    sampleFormulasUnprefixed: SAMPLE_FORMULAS_UNPREFIXED,
    portfolioQuotesSampleTsv: PORTFOLIO_QUOTES_SAMPLE_TSV,
    sampleTable: {
      columns: ['symbol', 'google_ticker', 'price', 'name', 'volume', 'marketcap', 'tradetime', 'status'],
      exampleRow: {
        symbol: 'SPY',
        google_ticker: 'NYSEARCA:SPY',
        price: '=IFERROR(GOOGLEFINANCE(B2,"price"),"")',
        name: '=IFERROR(GOOGLEFINANCE(B2,"name"),"")',
        volume: '',
        marketcap: '',
        tradetime: '',
        status: '=IF(C2="","missing","ok")',
      },
    },
    userSetupSteps: USER_SETUP_STEPS,
    setupChecklist,
    developerApis: DEVELOPER_APIS,
    actionHint: buildActionHint({
      status,
      sheetsAnchorOk,
      fallbackOnly,
      tabActionHint: tabGuide.tabActionHint,
      statusNarrative,
    }),
    warnings,
    repairPlan,
    repairModeNote: REPAIR_MODE_NOTE,
  };
}
