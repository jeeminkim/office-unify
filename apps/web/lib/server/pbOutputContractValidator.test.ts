import { describe, expect, it } from 'vitest';
import { auditPbOutputContract, summarizePbOutputContractAudit } from './pbOutputContractValidator';

const completePbText = [
  '[정보 상태] 근거 요약입니다.',
  '[보유 집중도 점검] 리스크 플래그를 확인합니다.',
  '[하면 안 되는 행동] 자동 주문은 실행되지 않습니다.',
  '[다음 확인 체크리스트] 공시와 포지션 맥락을 다시 확인합니다.',
  '매수 추천이 아닙니다.',
].join('\n');

describe('pbOutputContractValidator', () => {
  it('allows safe negated caveats without policy warning', () => {
    const audit = auditPbOutputContract({ source: 'pb_message', text: completePbText });
    expect(audit.status).toBe('ok');
    expect(audit.policy.safeCaveatDetected).toBe(true);
    expect(audit.policy.unsafeDirectiveCount).toBe(0);
    expect(audit.policy.warnings).not.toContain('unsafe_directive_detected');
  });

  it('detects unsafe directives while keeping audit additive', () => {
    const audit = auditPbOutputContract({
      source: 'pb_message',
      text: `${completePbText}\n지금 매수하세요. 반드시 사세요. 수익 보장입니다. auto rebalance this portfolio.`,
    });
    expect(audit.status).toBe('failed');
    expect(audit.policy.unsafeDirectiveCount).toBeGreaterThanOrEqual(4);
    expect(audit.quality.recommendedAction).toBe('manual_review');
  });

  it('reports missing do-not-do and next checks', () => {
    const audit = auditPbOutputContract({
      source: 'research_send_to_pb',
      text: '[정보 상태] source summary\n[리스크 플래그] risk review\n매수 추천이 아닙니다. 자동매매를 하지 않습니다.',
    });
    expect(audit.status).toBe('warning');
    expect(audit.quality.missingSections).toContain('hasDoNotDo');
    expect(audit.quality.missingSections).toContain('hasNextChecks');
  });

  it('audits daily note preview from items instead of headings', () => {
    const audit = auditPbOutputContract({
      source: 'pb_daily_note_preview',
      items: [
        {
          noteSummary: '오늘 확인할 근거 요약',
          pbPerspective: '리스크 점검 관점',
          riskFlags: ['risk_review'],
          nextChecks: ['공시 확인'],
          doNotDo: ['자동 주문은 실행되지 않습니다'],
          notTradeInstruction: true,
        },
      ],
    });
    expect(audit.requiredSections.hasSourceSummary).toBe(true);
    expect(audit.requiredSections.hasNextChecks).toBe(true);
    expect(audit.requiredSections.hasDoNotDo).toBe(true);
    expect(audit.requiredSections.hasNoTradeCaveat).toBe(true);
    expect(audit.requiredSections.hasNoAutoExecutionCaveat).toBe(true);
  });

  it('uses source-specific daily item requirements', () => {
    const audit = auditPbOutputContract({
      source: 'pb_daily_note_preview',
      items: [{ noteSummary: 'summary', riskFlags: ['risk_review'], doNotDo: ['do not chase'], notTradeInstruction: true }],
    });
    expect(audit.quality.missingSections).toContain('hasNextChecks');
    expect(audit.quality.missingSections).not.toContain('hasSourceSummary');
  });

  it('summarizes audits for additive quality meta', () => {
    const summary = summarizePbOutputContractAudit(auditPbOutputContract({ source: 'pb_weekly_review', text: completePbText }));
    expect(summary).toMatchObject({
      status: 'ok',
      source: 'pb_weekly_review',
      unsafeDirectiveCount: 0,
      recommendedAction: 'none',
    });
  });
});
