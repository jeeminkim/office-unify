import { describe, expect, it } from 'vitest';
import {
  buildPersonaActionBridge,
  mergeActionItemDetailWithBridge,
} from '@/lib/personaActionBridge';

describe('personaActionBridge', () => {
  it('maps nextChecks, missingEvidence, riskFlags, and doNotDo into standard detail fields', () => {
    const bridge = buildPersonaActionBridge({
      source: 'today_candidate',
      title: 'HLB risk follow-up',
      sourceSummary: 'Risk review needs disclosure and position context.',
      nextChecks: ['Check disclosure calendar'],
      missingEvidence: ['latest quote'],
      riskFlags: ['corporate_action_risk'],
      doNotDo: ['Do not chase without event date confirmation.'],
      sourceRefs: [{ sourceType: 'today_candidate', sourceHref: '/', label: 'Today Candidate' }],
      symbol: '028300',
      name: 'HLB',
    });

    expect(bridge.actionSteps.map((step) => step.category)).toEqual(
      expect.arrayContaining(['checklist', 'research', 'risk_review']),
    );
    expect(bridge.actionSteps.some((step) => step.category === 'do_not_do')).toBe(false);
    expect(bridge.guardrails.some((guardrail) => guardrail.label.includes('Do not chase'))).toBe(true);
    expect(bridge.detail.bridgeSource).toBe('today_candidate');
    expect(bridge.detail.completenessLevel).toMatch(/full|high/);
  });

  it('creates US diagnostics mapping steps without making Google Finance repair the first step', () => {
    const bridge = buildPersonaActionBridge({
      source: 'us_diagnostics',
      title: 'US diagnostics',
      gatingReason: 'us_signal_mapping_empty',
      anchorOk: true,
      googleFinanceAnchorOk: true,
      nextChecks: ['Review suppressed reason histogram'],
    });

    expect(bridge.detail.sourceSummary).toContain('Google Finance anchor');
    expect(bridge.actionSteps[0]?.label).toContain('Watchlist');
    expect(bridge.actionSteps[0]?.label).not.toMatch(/repair/i);
    expect(bridge.actionSteps.some((step) => step.label.includes('Sector Radar'))).toBe(true);
    expect(bridge.detail.doNotDo?.some((item) => item.includes('repair'))).toBe(true);
    expect(bridge.actionSteps.some((step) => /automatic order|auto rebalance/i.test(step.label))).toBe(false);
  });

  it('turns PB output contract missing sections into manual review steps and blocks unsafe directives', () => {
    const warning = buildPersonaActionBridge({
      source: 'pb_message',
      title: 'PB warning',
      sourceSummary: 'PB answer lacked some structured sections.',
      outputContract: {
        status: 'warning',
        source: 'pb_message',
        missingSections: ['hasNextChecks', 'hasDoNotDo', 'hasRiskReview'],
        unsafeDirectiveCount: 0,
        forbiddenPhraseCount: 0,
        safeCaveatDetected: true,
        recommendedAction: 'show_warning',
      },
    });
    expect(warning.actionSteps.some((step) => step.category === 'manual_review')).toBe(true);
    expect(warning.actionSteps.some((step) => step.label.includes('다음 확인 항목'))).toBe(true);
    expect(warning.warnings).toEqual([]);

    const unsafe = buildPersonaActionBridge({
      source: 'pb_message',
      title: 'Unsafe PB warning',
      sourceSummary: 'Unsafe directive detected.',
      outputContractWarnings: [{ code: 'unsafe', message: 'place a buy order now' }],
    });
    expect(unsafe.guardrails.some((guardrail) => guardrail.severity === 'block')).toBe(true);
    expect(unsafe.warnings).toContain('manual_review_required');
  });

  it('keeps long sourceSummary compact and does not store originalQuestion in detail', () => {
    const longText = `start-${'x'.repeat(900)}-raw-tail-marker`;
    const bridge = buildPersonaActionBridge({
      source: 'long_response_fallback',
      title: 'Long response follow-up',
      sourceSummary: longText,
      originalQuestion: 'full original question should stay out of detail',
      nextChecks: ['Review key summary', 'Ask PB follow-up', 'Record in Journal'],
    });

    expect((bridge.detail.sourceSummary?.length ?? 0)).toBeLessThanOrEqual(400);
    expect(JSON.stringify(bridge.detail)).not.toContain('raw-tail-marker');
    expect(JSON.stringify(bridge.detail)).not.toContain('full original question should stay out of detail');
    expect(bridge.recommendedNextLinks.some((link) => link.kind === 'journal')).toBe(true);
    expect(bridge.recommendedNextLinks.some((link) => link.kind === 'retrospective')).toBe(true);
  });

  it('merges bridge detail additively without overwriting existing sourceSummary', () => {
    const bridge = buildPersonaActionBridge({
      source: 'research_report',
      title: 'Research follow-up',
      sourceSummary: 'Bridge summary',
      nextChecks: ['Review summary'],
      doNotDo: ['Do not execute from research text.'],
    });
    const merged = mergeActionItemDetailWithBridge(
      {
        sourceSummary: 'Existing summary',
        actionSteps: [{ stepId: 'existing', label: 'Existing step', category: 'checklist' }],
        guardrails: [{ id: 'existing-guard', label: 'Existing guardrail', severity: 'warn' }],
      },
      bridge,
    );

    expect(merged.sourceSummary).toBe('Existing summary');
    expect(merged.actionSteps?.some((step) => step.label === 'Existing step')).toBe(true);
    expect(merged.actionSteps?.some((step) => step.label === 'Review summary')).toBe(true);
    expect(merged.guardrails?.some((guardrail) => guardrail.label === 'Existing guardrail')).toBe(true);
  });
});
