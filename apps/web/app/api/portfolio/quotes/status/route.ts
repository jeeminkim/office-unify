import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import {
  isGoogleFinanceQuoteConfigured,
  readGoogleFinanceQuoteSheetRows,
} from '@/lib/server/googleFinanceSheetQuoteService';

export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  if (!isGoogleFinanceQuoteConfigured()) {
    return NextResponse.json({
      ok: false,
      provider: 'none',
      readBackSucceeded: false,
      message: 'Google Sheets quote provider is not configured.',
    });
  }
  try {
    const data = await readGoogleFinanceQuoteSheetRows();
    const validRows = data.rows.filter((row) => row.price != null);
    return NextResponse.json({
      ok: true,
      provider: 'google_sheets_googlefinance',
      readBackSucceeded: data.readBackSucceeded,
      quoteRowCount: data.rows.length,
      validQuoteRowCount: validRows.length,
      fxAvailable: data.fxRate != null,
      delayed: true,
      maxDelayMinutes:
        validRows.length > 0
          ? Math.max(...validRows.map((row) => Number(row.datadelay ?? 0)))
          : undefined,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, provider: 'google_sheets_googlefinance', error: message }, { status: 500 });
  }
}

