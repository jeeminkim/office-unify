import 'server-only';

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResearchReportDiffPayload, ResearchReportHistoryMeta } from '@office-unify/shared-types';

const RUNS = 'research_report_runs';
const DIFFS = 'research_report_diffs';

function isTableMissing(msg: string): boolean {
  return msg.includes('research_report_runs') || msg.includes('does not exist') || msg.includes('schema cache');
}

function ymdKst(d = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export type ResearchReportRunRow = {
  id: string;
  symbol: string;
  name: string | null;
  market: string | null;
  report_type: string;
  report_date: string;
  generated_at: string;
  status: string;
  stale_after_days: number;
  report_summary: string | null;
  report_body: string | null;
  structured_report: Record<string, unknown>;
  key_points: string[];
  risks: string[];
  catalysts: string[];
  data_quality: Record<string, unknown>;
};

export async function findLatestResearchReport(params: {
  supabase: SupabaseClient;
  userKey: string;
  symbol: string;
  reportType?: string;
}): Promise<{ row: ResearchReportRunRow | null; tableMissing: boolean }> {
  try {
    const { data, error } = await params.supabase
      .from(RUNS)
      .select(
        'id,symbol,name,market,report_type,report_date,generated_at,status,stale_after_days,report_summary,report_body,structured_report,key_points,risks,catalysts,data_quality',
      )
      .eq('user_key', params.userKey)
      .eq('symbol', params.symbol.trim())
      .eq('report_type', params.reportType ?? 'stock')
      .eq('status', 'completed')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isTableMissing(error.message)) return { row: null, tableMissing: true };
      return { row: null, tableMissing: false };
    }
    return { row: (data as ResearchReportRunRow) ?? null, tableMissing: false };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isTableMissing(msg)) return { row: null, tableMissing: true };
    return { row: null, tableMissing: false };
  }
}

export function shouldReuseResearchReport(params: {
  latest: ResearchReportRunRow | null;
  now?: Date;
  forceRefresh?: boolean;
}): {
  reuse: boolean;
  reason: 'none' | 'same_day' | 'fresh_window' | 'force_refresh' | 'stale_regenerate';
  daysSince: number;
} {
  const now = params.now ?? new Date();
  if (params.forceRefresh) {
    return { reuse: false, reason: 'force_refresh', daysSince: 0 };
  }
  if (!params.latest) {
    return { reuse: false, reason: 'none', daysSince: 999 };
  }
  const gen = new Date(params.latest.generated_at);
  const daysSince = daysBetween(gen, now);
  const today = ymdKst(now);
  if (params.latest.report_date === today) {
    return { reuse: true, reason: 'same_day', daysSince };
  }
  const staleAfter = params.latest.stale_after_days ?? 7;
  if (daysSince < staleAfter) {
    return { reuse: true, reason: 'fresh_window', daysSince };
  }
  return { reuse: false, reason: 'stale_regenerate', daysSince };
}

export function buildResearchReportHistoryMeta(
  latest: ResearchReportRunRow | null,
  reuseDecision: ReturnType<typeof shouldReuseResearchReport>,
  tableMissing: boolean,
): ResearchReportHistoryMeta {
  if (tableMissing) {
    return {
      tableMissing: true,
      actionHint: 'docs/sql/append_research_report_history.sql 적용 후 리포트 재사용·diff를 사용할 수 있습니다.',
      forceRefreshAvailable: true,
    };
  }
  if (!latest) {
    return { forceRefreshAvailable: false, reportFreshness: 'unknown' };
  }
  const daysSince = reuseDecision.daysSince;
  let reportFreshness: ResearchReportHistoryMeta['reportFreshness'] = 'unknown';
  let reusedExistingReport = false;
  let actionHint: string | undefined;

  if (reuseDecision.reuse) {
    reusedExistingReport = true;
    reportFreshness = reuseDecision.reason === 'same_day' ? 'reused_today' : 'reused_recent';
    actionHint =
      reuseDecision.reason === 'same_day'
        ? '오늘 이미 생성한 리포트가 있어 기존 결과를 표시합니다.'
        : '최근 생성 리포트가 있어 새 생성 없이 기존 결과를 표시합니다. 필요 시 「그래도 새로 생성」을 사용하세요.';
  } else if (reuseDecision.reason === 'stale_regenerate') {
    reportFreshness = daysSince >= 7 ? 'stale_diff_available' : 'unknown';
    actionHint = daysSince >= 7 ? '마지막 리포트 이후 7일 이상 지났습니다. 새 생성 시 변화 요약을 제공할 수 있습니다.' : undefined;
  }

  return {
    latestReportId: latest.id,
    latestGeneratedAt: latest.generated_at,
    latestReportDate: latest.report_date,
    daysSinceLatest: daysSince,
    reusedExistingReport,
    reportFreshness,
    forceRefreshAvailable: true,
    actionHint,
  };
}

export function buildResearchReportDiff(params: {
  previous: ResearchReportRunRow;
  current: ResearchReportRunRow;
}): ResearchReportDiffPayload {
  const prevKeys = new Set((params.previous.key_points ?? []).map(String));
  const curKeys = new Set((params.current.key_points ?? []).map(String));
  const changedPoints = [...curKeys].filter((k) => !prevKeys.has(k));
  const prevRisks = new Set((params.previous.risks ?? []).map(String));
  const curRisks = new Set((params.current.risks ?? []).map(String));
  const newRisks = [...curRisks].filter((r) => !prevRisks.has(r));
  const removedRisks = [...prevRisks].filter((r) => !curRisks.has(r));
  const prevCat = new Set((params.previous.catalysts ?? []).map(String));
  const curCat = new Set((params.current.catalysts ?? []).map(String));
  const changedCatalysts = [...curCat].filter((c) => !prevCat.has(c));

  const diffDays = daysBetween(new Date(params.previous.generated_at), new Date(params.current.generated_at));

  return {
    previousReportId: params.previous.id,
    currentReportId: params.current.id,
    diffDays,
    diffSummary: `지난 리포트(${params.previous.report_date}) 이후 ${diffDays}일 경과. 관찰 포인트·리스크·촉매 변화를 점검하세요.`,
    changedPoints: changedPoints.slice(0, 12),
    newRisks: newRisks.slice(0, 12),
    removedRisks: removedRisks.slice(0, 12),
    changedCatalysts: changedCatalysts.slice(0, 12),
    dataQualityChanges: [],
  };
}

export async function saveResearchReportRun(params: {
  supabase: SupabaseClient;
  userKey: string;
  symbol: string;
  name: string;
  market: string;
  reportBody: string;
  reportSummary?: string;
  structuredReport?: Record<string, unknown>;
  keyPoints?: string[];
  risks?: string[];
  catalysts?: string[];
  requestId?: string;
  idempotencyKey?: string;
  provider?: string;
}): Promise<{ row: ResearchReportRunRow | null; tableMissing: boolean }> {
  const hash = createHash('sha256').update(params.reportBody.slice(0, 8000)).digest('hex').slice(0, 32);
  try {
    const { data, error } = await params.supabase
      .from(RUNS)
      .insert({
        user_key: params.userKey,
        request_id: params.requestId ?? null,
        symbol: params.symbol.trim(),
        name: params.name,
        market: params.market,
        report_type: 'stock',
        status: 'completed',
        provider: params.provider ?? 'research_center',
        report_summary: params.reportSummary ?? params.reportBody.slice(0, 500),
        report_body: params.reportBody,
        structured_report: params.structuredReport ?? {},
        key_points: params.keyPoints ?? [],
        risks: params.risks ?? [],
        catalysts: params.catalysts ?? [],
        report_hash: hash,
        idempotency_key: params.idempotencyKey ?? null,
      })
      .select(
        'id,symbol,name,market,report_type,report_date,generated_at,status,stale_after_days,report_summary,report_body,structured_report,key_points,risks,catalysts,data_quality',
      )
      .single();

    if (error) {
      if (isTableMissing(error.message)) return { row: null, tableMissing: true };
      console.warn('[research_report_runs] insert failed', error.message);
      return { row: null, tableMissing: false };
    }
    return { row: data as ResearchReportRunRow, tableMissing: false };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isTableMissing(msg)) return { row: null, tableMissing: true };
    return { row: null, tableMissing: false };
  }
}

export async function fetchResearchReportDiff(params: {
  supabase: SupabaseClient;
  userKey: string;
  symbol: string;
  previousId?: string;
  currentId?: string;
}): Promise<{ diff: ResearchReportDiffPayload | null; tableMissing: boolean }> {
  try {
    let query = params.supabase
      .from(DIFFS)
      .select(
        'previous_report_id,current_report_id,diff_days,diff_summary,changed_points,new_risks,removed_risks,changed_catalysts,data_quality_changes',
      )
      .eq('user_key', params.userKey)
      .eq('symbol', params.symbol.trim())
      .order('created_at', { ascending: false })
      .limit(1);

    if (params.currentId) {
      query = query.eq('current_report_id', params.currentId);
    }
    if (params.previousId) {
      query = query.eq('previous_report_id', params.previousId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      if (isTableMissing(error.message)) return { diff: null, tableMissing: true };
      return { diff: null, tableMissing: false };
    }
    if (!data) return { diff: null, tableMissing: false };
    const row = data as Record<string, unknown>;
    return {
      diff: {
        previousReportId: row.previous_report_id as string | undefined,
        currentReportId: row.current_report_id as string | undefined,
        diffDays: row.diff_days as number | undefined,
        diffSummary: row.diff_summary as string | undefined,
        changedPoints: (row.changed_points as string[]) ?? [],
        newRisks: (row.new_risks as string[]) ?? [],
        removedRisks: (row.removed_risks as string[]) ?? [],
        changedCatalysts: (row.changed_catalysts as string[]) ?? [],
        dataQualityChanges: (row.data_quality_changes as string[]) ?? [],
      },
      tableMissing: false,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isTableMissing(msg)) return { diff: null, tableMissing: true };
    return { diff: null, tableMissing: false };
  }
}

export async function saveResearchReportDiff(params: {
  supabase: SupabaseClient;
  userKey: string;
  symbol: string;
  diff: ResearchReportDiffPayload;
}): Promise<void> {
  try {
    await params.supabase.from(DIFFS).insert({
      user_key: params.userKey,
      symbol: params.symbol,
      previous_report_id: params.diff.previousReportId ?? null,
      current_report_id: params.diff.currentReportId ?? null,
      diff_days: params.diff.diffDays ?? null,
      diff_summary: params.diff.diffSummary ?? null,
      changed_points: params.diff.changedPoints ?? [],
      new_risks: params.diff.newRisks ?? [],
      removed_risks: params.diff.removedRisks ?? [],
      changed_catalysts: params.diff.changedCatalysts ?? [],
      data_quality_changes: params.diff.dataQualityChanges ?? [],
    });
  } catch {
    /* best-effort */
  }
}
