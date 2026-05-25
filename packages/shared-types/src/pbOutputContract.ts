/** Additive PB output quality audit summary. The server validator remains pure and warning-only. */
export type PbOutputContractSource =
  | 'pb_message'
  | 'pb_weekly_review'
  | 'pb_daily_note_preview'
  | 'research_send_to_pb';

export type PbOutputContractAuditSummary = {
  status: 'ok' | 'warning' | 'failed';
  source: PbOutputContractSource;
  missingSections: string[];
  unsafeDirectiveCount: number;
  forbiddenPhraseCount: number;
  safeCaveatDetected: boolean;
  recommendedAction: 'none' | 'show_warning' | 'fallback_summary' | 'manual_review';
};
