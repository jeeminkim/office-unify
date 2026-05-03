import { NextResponse } from 'next/server';
import { requirePersonaChatAuth } from '@/lib/server/persona-chat-auth';
import { isSectorRadarSheetsConfigured, readSectorRadarQuoteSheetRows } from '@/lib/server/sectorRadarSheetService';
import type { SectorRadarStatusResponse, SectorRadarStatusRow } from '@/lib/sectorRadarContract';

export async function GET() {
  const auth = await requirePersonaChatAuth();
  if (!auth.ok) return auth.response;
  if (!isSectorRadarSheetsConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        total: 0,
        okCount: 0,
        pendingCount: 0,
        emptyCount: 0,
        rows: [],
        warnings: ['google_sheets_not_configured'],
      } satisfies SectorRadarStatusResponse,
      { status: 503 },
    );
  }
  const warnings: string[] = [];
  try {
    const { rows, tabFound, warnings: w } = await readSectorRadarQuoteSheetRows();
    warnings.push(...w);
    if (!tabFound) warnings.push('sector_radar_tab_missing_or_unreadable');
    const mapped: SectorRadarStatusRow[] = rows.map((r) => ({
      categoryKey: r.categoryKey,
      market: r.market,
      anchorSymbol: r.anchorSymbol,
      googleTicker: r.googleTicker,
      rawPrice: r.rawPrice,
      parsedPrice: r.price,
      rawVolume: r.rawVolume,
      parsedVolume: r.volume,
      rawVolumeAvg: r.rawVolumeAvg,
      parsedVolumeAvg: r.volumeAvg,
      rawChangePct: r.rawChangePct,
      parsedChangePct: r.changePct,
      rowStatus: r.rowStatus,
      message: r.message,
    }));
    const okCount = mapped.filter((x) => x.rowStatus === 'ok').length;
    const pendingCount = mapped.filter((x) => x.rowStatus === 'pending').length;
    const emptyCount = mapped.filter((x) => x.rowStatus === 'empty').length;
    return NextResponse.json({
      ok: true,
      total: mapped.length,
      okCount,
      pendingCount,
      emptyCount,
      rows: mapped,
      warnings: Array.from(new Set(warnings)),
    } satisfies SectorRadarStatusResponse);
  } catch (e: unknown) {
    warnings.push(e instanceof Error ? e.message : 'status_read_failed');
    return NextResponse.json(
      {
        ok: false,
        total: 0,
        okCount: 0,
        pendingCount: 0,
        emptyCount: 0,
        rows: [],
        warnings,
      } satisfies SectorRadarStatusResponse,
      { status: 200 },
    );
  }
}
