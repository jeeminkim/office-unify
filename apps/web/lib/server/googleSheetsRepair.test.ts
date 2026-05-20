import { describe, expect, it, vi, beforeEach } from 'vitest';

const getSpreadsheetSheets = vi.fn();
const sheetsValuesGet = vi.fn();
const sheetsValuesUpdate = vi.fn();
const getSheetsAccessToken = vi.fn();

vi.mock('@/lib/server/google-sheets-api', () => ({
  buildA1Range: (tab: string, range: string) => `'${tab}'!${range}`,
  sheetColumnLetter: (n: number) => (n <= 10 ? 'J' : 'O'),
  getSpreadsheetSheets: (...args: unknown[]) => getSpreadsheetSheets(...args),
  sheetsValuesGet: (...args: unknown[]) => sheetsValuesGet(...args),
  sheetsValuesUpdate: (...args: unknown[]) => sheetsValuesUpdate(...args),
  getSheetsAccessToken: () => getSheetsAccessToken(),
}));

vi.mock('@/lib/server/googleFinanceSetupCheck', () => ({
  runGoogleFinanceSetupCheck: vi.fn(async () => ({
    usAnchor: {
      summary: {
        sheetsAnchorOk: 2,
        missing: 16,
        parsedRowsOk: 5,
        sheetsAnchorMatched: 3,
        missingAnchorSymbols: ['SPY'],
      },
    },
    anchorRecovery: { nextStep: 'wait and refresh' },
    actionHint: 'post-check hint',
  })),
}));

describe('googleSheetsRepair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    getSheetsAccessToken.mockResolvedValue('token');
    getSpreadsheetSheets.mockResolvedValue([]);
    sheetsValuesGet.mockResolvedValue([]);
    sheetsValuesUpdate.mockResolvedValue(undefined);
  });

  it('buildPortfolioQuotesSampleGrid includes NYSEARCA:SPY and NASDAQ:TSLA', async () => {
    const { buildPortfolioQuotesSampleGrid } = await import('@/lib/server/googleSheetsRepair');
    const grid = buildPortfolioQuotesSampleGrid();
    const flat = grid.flat().join('\t');
    expect(flat).toContain('NYSEARCA:SPY');
    expect(flat).toContain('NASDAQ:QQQ');
    expect(flat).toContain('NYSEARCA:IWM');
    expect(flat).toContain('NYSEARCA:XLK');
    expect(flat).toContain('NASDAQ:TSLA');
    expect(flat).toContain('checked_at');
    expect(flat).toContain('direct_repair');
    expect(grid[0]?.[0]).toBe('symbol');
  });

  it('empty portfolio_quotes plan includes write_headers and write_sample_formulas', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', '{"client_email":"svc@test.iam.gserviceaccount.com","private_key":"x"}');
    vi.stubEnv('GOOGLE_SHEETS_SPREADSHEET_ID', 'sheet-id');
    getSpreadsheetSheets.mockResolvedValue([]);
    sheetsValuesGet.mockRejectedValue(new Error('tab missing'));

    const { buildGoogleSheetsRepairPlan } = await import('@/lib/server/googleSheetsRepair');
    const plan = await buildGoogleSheetsRepairPlan();
    expect(plan.writeAvailable).toBe(true);
    expect(plan.operations.some((o) => o.type === 'create_sheet')).toBe(true);
    expect(plan.operations.some((o) => o.type === 'write_headers')).toBe(true);
    expect(plan.operations.some((o) => o.type === 'write_sample_formulas')).toBe(true);
    expect(plan.actionHint).not.toMatch(/자동\s*주문|즉시\s*매수/);
  });

  it('existing sheet missing anchors suggests append_missing_anchor_rows', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', '{"client_email":"svc@test.iam.gserviceaccount.com","private_key":"x"}');
    vi.stubEnv('GOOGLE_SHEETS_SPREADSHEET_ID', 'sheet-id');
    getSpreadsheetSheets.mockResolvedValue([{ title: 'portfolio_quotes', sheetId: 1 }]);
    const header = ['symbol', 'google_ticker', 'price', 'name', 'volume', 'marketcap', 'tradetime', 'status'];
    sheetsValuesGet.mockResolvedValue([header, ['RANDOM', 'NASDAQ:RANDOM', '10', '', '', '', '', 'ok']]);

    const { buildGoogleSheetsRepairPlan } = await import('@/lib/server/googleSheetsRepair');
    const plan = await buildGoogleSheetsRepairPlan([
      {
        market: 'US',
        symbol: 'RANDOM',
        googleTicker: 'NASDAQ:RANDOM',
        normalizedKey: 'US:RANDOM',
        price: 10,
        rowStatus: 'ok',
      },
    ]);
    expect(plan.operations.some((o) => o.type === 'append_missing_anchor_rows')).toBe(true);
    expect(plan.operations.find((o) => o.type === 'append_missing_anchor_rows')?.previewValues?.[0]?.[0]).toBe('SPY');
  });

  it('existing anchor row with blank ticker or formulas suggests safe fill operation', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', '{"client_email":"svc@test.iam.gserviceaccount.com","private_key":"x"}');
    vi.stubEnv('GOOGLE_SHEETS_SPREADSHEET_ID', 'sheet-id');
    getSpreadsheetSheets.mockResolvedValue([{ title: 'portfolio_quotes', sheetId: 1 }]);
    sheetsValuesGet.mockResolvedValue([
      ['symbol', 'google_ticker', 'price', 'name', 'volume', 'marketcap', 'tradetime', 'status', 'checked_at', 'source'],
      ['SPY', '', '', '', '', '', '', '', '', ''],
    ]);

    const { buildGoogleSheetsRepairPlan } = await import('@/lib/server/googleSheetsRepair');
    const plan = await buildGoogleSheetsRepairPlan([
      {
        market: 'US',
        symbol: 'SPY',
        googleTicker: '',
        normalizedKey: 'US:SPY',
        rowStatus: 'formula_pending',
      },
    ]);
    const fill = plan.operations.find((o) => o.type === 'fill_missing_anchor_formulas');
    expect(fill?.operationId).toBe('fill_anchor_formula_spy');
    expect(fill?.previewValues?.[0]?.[1]).toBe('NYSEARCA:SPY');
    expect(fill?.previewValues?.[0]?.[2]).toContain('GOOGLEFINANCE');
  });

  it('existing non-empty sheet blocks unsafe header rewrite', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', '{"client_email":"svc@test.iam.gserviceaccount.com","private_key":"x"}');
    vi.stubEnv('GOOGLE_SHEETS_SPREADSHEET_ID', 'sheet-id');
    getSpreadsheetSheets.mockResolvedValue([{ title: 'portfolio_quotes', sheetId: 1 }]);
    sheetsValuesGet.mockResolvedValue([
      ['symbol', 'google_ticker'],
      ['SPY', 'NYSEARCA:SPY', '500'],
    ]);

    const { buildGoogleSheetsRepairPlan } = await import('@/lib/server/googleSheetsRepair');
    const plan = await buildGoogleSheetsRepairPlan([
      { market: 'US', symbol: 'SPY', googleTicker: 'NYSEARCA:SPY', normalizedKey: 'US:SPY', price: 1, rowStatus: 'ok' },
    ]);
    expect(plan.status === 'unsafe' || plan.operations.some((o) => o.type === 'append_missing_anchor_rows')).toBe(true);
    expect(plan.operations.some((o) => o.blockedReason === 'partial_headers_with_data')).toBe(true);
  });

  it('apply without confirm returns confirmation_required', async () => {
    const { applyGoogleSheetsRepair } = await import('@/lib/server/googleSheetsRepair');
    const out = await applyGoogleSheetsRepair({ confirm: false });
    expect(out.status).toBe('confirmation_required');
    expect(sheetsValuesUpdate).not.toHaveBeenCalled();
  });

  it('apply confirm true calls sheetsValuesUpdate when plan has sample write', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', '{"client_email":"svc@test.iam.gserviceaccount.com","private_key":"x"}');
    vi.stubEnv('GOOGLE_SHEETS_SPREADSHEET_ID', 'sheet-id');
    getSpreadsheetSheets.mockResolvedValue([]);
    sheetsValuesGet.mockResolvedValue([]);

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes(':batchUpdate') && init?.method === 'POST') {
        return new Response(JSON.stringify({ replies: [{ addSheet: { properties: { sheetId: 9 } } }] }), {
          status: 200,
        });
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    const { applyGoogleSheetsRepair } = await import('@/lib/server/googleSheetsRepair');
    const out = await applyGoogleSheetsRepair({
      confirm: true,
      idempotencyKey: 'test-apply-1',
    });
    expect(out.qualityMeta.confirmed).toBe(true);
    expect(out.qualityMeta.writeAction).toBe(true);
    expect(out.postCheck?.sheetsOkCount).toBe(2);
    expect(out.formulaPendingCount).toBe(1);
    expect(out.recommendedNextAction).toMatch(/Today Brief|다시 실행/);
    expect(sheetsValuesUpdate.mock.calls.length).toBeGreaterThan(0);
  });

  it('repair core dry-run builds plan without write calls', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', '{"client_email":"svc@test.iam.gserviceaccount.com","private_key":"x"}');
    vi.stubEnv('GOOGLE_SHEETS_SPREADSHEET_ID', 'sheet-id');
    getSpreadsheetSheets.mockResolvedValue([{ title: 'portfolio_quotes', sheetId: 1 }]);
    sheetsValuesGet.mockResolvedValue([
      ['symbol', 'google_ticker', 'price', 'name', 'volume', 'marketcap', 'tradetime', 'status'],
      ['SPY', 'NYSEARCA:SPY', '', '', '', '', '', 'pending'],
    ]);
    const { runGoogleSheetsRepairCore } = await import('@/lib/server/googleSheetsRepair');
    const out = await runGoogleSheetsRepairCore({ confirm: false, dryRun: true });
    expect(out.dryRun).toBe(true);
    expect(out.repairPlan).toBeTruthy();
    expect(sheetsValuesUpdate).not.toHaveBeenCalled();
  });

  it('write unavailable when credential missing', async () => {
    const { buildGoogleSheetsRepairPlan } = await import('@/lib/server/googleSheetsRepair');
    const plan = await buildGoogleSheetsRepairPlan();
    expect(plan.status).toBe('write_not_available');
    expect(plan.writeAvailable).toBe(false);
    expect(plan.actionHint).toMatch(/read-only|write|Editor/i);
  });

  it('masks service account email without exposing private key', async () => {
    const { inspectGoogleSheetsCredentialMeta } = await import('@/lib/server/googleSheetsRepairCredential');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_JSON', '{"client_email":"my-sa@proj.iam.gserviceaccount.com","private_key":"SECRET"}');
    vi.stubEnv('GOOGLE_SHEETS_SPREADSHEET_ID', 'id');
    getSheetsAccessToken.mockResolvedValue('tok');
    const meta = await inspectGoogleSheetsCredentialMeta();
    expect(meta.serviceAccountEmailMasked).toContain('@proj.iam.gserviceaccount.com');
    expect(meta.serviceAccountEmailMasked).not.toContain('SECRET');
    expect(JSON.stringify(meta)).not.toContain('private_key');
  });
});
