import 'server-only';

import { buildA1Range, ensureSheetTab, sheetsValuesGet, sheetsValuesUpdate } from '@/lib/server/google-sheets-api';
import { isGoogleFinanceQuoteConfigured } from '@/lib/server/googleFinanceSheetQuoteService';
import { googleSheetCellAsString, parseGoogleFinanceSheetNumber } from '@/lib/server/quoteReadbackUtils';
import type { SectorRadarAnchorDataStatus } from '@/lib/sectorRadarContract';
import type { MergedSectorRadarAnchor } from '@/lib/server/sectorRadarRegistry';
import { SECTOR_RADAR_SHEET_NAME } from '@/lib/server/sectorRadarRegistry';
import type { AnchorMetricRow } from '@/lib/server/sectorRadarScoring';
import { classifyDataStatus } from '@/lib/server/sectorRadarScoring';

function spreadsheetId(): string | null {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || null;
}

function asFormulaHintText(formula: string): string {
  const t = formula.trim();
  if (t.startsWith("'")) return t;
  return `'${t}`;
}

function gfField(eCell: string, field: string): string {
  return `=IFERROR(GOOGLEFINANCE(${eCell},"${field}"),)`;
}

const HEADER = [
  'category_key',
  'category_name',
  'anchor_symbol',
  'anchor_name',
  'google_ticker',
  'price_formula_text',
  'price',
  'volume_formula_text',
  'volume',
  'change_pct_formula_text',
  'change_pct',
  'high_52w_formula_text',
  'high_52w',
  'low_52w_formula_text',
  'low_52w',
  'volume_avg_formula_text',
  'volume_avg',
  'datadelay_formula_text',
  'datadelay',
  'last_synced_at',
];

export function isSectorRadarSheetsConfigured(): boolean {
  return isGoogleFinanceQuoteConfigured();
}

export type SectorRadarSheetReadRow = {
  categoryKey: string;
  categoryName: string;
  anchorSymbol: string;
  anchorName: string;
  googleTicker: string;
  rawPrice: string;
  rawVolume: string;
  rawChangePct: string;
  rawHigh52: string;
  rawLow52: string;
  rawVolumeAvg: string;
  rawDatadelay: string;
  price?: number;
  volume?: number;
  changePct?: number;
  high52?: number;
  low52?: number;
  volumeAvg?: number;
  datadelay?: number;
  priceStatus: SectorRadarAnchorDataStatus;
  rowStatus: SectorRadarAnchorDataStatus;
  message: string;
};

function classifyValue(raw: string, parsed: number | undefined): SectorRadarAnchorDataStatus {
  if (parsed != null && Number.isFinite(parsed)) return 'ok';
  if (!raw) return 'empty';
  const u = raw.toUpperCase();
  if (u.includes('LOADING')) return 'pending';
  if (['#N/A', 'N/A'].includes(u)) return 'empty';
  if (u.startsWith('#')) return 'parse_failed';
  return 'pending';
}

function worstStatus(a: SectorRadarAnchorDataStatus, b: SectorRadarAnchorDataStatus): SectorRadarAnchorDataStatus {
  const rank: Record<SectorRadarAnchorDataStatus, number> = {
    ok: 0,
    pending: 1,
    empty: 2,
    parse_failed: 3,
  };
  return rank[a] >= rank[b] ? a : b;
}

export async function syncSectorRadarQuoteSheetRows(anchors: MergedSectorRadarAnchor[]): Promise<{ refreshedCount: number }> {
  const id = spreadsheetId();
  if (!id) throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set');
  const tab = SECTOR_RADAR_SHEET_NAME;
  await ensureSheetTab({ spreadsheetId: id, title: tab, header: HEADER });
  const syncedAt = new Date().toISOString();
  const body: string[][] = anchors.map((a, idx) => {
    const r = idx + 2;
    const eCell = `E${r}`;
    const gPrice = gfField(eCell, 'price');
    const gVol = gfField(eCell, 'volume');
    const gChg = gfField(eCell, 'changepct');
    const gHi = gfField(eCell, 'high52');
    const gLo = gfField(eCell, 'low52');
    const gDelay = gfField(eCell, 'datadelay');
    return [
      a.categoryKey,
      a.categoryName,
      a.symbol,
      a.name,
      a.googleTicker.trim().toUpperCase(),
      asFormulaHintText(gPrice),
      gPrice,
      asFormulaHintText(gVol),
      gVol,
      asFormulaHintText(gChg),
      gChg,
      asFormulaHintText(gHi),
      gHi,
      asFormulaHintText(gLo),
      gLo,
      `'volume_avg (1차 미계산 — NO_DATA 가능)`,
      '',
      asFormulaHintText(gDelay),
      gDelay,
      syncedAt,
    ];
  });
  const values = body.length > 0 ? [HEADER, ...body] : [HEADER];
  await sheetsValuesUpdate({
    spreadsheetId: id,
    rangeA1: buildA1Range(tab, `A1:T${values.length}`),
    values,
    valueInputOption: 'USER_ENTERED',
  });
  return { refreshedCount: anchors.length };
}

export async function readSectorRadarQuoteSheetRows(): Promise<{
  rows: SectorRadarSheetReadRow[];
  tabFound: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const id = spreadsheetId();
  if (!id) {
    warnings.push('spreadsheet_id_missing');
    return { rows: [], tabFound: false, warnings };
  }
  const tab = SECTOR_RADAR_SHEET_NAME;
  let values: unknown[][];
  try {
    values = await sheetsValuesGet({
      spreadsheetId: id,
      rangeA1: buildA1Range(tab, 'A2:T500'),
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });
  } catch {
    try {
      values = await sheetsValuesGet({
        spreadsheetId: id,
        rangeA1: buildA1Range(tab, 'A2:T500'),
        valueRenderOption: 'FORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      });
    } catch (e: unknown) {
      warnings.push(e instanceof Error ? e.message : 'sector_radar_sheet_read_failed');
      return { rows: [], tabFound: false, warnings };
    }
  }
  if (!values.length) {
    return { rows: [], tabFound: true, warnings: ['sector_radar_sheet_empty'] };
  }

  const rows: SectorRadarSheetReadRow[] = [];
  for (const row of values) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const categoryKey = googleSheetCellAsString(row[0]);
    const anchorSymbol = googleSheetCellAsString(row[2]);
    if (!categoryKey || !anchorSymbol) continue;
    const rawPrice = googleSheetCellAsString(row[6]);
    const rawVolume = googleSheetCellAsString(row[8]);
    const rawChangePct = googleSheetCellAsString(row[10]);
    const rawHigh52 = googleSheetCellAsString(row[12]);
    const rawLow52 = googleSheetCellAsString(row[14]);
    const rawVolumeAvg = googleSheetCellAsString(row[16]);
    const rawDatadelay = googleSheetCellAsString(row[18]);
    const price = parseGoogleFinanceSheetNumber(row[6]);
    const volume = parseGoogleFinanceSheetNumber(row[8]);
    const changePct = parseGoogleFinanceSheetNumber(row[10]);
    const high52 = parseGoogleFinanceSheetNumber(row[12]);
    const low52 = parseGoogleFinanceSheetNumber(row[14]);
    const volumeAvg = parseGoogleFinanceSheetNumber(row[16]);
    const datadelay = parseGoogleFinanceSheetNumber(row[18]);
    const priceStatus = classifyValue(rawPrice, price);
    const rowStatus = [
      classifyValue(rawPrice, price),
      classifyValue(rawVolume, volume),
      classifyValue(rawChangePct, changePct),
    ].reduce(worstStatus, 'ok');
    const message =
      priceStatus === 'ok'
        ? 'price ok'
        : priceStatus === 'pending'
          ? 'Sheets 계산 대기'
          : priceStatus === 'parse_failed'
            ? '가격 파싱 실패'
            : '가격 데이터 없음';
    rows.push({
      categoryKey,
      categoryName: googleSheetCellAsString(row[1]),
      anchorSymbol,
      anchorName: googleSheetCellAsString(row[3]),
      googleTicker: googleSheetCellAsString(row[4]),
      rawPrice,
      rawVolume,
      rawChangePct,
      rawHigh52,
      rawLow52,
      rawVolumeAvg,
      rawDatadelay,
      price,
      volume,
      changePct,
      high52,
      low52,
      volumeAvg,
      datadelay,
      priceStatus,
      rowStatus,
      message,
    });
  }
  return { rows, tabFound: true, warnings };
}

/** 시트 read + seed/watchlist 메타 병합 → 점수용 앵커 행 */
export function mergeSheetRowsWithAnchors(
  anchors: MergedSectorRadarAnchor[],
  sheetRows: SectorRadarSheetReadRow[],
): AnchorMetricRow[] {
  const key = (cat: string, sym: string) => `${cat}:${sym.trim().padStart(6, '0')}`;
  const sheetMap = new Map<string, SectorRadarSheetReadRow>();
  for (const s of sheetRows) {
    sheetMap.set(key(s.categoryKey, s.anchorSymbol), s);
  }
  return anchors.map((a) => {
    const s = sheetMap.get(key(a.categoryKey, a.symbol));
    if (!s) {
      return {
        symbol: a.symbol,
        name: a.name,
        googleTicker: a.googleTicker,
        sourceLabel: a.sourceLabel,
        dataStatus: classifyDataStatus(undefined, undefined),
      };
    }
    return {
      symbol: a.symbol,
      name: a.name,
      googleTicker: a.googleTicker,
      sourceLabel: a.sourceLabel,
      price: s.price,
      volume: s.volume,
      changePct: s.changePct,
      high52: s.high52,
      low52: s.low52,
      volumeAvg: s.volumeAvg,
      dataStatus: classifyDataStatus(s.rawPrice, s.price),
    };
  });
}
