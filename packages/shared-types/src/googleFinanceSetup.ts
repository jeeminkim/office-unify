/** Google Finance Setup / Anchor Recovery (additive API types). */

export type GoogleFinanceAnchorRecoveryStatus =
  | 'not_needed'
  | 'needs_repair'
  | 'waiting_for_formula'
  | 'readback_ok'
  | 'anchor_match_failed'
  | 'gating_not_connected'
  | 'write_unavailable'
  | 'unsafe'
  | 'unknown';

export type GoogleFinanceAnchorRecoveryStepKey =
  | 'repair_apply'
  | 'wait_googlefinance'
  | 'quote_refresh'
  | 'setup_recheck'
  | 'today_brief_recheck'
  | 'gating_debug';

export type GoogleFinanceAnchorRecoveryStepStatus =
  | 'todo'
  | 'running'
  | 'done'
  | 'blocked'
  | 'not_needed';

export type GoogleFinanceAnchorIssue =
  | 'no_row'
  | 'no_formula'
  | 'formula_pending'
  | 'price_empty'
  | 'status_missing'
  | 'suspicious_status'
  | 'ok'
  | 'parse_failed'
  | 'unknown';

export type GoogleFinanceAnchorRecovery = {
  status: GoogleFinanceAnchorRecoveryStatus;
  recoveryLabel: string;
  current: {
    parsedRowsOk: number;
    anchorMatched: number;
    anchorOk: number;
    missingAnchors: string[];
    fallbackOnly: number;
    rangePermissionError: number;
  };
  diagnosis: string;
  nextStep: string;
  steps: Array<{
    stepKey: GoogleFinanceAnchorRecoveryStepKey;
    label: string;
    status: GoogleFinanceAnchorRecoveryStepStatus;
    actionButton?: string;
  }>;
};

export type GoogleFinanceRepairPostCheck = {
  /** @deprecated use anchorOk */
  sheetsOkCount: number;
  /** @deprecated use missingAnchors.length */
  missingCount: number;
  actionHint: string;
  parsedRowsOk: number;
  anchorMatched: number;
  anchorOk: number;
  /** additive: anchor rows present but GOOGLEFINANCE has not produced numeric read-back yet */
  formulaPendingCount?: number;
  missingAnchors: string[];
  recommendedNextAction: string;
};

export type GoogleFinanceAnchorSummaryForGating = {
  sheetsAnchorOk: number;
  anchorMatched: number;
  quoteSource: string;
  lastSetupCheckedAt?: string;
  gatingReason?: UsCandidateGoogleFinanceGatingReason;
};

export type UsCandidateGoogleFinanceGatingReason =
  | 'sheets_anchor_zero'
  | 'sheets_anchor_ok_but_us_signal_empty'
  | 'us_signal_mapping_empty'
  | 'quote_provider_failed'
  | 'gating_not_connected'
  | 'unknown';
