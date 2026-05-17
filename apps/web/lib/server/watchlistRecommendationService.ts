import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OfficeUserKey,
  RecommendationCandidatesQualityMeta,
  WatchlistRecommendationCandidate,
} from '@office-unify/shared-types';
import { listWebPortfolioWatchlistForUser } from '@office-unify/supabase-access';
import { fetchLatestSectorRadarSnapshot, fetchSectorRadarItemsForRun } from '@/lib/server/sectorRadarSnapshotStore';
import { fetchTodayCandidateExposureStats } from '@/lib/server/todayCandidateImpressionStore';

const TABLE = 'watchlist_recommendation_candidates';

function isTableMissing(msg: string): boolean {
  return (
    msg.includes('watchlist_recommendation_candidates') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

/** 규칙 기반 관찰 후보 제안(LLM 종목 추천 금지). */
export async function generateWatchlistRecommendationCandidates(params: {
  supabase: SupabaseClient;
  userKey: string;
  requestId?: string;
  limit?: number;
}): Promise<{ candidates: WatchlistRecommendationCandidate[]; qualityMeta: RecommendationCandidatesQualityMeta }> {
  const limit = Math.min(10, params.limit ?? 5);
  const watchlist = await listWebPortfolioWatchlistForUser(
    params.supabase,
    params.userKey as OfficeUserKey,
  ).catch(() => []);
  const watchSymbols = new Set(watchlist.map((w) => `${w.market}:${w.symbol}`.toUpperCase()));

  const proposed: WatchlistRecommendationCandidate[] = [];
  const sourceMix: Record<string, number> = {};

  const snap = await fetchLatestSectorRadarSnapshot({ supabase: params.supabase, userKey: params.userKey });
  if (snap.run && !snap.tableMissing) {
    const { items } = await fetchSectorRadarItemsForRun({
      supabase: params.supabase,
      userKey: params.userKey,
      runId: snap.run.id,
      limit: 20,
    });
    for (const item of items) {
      const sym = String(item.symbol ?? '').trim();
      if (!sym) continue;
      const market = String(item.market ?? 'US');
      const key = `${market}:${sym}`.toUpperCase();
      if (watchSymbols.has(key)) continue;
      if (proposed.some((p) => p.symbol === sym && p.market === market)) continue;
      proposed.push({
        symbol: sym,
        name: String(item.name ?? sym),
        market,
        reasonCodes: ['sector_radar_snapshot'],
        displayReasons: ['최근 Sector Radar 스냅샷에서 관찰 가치가 있는 항목입니다.'],
        sourceRefs: [
          {
            sourceType: 'sector_radar_snapshot',
            sourceId: snap.run.id,
            label: String(item.sector_name ?? 'sector'),
          },
        ],
        confidence: (item.confidence as WatchlistRecommendationCandidate['confidence']) ?? 'medium',
        dataStatus: item.data_status === 'ok' ? 'ok' : 'degraded',
        alreadyInWatchlist: false,
        approvalStatus: 'pending',
        doNotDo: ['승인 전 관심종목에 등록되지 않습니다', '매수·매도 지시가 아닙니다'],
        nextChecks: ['시세·테마 연결·데이터 품질을 확인하세요'],
      });
      sourceMix.sector_radar_snapshot = (sourceMix.sector_radar_snapshot ?? 0) + 1;
      if (proposed.length >= limit) break;
    }
  }

  const exposure = await fetchTodayCandidateExposureStats({
    supabase: params.supabase,
    userKey: params.userKey,
    days: 7,
  });
  if (!exposure.tableMissing && exposure.rows.length > 0) {
    const usRows = exposure.rows.filter((r) => r.is_us_candidate && r.symbol);
    if (usRows.length === 0) {
      const usWl = watchlist.filter((w) => w.market === 'US');
      for (const w of usWl.slice(0, 2)) {
        const sym = String(w.symbol ?? '').trim();
        if (!sym || proposed.length >= limit) break;
        const key = `US:${sym}`.toUpperCase();
        if (watchSymbols.has(key)) continue;
        proposed.push({
          symbol: sym,
          name: w.name,
          market: 'US',
          reasonCodes: ['us_candidate_absent_7d'],
          displayReasons: ['최근 7일 Today 후보에 미국 관찰 종목이 없었습니다. 미국 관심종목 점검 후보입니다.'],
          sourceRefs: [{ sourceType: 'today_candidate_impression', label: '7d exposure' }],
          confidence: 'low',
          dataStatus: 'degraded',
          alreadyInWatchlist: true,
          approvalStatus: 'pending',
          doNotDo: ['자동 등록 없음', '데이터 상태 점검용'],
          nextChecks: ['미국 시세·Today Brief 미국 진단 확인'],
        });
        sourceMix.today_candidate_impression = (sourceMix.today_candidate_impression ?? 0) + 1;
      }
    }
  }

  let tableMissing = false;
  const toSave = proposed.slice(0, limit);
  for (const c of toSave) {
    if (c.alreadyInWatchlist) continue;
    try {
      const { error } = await params.supabase.from(TABLE).insert({
        user_key: params.userKey,
        request_id: params.requestId ?? null,
        symbol: c.symbol,
        name: c.name,
        market: c.market,
        confidence: c.confidence,
        data_status: c.dataStatus,
        approval_status: 'pending',
        reason_codes: c.reasonCodes,
        display_reasons: c.displayReasons,
        source_refs: c.sourceRefs,
        do_not_do: c.doNotDo,
        next_checks: c.nextChecks,
      });
      if (error) {
        if (isTableMissing(error.message)) tableMissing = true;
        else if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
          console.warn('[watchlist_recommendation] insert', error.message);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isTableMissing(msg)) tableMissing = true;
    }
  }

  const pending = await listPendingRecommendations({ supabase: params.supabase, userKey: params.userKey });

  const qualityMeta: RecommendationCandidatesQualityMeta = {
    status: pending.length > 0 ? 'ok' : proposed.length > 0 ? 'ok' : 'empty',
    generatedCount: toSave.length,
    pendingApprovalCount: pending.length,
    sourceMix,
    ...(tableMissing
      ? {
          tableMissing: true,
          actionHint: 'docs/sql/append_watchlist_recommendation_candidates.sql 적용 후 저장·조회가 가능합니다.',
        }
      : {}),
    ...(!tableMissing && proposed.length === 0
      ? { actionHint: '현재 규칙 기반으로 제안할 관찰 후보가 없습니다.' }
      : {}),
  };

  return { candidates: pending.length > 0 ? pending : toSave, qualityMeta };
}

export async function listPendingRecommendations(params: {
  supabase: SupabaseClient;
  userKey: string;
  limit?: number;
}): Promise<WatchlistRecommendationCandidate[]> {
  const limit = Math.min(20, params.limit ?? 10);
  try {
    const { data, error } = await params.supabase
      .from(TABLE)
      .select('id,symbol,name,market,confidence,data_status,approval_status,reason_codes,display_reasons,source_refs,do_not_do,next_checks')
      .eq('user_key', params.userKey)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        recommendationId: String(r.id),
        symbol: String(r.symbol),
        name: String(r.name ?? r.symbol),
        market: String(r.market ?? 'KR'),
        reasonCodes: (r.reason_codes as string[]) ?? [],
        displayReasons: (r.display_reasons as string[]) ?? [],
        sourceRefs: (r.source_refs as WatchlistRecommendationCandidate['sourceRefs']) ?? [],
        confidence: (r.confidence as WatchlistRecommendationCandidate['confidence']) ?? 'unknown',
        dataStatus: (r.data_status as WatchlistRecommendationCandidate['dataStatus']) ?? 'unknown',
        alreadyInWatchlist: false,
        approvalStatus: 'pending',
        doNotDo: (r.do_not_do as string[]) ?? [],
        nextChecks: (r.next_checks as string[]) ?? [],
      };
    });
  } catch {
    return [];
  }
}

export async function approveWatchlistRecommendation(params: {
  supabase: SupabaseClient;
  userKey: string;
  recommendationId?: string;
  symbol?: string;
  market?: string;
}): Promise<{ ok: boolean; actionHint?: string; alreadyExists?: boolean }> {
  let row: Record<string, unknown> | null = null;
  if (params.recommendationId) {
    const { data } = await params.supabase
      .from(TABLE)
      .select('*')
      .eq('user_key', params.userKey)
      .eq('id', params.recommendationId)
      .maybeSingle();
    row = (data as Record<string, unknown>) ?? null;
  }
  const symbol = String(row?.symbol ?? params.symbol ?? '').trim();
  const market = String(row?.market ?? params.market ?? 'KR').trim();
  const name = String(row?.name ?? symbol);
  if (!symbol) return { ok: false, actionHint: 'symbol 또는 recommendationId가 필요합니다.' };

  const watchlist = await listWebPortfolioWatchlistForUser(
    params.supabase,
    params.userKey as OfficeUserKey,
  );
  if (watchlist.some((w) => w.symbol === symbol && w.market === market)) {
    if (params.recommendationId) {
      await params.supabase
        .from(TABLE)
        .update({ approval_status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', params.recommendationId);
    }
    return { ok: true, alreadyExists: true, actionHint: '이미 관심종목에 등록되어 있습니다.' };
  }

  const { error: insErr } = await params.supabase.from('web_portfolio_watchlist').insert({
    user_key: params.userKey,
    symbol,
    name,
    market,
    sector: null,
    memo: '관찰 후보 승인 등록(자동 매매·주문 없음)',
  });

  if (insErr) {
    return { ok: false, actionHint: insErr.message };
  }

  if (params.recommendationId) {
    await params.supabase
      .from(TABLE)
      .update({ approval_status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', params.recommendationId);
  }

  return { ok: true, actionHint: '관심종목에 등록되었습니다. Today 후보 노출 패턴에 영향을 줄 수 있습니다.' };
}

export async function rejectWatchlistRecommendation(params: {
  supabase: SupabaseClient;
  userKey: string;
  recommendationId: string;
}): Promise<{ ok: boolean }> {
  const { error } = await params.supabase
    .from(TABLE)
    .update({ approval_status: 'rejected', rejected_at: new Date().toISOString() })
    .eq('user_key', params.userKey)
    .eq('id', params.recommendationId);
  return { ok: !error };
}
