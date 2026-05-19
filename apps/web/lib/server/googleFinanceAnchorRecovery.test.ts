import { describe, expect, it } from 'vitest';
import { buildGoogleFinanceAnchorRecovery } from '@/lib/server/googleFinanceAnchorRecovery';

const baseRepairPlan = {
  status: 'ready' as const,
  writeAvailable: true,
  requiresConfirmation: true as const,
  credential: {
    authMode: 'service_account',
    writeAvailable: true,
    scopesNote: '',
    actionHint: '',
  },
  operations: [],
  warnings: [],
  actionHint: '',
};

describe('buildGoogleFinanceAnchorRecovery', () => {
  it('parsedRowsOk > 0 and anchorMatched 0 → anchor_match_failed', () => {
    const r = buildGoogleFinanceAnchorRecovery({
      parsedRowsOk: 5,
      anchorMatched: 0,
      anchorOk: 0,
      missingAnchors: ['SPY'],
      fallbackOnly: 0,
      rangePermissionError: 0,
      tabFound: true,
      readSucceeded: true,
      repairPlan: baseRepairPlan,
    });
    expect(r.status).toBe('anchor_match_failed');
  });

  it('anchorMatched > 0 and anchorOk 0 → waiting_for_formula', () => {
    const r = buildGoogleFinanceAnchorRecovery({
      parsedRowsOk: 5,
      anchorMatched: 3,
      anchorOk: 0,
      missingAnchors: [],
      fallbackOnly: 0,
      rangePermissionError: 0,
      tabFound: true,
      readSucceeded: true,
      repairPlan: baseRepairPlan,
    });
    expect(r.status).toBe('waiting_for_formula');
  });

  it('anchorOk > 0 → readback_ok', () => {
    const r = buildGoogleFinanceAnchorRecovery({
      parsedRowsOk: 5,
      anchorMatched: 3,
      anchorOk: 2,
      missingAnchors: [],
      fallbackOnly: 0,
      rangePermissionError: 0,
      tabFound: true,
      readSucceeded: true,
      repairPlan: baseRepairPlan,
    });
    expect(r.status).toBe('readback_ok');
  });

  it('write unavailable → write_unavailable', () => {
    const r = buildGoogleFinanceAnchorRecovery({
      parsedRowsOk: 0,
      anchorMatched: 0,
      anchorOk: 0,
      missingAnchors: [],
      fallbackOnly: 0,
      rangePermissionError: 0,
      tabFound: false,
      readSucceeded: false,
      repairPlan: { ...baseRepairPlan, writeAvailable: false, status: 'write_not_available' },
    });
    expect(r.status).toBe('write_unavailable');
  });
});
