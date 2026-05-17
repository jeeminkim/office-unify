import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SectorRadarSnapshotMeta } from '@office-unify/shared-types';
import type { SectorRadarSummaryResponse } from '@/lib/sectorRadarContract';

const RUNS = 'sector_radar_runs';
const ITEMS = 'sector_radar_items';

const STALE_DAYS = 3;

function isTableMissing(msg: string): boolean {
  return msg.includes('sector_radar_runs') || msg.includes('does not exist') || msg.includes('schema cache');
}

export async function saveSectorRadarSnapshot(params: {
  supabase: SupabaseClient;
  userKey: string;
  summary: SectorRadarSummaryResponse;
  requestId?: string;
  inputContext?: Record<string, unknown>;
}): Promise<SectorRadarSnapshotMeta> {
  const { supabase, userKey, summary } = params;
  const qm = summary.qualityMeta?.sectorRadar;
  const degraded = Boolean(qm && (qm.noDataCount > 0 || (qm.quoteMissingSectors ?? 0) > 0));
  const status = summary.ok === false ? 'degraded' : degraded ? 'degraded' : 'ok';

  try {
    const { data: runRow, error: runErr } = await supabase
      .from(RUNS)
      .insert({
        user_key: userKey,
        request_id: params.requestId ?? null,
        status,
        provider: 'google_sheets',
        degraded,
        reason_code: degraded ? 'batch_degraded' : null,
        summary: summary.sectors?.slice(0, 3).map((s) => s.name).join(', ') ?? '',
        quality_meta: summary.qualityMeta ?? {},
        input_context: params.inputContext ?? {},
      })
      .select('id,generated_at')
      .single();

    if (runErr || !runRow) {
      if (isTableMissing(runErr?.message ?? '')) {
        return { saved: false, errorCode: 'sector_radar_snapshots_table_missing' };
      }
      console.warn('[sector_radar_runs] insert failed', runErr?.message);
      return { saved: false, errorCode: 'insert_failed' };
    }

    const runId = String((runRow as { id: string }).id);
    const items: Record<string, unknown>[] = [];
    let rank = 0;
    for (const sector of summary.sectors ?? []) {
      for (const anchor of sector.anchors ?? []) {
        rank += 1;
        items.push({
          run_id: runId,
          user_key: userKey,
          sector_key: sector.key,
          sector_name: sector.name,
          theme_key: sector.key,
          theme_name: sector.name,
          rank,
          symbol: anchor.symbol,
          name: anchor.name,
          market: 'US',
          asset_type: 'etf',
          ticker: anchor.symbol,
          google_ticker: anchor.googleTicker,
          quote_symbol: anchor.symbol,
          score: sector.adjustedScore ?? sector.score,
          confidence: sector.scoreExplanation?.confidence ?? 'unknown',
          data_status: anchor.dataStatus ?? 'unknown',
          item_bucket: anchor.etfDisplayGroup ?? 'scored',
          selected_reasons: [{ code: 'sector_radar_snapshot', labelKo: 'Sector Radar 스냅샷 항목' }],
          risk_flags: [],
          missing_evidence: [],
          quote_quality: { status: anchor.etfQuoteQualityStatus },
          raw_item: { sectorKey: sector.key, anchorSymbol: anchor.symbol },
        });
      }
    }

    if (items.length > 0) {
      const { error: itemErr } = await supabase.from(ITEMS).insert(items);
      if (itemErr) {
        console.warn('[sector_radar_items] insert failed', itemErr.message);
      }
    }

    return {
      saved: true,
      runId,
      itemCount: items.length,
      lastGeneratedAt: String((runRow as { generated_at: string }).generated_at),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isTableMissing(msg)) return { saved: false, errorCode: 'sector_radar_snapshots_table_missing' };
    console.warn('[sector_radar_snapshot] exception', msg);
    return { saved: false, errorCode: 'insert_failed' };
  }
}

export async function fetchLatestSectorRadarSnapshot(params: {
  supabase: SupabaseClient;
  userKey: string;
}): Promise<{
  run: { id: string; generated_at: string; status: string; degraded: boolean; itemCount: number } | null;
  stale: boolean;
  tableMissing: boolean;
}> {
  try {
    const { data: runs, error } = await params.supabase
      .from(RUNS)
      .select('id,generated_at,status,degraded')
      .eq('user_key', params.userKey)
      .order('generated_at', { ascending: false })
      .limit(1);

    if (error) {
      if (isTableMissing(error.message)) return { run: null, stale: false, tableMissing: true };
      return { run: null, stale: false, tableMissing: false };
    }
    const run = runs?.[0] as { id: string; generated_at: string; status: string; degraded: boolean } | undefined;
    if (!run) return { run: null, stale: true, tableMissing: false };

    const { count } = await params.supabase
      .from(ITEMS)
      .select('id', { count: 'exact', head: true })
      .eq('run_id', run.id);

    const ageMs = Date.now() - new Date(run.generated_at).getTime();
    const stale = ageMs > STALE_DAYS * 24 * 60 * 60 * 1000;

    return {
      run: { ...run, itemCount: count ?? 0 },
      stale,
      tableMissing: false,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isTableMissing(msg)) return { run: null, stale: false, tableMissing: true };
    return { run: null, stale: false, tableMissing: false };
  }
}

export async function fetchSectorRadarItemsForRun(params: {
  supabase: SupabaseClient;
  userKey: string;
  runId: string;
  limit?: number;
}): Promise<{ items: Record<string, unknown>[]; tableMissing: boolean }> {
  const limit = Math.min(100, params.limit ?? 50);
  try {
    const { data, error } = await params.supabase
      .from(ITEMS)
      .select('*')
      .eq('user_key', params.userKey)
      .eq('run_id', params.runId)
      .order('rank', { ascending: true })
      .limit(limit);

    if (error) {
      if (isTableMissing(error.message)) return { items: [], tableMissing: true };
      return { items: [], tableMissing: false };
    }
    return { items: (data ?? []) as Record<string, unknown>[], tableMissing: false };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isTableMissing(msg)) return { items: [], tableMissing: true };
    return { items: [], tableMissing: false };
  }
}
