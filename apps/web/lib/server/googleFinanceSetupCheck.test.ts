import { describe, expect, it, vi, beforeEach } from 'vitest';

const readRows = vi.fn();
const isConfigured = vi.fn();
const fetchYahoo = vi.fn();
const getSpreadsheetSheets = vi.fn();
const sheetsValuesGet = vi.fn();

vi.mock('@/lib/server/googleFinanceSheetQuoteService', () => ({
  isGoogleFinanceQuoteConfigured: () => isConfigured(),
  readGoogleFinanceQuoteSheetRows: () => readRows(),
}));

vi.mock('@/lib/server/google-sheets-api', () => ({
  buildA1Range: (tab: string, range: string) => `'${tab}'!${range}`,
  sheetColumnLetter: (n: number) => (n <= 8 ? 'H' : 'O'),
  getSpreadsheetSheets: (...args: unknown[]) => getSpreadsheetSheets(...args),
  sheetsValuesGet: (...args: unknown[]) => sheetsValuesGet(...args),
  getSheetsAccessToken: vi.fn(async () => null),
}));

vi.mock('@/lib/server/usMarketMorningSummary', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/server/usMarketMorningSummary')>();
  return {
    ...mod,
    fetchUsMarketYahooQuoteMap: (...args: unknown[]) => fetchYahoo(...args),
  };
});

describe('runGoogleFinanceSetupCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isConfigured.mockReturnValue(false);
    readRows.mockResolvedValue({ tabFound: false, rows: [] });
    fetchYahoo.mockResolvedValue({ map: new Map(), fetchFailed: true });
    getSpreadsheetSheets.mockResolvedValue([]);
    sheetsValuesGet.mockResolvedValue([]);
  });

  it('includes repairPlan on GET check without mutating sheets', async () => {
    const { runGoogleFinanceSetupCheck } = await import('@/lib/server/googleFinanceSetupCheck');
    const out = await runGoogleFinanceSetupCheck();
    expect(out.repairPlan).toBeDefined();
    expect(out.repairPlan.requiresConfirmation).toBe(true);
    expect(out.repairModeNote).toMatch(/confirmed|read-only/i);
    expect(out.anchorRecovery).toBeDefined();
    expect(out.recoveryHeadline).toBeTruthy();
  });

  it('returns prefix sample formulas and readOnly when not configured', async () => {
    const { runGoogleFinanceSetupCheck } = await import('@/lib/server/googleFinanceSetupCheck');
    const out = await runGoogleFinanceSetupCheck();
    expect(out.readOnly).toBe(true);
    expect(out.sampleFormulas.some((f) => f.includes('NYSEARCA:SPY'))).toBe(true);
    expect(out.sampleFormulas.some((f) => f.includes('NASDAQ:QQQ'))).toBe(true);
    expect(out.sampleFormulas.some((f) => f.includes('NASDAQ:TSLA'))).toBe(true);
    expect(out.sampleFormulas.some((f) => f.includes('NYSEARCA:DIA'))).toBe(true);
    expect(out.sampleFormulasUnprefixed.some((f) => f.includes('"SPY"'))).toBe(true);
    expect(out.usAnchor.summary.sheetsAnchorOk).toBe(0);
    expect(out.status).toBe('not_configured');
    expect(out.actionHint).not.toMatch(/즉시\s*매수|자동\s*주문\s*실행/);
  });

  it('exposes primary vs fallback tab guide', async () => {
    isConfigured.mockReturnValue(true);
    getSpreadsheetSheets.mockResolvedValue([{ title: 'US_Anchor' }, { title: 'portfolio_quotes' }]);
    readRows.mockResolvedValue({ tabFound: true, rows: [] });
    fetchYahoo.mockResolvedValue({ map: new Map(), fetchFailed: true });

    const { runGoogleFinanceSetupCheck } = await import('@/lib/server/googleFinanceSetupCheck');
    const out = await runGoogleFinanceSetupCheck();
    expect(out.tabGuide.primaryTab).toBe('portfolio_quotes');
    expect(out.tabGuide.fallbackTabs).toContain('US_Anchor');
    expect(out.tabGuide.probes.find((p) => p.name === 'portfolio_quotes')?.role).toBe('primary');
    expect(out.userSetupSteps.length).toBeGreaterThanOrEqual(7);
    expect(out.actionHint).toMatch(/portfolio_quotes|샘플|Sheets/i);
  });

  it('includes portfolio_quotes sample TSV with prefixed tickers', async () => {
    const { PORTFOLIO_QUOTES_SAMPLE_TSV, runGoogleFinanceSetupCheck } = await import(
      '@/lib/server/googleFinanceSetupCheck'
    );
    expect(PORTFOLIO_QUOTES_SAMPLE_TSV).toContain('NYSEARCA:SPY');
    expect(PORTFOLIO_QUOTES_SAMPLE_TSV).toContain('NASDAQ:QQQ');
    expect(PORTFOLIO_QUOTES_SAMPLE_TSV).toContain('NASDAQ:TSLA');
    const out = await runGoogleFinanceSetupCheck();
    expect(out.portfolioQuotesSampleTsv).toContain('NYSEARCA:SPY');
  });

  it('simplified rows with SPY/QQQ/TSLA yield sheetsAnchorOk > 0', async () => {
    isConfigured.mockReturnValue(true);
    readRows.mockResolvedValue({
      tabFound: true,
      rows: [
        { market: 'US', symbol: 'SPY', googleTicker: 'NYSEARCA:SPY', normalizedKey: 'US:SPY', price: 500, rowStatus: 'ok' },
        { market: 'US', symbol: 'QQQ', googleTicker: 'NASDAQ:QQQ', normalizedKey: 'US:QQQ', price: 400, rowStatus: 'ok' },
        { market: 'US', symbol: 'TSLA', googleTicker: 'NASDAQ:TSLA', normalizedKey: 'US:TSLA', sheetStatus: 'ok', rawPrice: '200' },
        { market: 'US', symbol: 'NVDA', googleTicker: 'NASDAQ:NVDA', normalizedKey: 'US:NVDA', price: 900, rowStatus: 'ok' },
      ],
    });
    fetchYahoo.mockResolvedValue({ map: new Map(), fetchFailed: true });

    const { runGoogleFinanceSetupCheck } = await import('@/lib/server/googleFinanceSetupCheck');
    const out = await runGoogleFinanceSetupCheck();
    expect(out.usAnchor.summary.sheetsAnchorOk).toBeGreaterThan(0);
    expect(out.usAnchor.summary.parsedRowsOk).toBeGreaterThan(0);
    expect(out.usAnchor.summary.sheetsAnchorMatched).toBeGreaterThan(0);
  });

  it('rows ok but anchor ok 0 sets anchorRowMatchMismatch warning', async () => {
    isConfigured.mockReturnValue(true);
    readRows.mockResolvedValue({
      tabFound: true,
      rows: [
        { market: 'US', symbol: 'RANDOM', googleTicker: 'NASDAQ:RANDOM', normalizedKey: 'US:RANDOM', price: 10, rowStatus: 'ok' },
      ],
    });
    fetchYahoo.mockResolvedValue({ map: new Map(), fetchFailed: true });

    const { runGoogleFinanceSetupCheck } = await import('@/lib/server/googleFinanceSetupCheck');
    const out = await runGoogleFinanceSetupCheck();
    expect(out.usAnchor.summary.parsedRowsOk).toBeGreaterThan(0);
    expect(out.usAnchor.summary.sheetsAnchorOk).toBe(0);
    expect(out.usAnchor.summary.anchorRowMatchMismatch).toBe(true);
    expect(out.actionHint).toMatch(/anchor symbol 매칭/);
  });

  it('marks Sheets read-back ok with google_sheets_readback source', async () => {
    isConfigured.mockReturnValue(true);
    readRows.mockResolvedValue({
      tabFound: true,
      rows: [
        {
          market: 'US',
          symbol: 'SPY',
          googleTicker: 'NYSEARCA:SPY',
          normalizedKey: 'US:SPY',
          price: 500,
          rowStatus: 'ok',
        },
      ],
    });
    fetchYahoo.mockResolvedValue({
      map: new Map([['SPY', { regularMarketPrice: 499 }]]),
      fetchFailed: false,
    });

    const { runGoogleFinanceSetupCheck } = await import('@/lib/server/googleFinanceSetupCheck');
    const out = await runGoogleFinanceSetupCheck();
    const spy = out.usAnchor.results.find((r) => r.symbol === 'SPY');
    expect(spy?.source).toBe('google_sheets_readback');
    expect(spy?.ok).toBe(true);
    expect(out.status).not.toBe('ok');
  });

  it('fallback only yields degraded without ok flag', async () => {
    isConfigured.mockReturnValue(true);
    readRows.mockResolvedValue({ tabFound: true, rows: [] });
    fetchYahoo.mockImplementation(async (symbols: string[]) => {
      const map = new Map<string, { regularMarketPrice: number }>();
      for (const s of symbols) map.set(s.toUpperCase(), { regularMarketPrice: 100 });
      return { map, fetchFailed: false };
    });

    const { runGoogleFinanceSetupCheck } = await import('@/lib/server/googleFinanceSetupCheck');
    const out = await runGoogleFinanceSetupCheck();
    expect(out.usAnchor.summary.fallbackOnly).toBeGreaterThan(0);
    expect(out.usAnchor.summary.sheetsAnchorOk).toBe(0);
    expect(out.status).toBe('degraded');
    expect(out.statusNarrative).toMatch(/fallback|degraded/i);
    const fb = out.usAnchor.results.find((r) => r.source === 'yahoo_fallback');
    expect(fb?.ok).toBe(false);
  });

  it('primary tab missing suggests sample table action', async () => {
    isConfigured.mockReturnValue(true);
    getSpreadsheetSheets.mockResolvedValue([{ title: 'US_Anchor' }]);
    readRows.mockResolvedValue({ tabFound: false, rows: [] });
    fetchYahoo.mockResolvedValue({ map: new Map(), fetchFailed: true });

    const { runGoogleFinanceSetupCheck } = await import('@/lib/server/googleFinanceSetupCheck');
    const out = await runGoogleFinanceSetupCheck();
    expect(out.tabGuide.probes.find((p) => p.name === 'portfolio_quotes')?.status).toBe('missing');
    expect(out.tabGuide.tabActionHint).toMatch(/portfolio_quotes|샘플 표|A1/i);
  });
});
