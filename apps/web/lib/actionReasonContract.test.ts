import { describe, expect, it } from 'vitest';
import {
  assertReasonHasUsableAction,
  buildActionStepFromReason,
  buildDiagnosticDisplaySlotFromReason,
  buildPrimaryActionViewModel,
  buildReasonViewModel,
  getActionReasonContract,
  getButtonIntentLabel,
  normalizeUnknownSnakeCaseReason,
  resolveActionReasonFromSourceExtraction,
  resolveActionReasonFromSmartResolve,
  resolveActionReasonFromUsDiagnostics,
  resolveReasonCodeFromLegacyString,
} from '@/lib/actionReasonContract';

describe('actionReasonContract', () => {
  it('limits Google Finance primary CTA to anchor/formula/read-back problems', () => {
    expect(getActionReasonContract('google_finance_anchor_missing').primaryActionKey).toBe('google_finance_setup');
    expect(getActionReasonContract('google_finance_formula_pending').primaryActionKey).toBe(
      'google_finance_readback_check',
    );
    expect(getActionReasonContract('google_finance_readback_partial').primaryActionKey).toBe(
      'google_finance_readback_check',
    );

    expect(getActionReasonContract('provider_not_configured').primaryActionKey).not.toBe('google_finance_setup');
    expect(getActionReasonContract('us_market_feed_missing').primaryActionKey).not.toBe('google_finance_setup');
    expect(getActionReasonContract('ticker_mapping_required').primaryActionKey).not.toBe('google_finance_setup');
  });

  it('resolves typed US diagnostics before falling back to unknown', () => {
    expect(resolveActionReasonFromUsDiagnostics({ reasonCode: 'us_signal_mapping_empty' }).primaryActionKey).toBe(
      'us_mapping_diagnosis',
    );
    expect(resolveActionReasonFromUsDiagnostics({ usMarketFeedMissing: true }).primaryActionKey).toBe(
      'us_market_feed_check',
    );
    expect(resolveActionReasonFromUsDiagnostics({ gatingReason: 'unknown' }).code).toBe('unknown');
  });

  it('maps source extraction quality to user-safe reasons', () => {
    expect(resolveActionReasonFromSourceExtraction({ sourceQualityReason: 'title_only' }).code).toBe(
      'source_title_only',
    );
    expect(resolveActionReasonFromSourceExtraction({ sourceQualityReason: 'metadata_only' }).code).toBe(
      'source_metadata_only',
    );
    expect(resolveActionReasonFromSourceExtraction({ sourceQualityReason: 'blocked_or_empty' }).code).toBe(
      'source_blocked_or_empty',
    );
    expect(resolveActionReasonFromSourceExtraction({ sourceQualityReason: 'too_short' }).code).toBe(
      'insufficient_source',
    );
  });

  it('keeps manual smart-resolve candidates disabled', () => {
    const reason = resolveActionReasonFromSmartResolve({ symbol: 'UNKNOWN', matchType: 'manual_review' });
    expect(reason.primaryIntent).toBe('disabled');
    expect(reason.disabledReasonKo).toContain('수동 확인');
    expect(assertReasonHasUsableAction(reason)).toBe(true);
  });

  it('provides button intent copy without automatic execution wording', () => {
    expect(getButtonIntentLabel('confirmed_post')).toContain('명시적 POST');
    expect(getButtonIntentLabel('disabled')).toContain('사용할 수 없습니다');
  });
  it('normalizes legacy strings into central reason actions', () => {
    expect(resolveReasonCodeFromLegacyString('USMarketDataMissing: yahoo feed empty', 'quote')).toBe(
      'us_market_feed_missing',
    );
    expect(resolveReasonCodeFromLegacyString('mapping_required', 'quote')).toBe('ticker_mapping_required');
    expect(resolveReasonCodeFromLegacyString('title_only', 'infographic')).toBe('source_title_only');
  });

  it('builds reusable view models for buttons, slots, and action steps', () => {
    const action = buildPrimaryActionViewModel('us_market_feed_missing');
    expect(action.href).toBe('/system-status');
    expect(action.actionIntent).toBe('read_only_check');

    const slot = buildDiagnosticDisplaySlotFromReason('ticker_mapping_required');
    expect(slot.primaryActionHref).toBe('/portfolio-ledger');
    expect(slot.isTradeCandidate).toBe(false);

    const step = buildActionStepFromReason('manual_review_required');
    expect(step.actionIntent).toBe('disabled');
    expect(step.disabledReasonKo).toBeTruthy();
  });

  it('keeps unknown snake_case user-readable', () => {
    expect(buildReasonViewModel('new_unmapped_reason').shortLabelKo).toBe(
      normalizeUnknownSnakeCaseReason('new_unmapped_reason'),
    );
  });
});
