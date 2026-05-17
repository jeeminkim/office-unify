import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { UsCandidateDiagnostics } from '@office-unify/shared-types';
import {
  buildTodayCandidatesUsCandidatesSuppressedFingerprint,
  buildTodayCandidatesUsCandidatesZeroFingerprint,
  buildTodayCandidatesUsQuoteDegradedFingerprint,
  buildTodayCandidatesUsSlotEmptyFingerprint,
  OPS_TODAY_CANDIDATES_EVENT_CODES,
} from '@/lib/server/opsAggregateWarnings';
import {
  appendQualityMetaOpsEventTrace,
  OPS_LOG_MAX_WRITES_PER_REQUEST,
  shouldWriteOpsEvent,
  type OpsQualityMetaEventTraceEntry,
} from '@/lib/server/opsLogBudget';
import { upsertOpsEventByFingerprint } from '@/lib/server/upsertOpsEventByFingerprint';

type OpsLogging = {
  attempted: number;
  written: number;
  skippedReadOnly: number;
  skippedCooldown: number;
  skippedBudgetExceeded: number;
  warnings: string[];
  eventTrace?: OpsQualityMetaEventTraceEntry[];
};

async function maybeLog(
  params: {
    supabase: SupabaseClient;
    userKey: string;
    ymdKst: string;
    opsLogging: OpsLogging;
    code: string;
    fingerprint: string;
    message: string;
    detail: Record<string, unknown>;
  },
): Promise<void> {
  const { supabase, userKey, ymdKst, opsLogging, code, fingerprint, message, detail } = params;
  const { data: existing } = await supabase
    .from('web_ops_events')
    .select('last_seen_at')
    .eq('fingerprint', fingerprint)
    .maybeSingle<{ last_seen_at: string }>();
  const decision = shouldWriteOpsEvent({
    domain: 'today_candidates',
    code,
    severity: 'warning',
    fingerprint,
    isReadOnlyRoute: true,
    isCritical: true,
    lastSeenAt: existing?.last_seen_at ?? null,
    cooldownMinutes: 60 * 6,
    writesUsed: opsLogging.written,
    maxWritesPerRequest: OPS_LOG_MAX_WRITES_PER_REQUEST,
  });
  opsLogging.attempted += 1;
  appendQualityMetaOpsEventTrace(opsLogging, {
    code,
    shouldWrite: decision.shouldWrite,
    reason: decision.reason,
  });
  if (!decision.shouldWrite) {
    if (decision.reason === 'skipped_read_only') opsLogging.skippedReadOnly += 1;
    if (decision.reason === 'skipped_cooldown') opsLogging.skippedCooldown += 1;
    if (decision.reason === 'skipped_budget_exceeded') opsLogging.skippedBudgetExceeded += 1;
    return;
  }
  const write = await upsertOpsEventByFingerprint({
    userKey,
    domain: 'today_candidates',
    eventType: 'warning',
    severity: 'warning',
    code,
    message,
    detail: { ...detail, yyyyMMdd: ymdKst },
    fingerprint,
    status: 'open',
    route: '/api/dashboard/today-brief',
    component: 'today-brief',
  });
  if (write.ok) opsLogging.written += 1;
  else if (opsLogging.warnings.length < 10) opsLogging.warnings.push(write.warning ?? `${code}_log_failed`);
}

/** US 후보 진단 기반 ops (fingerprint/cooldown/budget). */
export async function emitUsCandidateDiagnosticsOps(params: {
  supabase: SupabaseClient;
  userKey: string;
  ymdKst: string;
  diagnostics: UsCandidateDiagnostics;
  opsLogging: OpsLogging;
}): Promise<void> {
  const d = params.diagnostics;
  const baseDetail = {
    status: d.status,
    userUsWatchlistCount: d.userUsWatchlistCount,
    poolUsDirectCount: d.poolUsDirectCount,
    selectedUsCandidateCount: d.selectedUsCandidateCount,
    topRejectReasons: d.topRejectReasons,
    topSuppressReasons: d.topSuppressReasons,
  };

  if (
    d.userUsWatchlistCount > 0 &&
    d.selectedUsCandidateCount === 0 &&
    (d.poolUsDirectCount > 0 || d.poolUsKrMappedCount > 0)
  ) {
    await maybeLog({
      supabase: params.supabase,
      userKey: params.userKey,
      ymdKst: params.ymdKst,
      opsLogging: params.opsLogging,
      code: OPS_TODAY_CANDIDATES_EVENT_CODES.US_CANDIDATES_ZERO,
      fingerprint: buildTodayCandidatesUsCandidatesZeroFingerprint({
        userKey: params.userKey,
        ymdKst: params.ymdKst,
      }),
      message: 'US watchlist/holdings in pool but zero US candidates in deck',
      detail: baseDetail,
    });
  }

  if (d.suppressedUsCandidateCount > 0 && d.selectedUsCandidateCount === 0) {
    await maybeLog({
      supabase: params.supabase,
      userKey: params.userKey,
      ymdKst: params.ymdKst,
      opsLogging: params.opsLogging,
      code: OPS_TODAY_CANDIDATES_EVENT_CODES.US_CANDIDATES_SUPPRESSED,
      fingerprint: buildTodayCandidatesUsCandidatesSuppressedFingerprint({
        userKey: params.userKey,
        ymdKst: params.ymdKst,
      }),
      message: 'US candidates suppressed in diversity slot',
      detail: { ...baseDetail, suppressedUsCandidateCount: d.suppressedUsCandidateCount },
    });
  }

  if (d.quoteMissingCount > 0 && d.selectedUsCandidateCount === 0) {
    await maybeLog({
      supabase: params.supabase,
      userKey: params.userKey,
      ymdKst: params.ymdKst,
      opsLogging: params.opsLogging,
      code: OPS_TODAY_CANDIDATES_EVENT_CODES.US_QUOTE_DEGRADED,
      fingerprint: buildTodayCandidatesUsQuoteDegradedFingerprint({
        userKey: params.userKey,
        ymdKst: params.ymdKst,
      }),
      message: 'US quote missing/stale contributed to empty US deck',
      detail: {
        ...baseDetail,
        quoteMissingCount: d.quoteMissingCount,
        quoteOkCount: d.quoteOkCount,
      },
    });
  }

  if (d.userUsWatchlistCount > 0 && d.selectedUsCandidateCount === 0 && d.slotPolicy.usSlotEnabled) {
    await maybeLog({
      supabase: params.supabase,
      userKey: params.userKey,
      ymdKst: params.ymdKst,
      opsLogging: params.opsLogging,
      code: OPS_TODAY_CANDIDATES_EVENT_CODES.US_SLOT_EMPTY,
      fingerprint: buildTodayCandidatesUsSlotEmptyFingerprint({
        userKey: params.userKey,
        ymdKst: params.ymdKst,
      }),
      message: 'US slot target not met in today brief deck',
      detail: { ...baseDetail, slotPolicy: d.slotPolicy },
    });
  }
}
