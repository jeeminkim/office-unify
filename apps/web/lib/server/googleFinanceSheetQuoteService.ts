import 'server-only';

import { sheetsValuesGet, sheetsValuesUpdate } from '@/lib/server/google-sheets-api';

type HoldingInput = {
  market: string;
  symbol: string;
  displayName?: string;
};

export type GoogleFinanceQuoteRow = {
  market: string;
  symbol: string;
  price?: number;
  currency?: string;
  tradetime?: string;
  datadelay?: number;
  updatedAt?: string;
};

function spreadsheetId(): string | null {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || null;
}

function tabName(): string {
  return process.env.PORTFOLIO_QUOTES_SHEET_NAME?.trim() || 'portfolio_quotes';
}

function toGoogleTicker(market: string, symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (market === 'KR') {
    if (/^\d{6}$/.test(s)) return `KRX:${s}`;
    return `KRX:${s}`;
  }
  return s;
}

function rowFormula(tickerCell: string, field: 'price' | 'currency' | 'tradetime' | 'datadelay'): string {
  return `=IFERROR(GOOGLEFINANCE(${tickerCell},"${field}"),)`;
}

function parseNumber(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : undefined;
}

export function isGoogleFinanceQuoteConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() && spreadsheetId());
}

export async function syncGoogleFinanceQuoteSheetRows(holdings: HoldingInput[]): Promise<void> {
  const id = spreadsheetId();
  if (!id) throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set');
  const tab = tabName();
  const header = [
    'market',
    'symbol',
    'display_name',
    'google_ticker',
    'price_formula',
    'price',
    'currency_formula',
    'currency',
    'tradetime_formula',
    'tradetime',
    'datadelay_formula',
    'datadelay',
    'updated_at',
  ];
  const rows = holdings.map((h, idx) => {
    const r = idx + 2;
    const ticker = toGoogleTicker(h.market, h.symbol);
    return [
      h.market,
      h.symbol.toUpperCase(),
      h.displayName ?? h.symbol.toUpperCase(),
      ticker,
      rowFormula(`D${r}`, 'price'),
      '',
      rowFormula(`D${r}`, 'currency'),
      '',
      rowFormula(`D${r}`, 'tradetime'),
      '',
      rowFormula(`D${r}`, 'datadelay'),
      '',
      new Date().toISOString(),
    ];
  });
  const fxRow = holdings.length + 2;
  rows.push([
    'FX',
    'USDKRW',
    'USDKRW',
    'CURRENCY:USDKRW',
    rowFormula(`D${fxRow}`, 'price'),
    '',
    rowFormula(`D${fxRow}`, 'currency'),
    '',
    rowFormula(`D${fxRow}`, 'tradetime'),
    '',
    rowFormula(`D${fxRow}`, 'datadelay'),
    '',
    new Date().toISOString(),
  ]);
  await sheetsValuesUpdate({
    spreadsheetId: id,
    rangeA1: `${tab}!A1`,
    values: [header, ...rows],
    valueInputOption: 'USER_ENTERED',
  });
}

export async function readGoogleFinanceQuoteSheetRows(): Promise<{
  rows: GoogleFinanceQuoteRow[];
  fxRate?: number;
  readBackSucceeded: boolean;
}> {
  const id = spreadsheetId();
  if (!id) throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set');
  const tab = tabName();
  const values = await sheetsValuesGet({ spreadsheetId: id, rangeA1: `${tab}!A2:M500` });
  if (values.length === 0) {
    return { rows: [], fxRate: undefined, readBackSucceeded: false };
  }
  const rows: GoogleFinanceQuoteRow[] = [];
  let fxRate: number | undefined;
  values.forEach((row) => {
    const market = String(row[0] ?? '').trim().toUpperCase();
    const symbol = String(row[1] ?? '').trim().toUpperCase();
    if (!market || !symbol) return;
    const price = parseNumber(row[5]);
    const datadelay = parseNumber(row[11]);
    if (market === 'FX' && symbol === 'USDKRW') {
      fxRate = price;
      return;
    }
    rows.push({
      market,
      symbol,
      price,
      currency: row[7] ? String(row[7]) : undefined,
      tradetime: row[9] ? String(row[9]) : undefined,
      datadelay,
      updatedAt: row[12] ? String(row[12]) : undefined,
    });
  });
  return { rows, fxRate, readBackSucceeded: rows.length > 0 };
}

