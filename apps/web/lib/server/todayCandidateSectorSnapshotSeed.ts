import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OfficeUserKey } from '@office-unify/shared-types';
import type { SectorRadarSummaryResponse } from '@/lib/sectorRadarContract';
import type { TodayStockCandidate } from '@/lib/todayCandidatesContract';
import { buildCandidateDataQuality } from '@/lib/todayCandidateDataQuality';
import { clampObservationScore, sparseDataBaseScore } from '@/lib/server/todayCandidateScoring';
import {
  fetchLatestSectorRadarSnapshot,
  fetchSectorRadarItemsForRun,
} from '@/lib/server/sectorRadarSnapshotStore';

const MAX_SNAPSHOT_SEED = 3;

export function isLiveSectorRadarDegraded(summary: SectorRadarSummaryResponse | null): boolean {
  if (!summary) return true;
  if (summary.ok === false) return true;
  const sectors = summary.sectors ?? [];
  if (sectors.length === 0) return true;
  const qm = summary.qualityMeta?.sectorRadar;
  if (qm && qm.noDataCount > 0 && qm.noDataCount >= Math.max(1, Math.floor(sectors.length * 0.5))) {
    return true;
  }
  const noDataSectors = sectors.filter((s) => s.zone === 'no_data' || (s.adjustedScore ?? s.score) == null).length;
  return noDataSectors >= Math.max(1, Math.floor(sectors.length * 0.5));
}

/** 실시간 summary degraded/empty일 때만 DB snapshot에서 관찰 후보 seed(최대 N). */
export async function appendSectorSnapshotSeedCandidates(params: {
  supabase: SupabaseClient;
  userKey: OfficeUserKey;
  sectorRadarSummary: SectorRadarSummaryResponse | null;
  existingCandidates: TodayStockCandidate[];
  maxSeed?: number;
}): Promise<{ candidates: TodayStockCandidate[]; usedSnapshot: boolean; stale: boolean; runId?: string }> {
  if (!isLiveSectorRadarDegraded(params.sectorRadarSummary)) {
    return { candidates: [], usedSnapshot: false, stale: false };
  }

  const snap = await fetchLatestSectorRadarSnapshot({
    supabase: params.supabase,
    userKey: params.userKey as string,
  });
  if (!snap.run || snap.tableMissing) {
    return { candidates: [], usedSnapshot: false, stale: snap.stale };
  }

  const { items } = await fetchSectorRadarItemsForRun({
    supabase: params.supabase,
    userKey: params.userKey as string,
    runId: snap.run.id,
    limit: 12,
  });

  const existingIds = new Set(params.existingCandidates.map((c) => c.candidateId));
  const max = Math.min(MAX_SNAPSHOT_SEED, params.maxSeed ?? MAX_SNAPSHOT_SEED);
  const seeded: TodayStockCandidate[] = [];

  for (const raw of items) {
    if (seeded.length >= max) break;
    const sym = String(raw.symbol ?? '').trim();
    if (!sym) continue;
    const market = String(raw.market ?? 'US') as TodayStockCandidate['market'];
    const candidateId = `sector-snapshot-${snap.run.id}-${sym}`;
    if (existingIds.has(candidateId)) continue;

    const baseScore = sparseDataBaseScore(`snap-${sym}`);
    const finalScore = clampObservationScore(baseScore + 4);
    const sectorName = String(raw.sector_name ?? raw.theme_name ?? '섹터');

    seeded.push({
      candidateId,
      name: String(raw.name ?? sym),
      market: market === 'KOSPI' || market === 'KOSDAQ' || market === 'KONEX' ? market : market === 'US' ? 'US' : 'UNKNOWN',
      country: market === 'US' ? 'US' : 'KR',
      symbol: `${market}:${sym}`,
      stockCode: sym,
      sector: sectorName,
      source: 'sector_radar',
      score: finalScore,
      confidence: raw.confidence === 'high' ? 'high' : raw.confidence === 'low' ? 'low' : 'medium',
      riskLevel: 'medium',
      reasonSummary: '최근 Sector Radar 스냅샷 기반 관찰 — 매수 권유 아님',
      reasonDetails: [
        '실시간 Sector Radar 데이터가 부족해 저장된 스냅샷을 참고했습니다.',
        snap.stale ? '스냅샷이 오래되었습니다. 최신 섹터 데이터로 다시 확인하세요.' : '스냅샷 시점의 섹터·테마 맥락을 복기용으로만 사용하세요.',
      ],
      positiveSignals: ['스냅샷 기반 섹터 맥락'],
      cautionNotes: ['매수 권유 아님', '스냅샷 시점 데이터'],
      relatedUserContext: [],
      relatedWatchlistSymbols: [],
      isBuyRecommendation: false,
      sectorSnapshotRunId: snap.run.id,
      sectorSnapshotStale: snap.stale,
      dataQuality: buildCandidateDataQuality({
        confidence: 'medium',
        quoteReady: raw.data_status === 'ok',
        sectorConfidence: 'medium',
        usMarketDataAvailable: true,
        hasWatchlistLink: false,
        cautionNotes: ['스냅샷 참조'],
        source: 'sector_radar',
      }),
      scoreBreakdown: {
        baseScore,
        sectorBoost: 4,
        watchlistBoost: 0,
        usSignalBoost: 0,
        quoteQualityPenalty: 0,
        repeatExposurePenalty: 0,
        corporateActionPenalty: 0,
        riskPenalty: 0,
        finalScore,
      },
    });
    existingIds.add(candidateId);
  }

  return {
    candidates: seeded,
    usedSnapshot: seeded.length > 0,
    stale: snap.stale,
    runId: snap.run.id,
  };
}
