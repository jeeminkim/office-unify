import { beforeEach, describe, expect, it, vi } from 'vitest';

const runCore = vi.fn();

vi.mock('../lib/server/googleSheetsRepair', () => ({
  runGoogleSheetsRepairCore: (...args: unknown[]) => runCore(...args),
}));

describe('google-finance-repair-live CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCore.mockResolvedValue({
      ok: true,
      status: 'confirmation_required',
      appliedOperations: [],
      appendedAnchorSymbols: ['SPY'],
      skippedOperations: [],
      formulaPendingCount: 2,
      recommendedNextAction: 'Today Brief를 다시 실행하세요.',
      repairPlan: {
        status: 'needs_confirmation',
        credential: { serviceAccountEmailMasked: 'svc***@project.iam.gserviceaccount.com' },
      },
      postCheck: {
        parsedRowsOk: 16,
        anchorMatched: 16,
        anchorOk: 0,
        missingAnchors: ['QQQ'],
        recommendedNextAction: 'wait',
      },
    });
  });

  it('defaults to dry-run and does not confirm writes', async () => {
    const { runGoogleFinanceRepairCli } = await import('./google-finance-repair-live');
    const chunks: string[] = [];
    const code = await runGoogleFinanceRepairCli(['--dry-run'], { write: (text) => chunks.push(text) });
    expect(code).toBe(0);
    expect(runCore).toHaveBeenCalledWith(expect.objectContaining({ confirm: false, dryRun: true, overwrite: false }));
    expect(chunks.join('')).toContain('mode: dry-run');
    expect(chunks.join('')).not.toContain('private_key');
  });

  it('confirm mode calls the shared core with wait flag', async () => {
    const { runGoogleFinanceRepairCli } = await import('./google-finance-repair-live');
    const code = await runGoogleFinanceRepairCli(['--confirm', '--wait'], { write: () => undefined });
    expect(code).toBe(0);
    expect(runCore).toHaveBeenCalledWith(expect.objectContaining({ confirm: true, dryRun: false, wait: true }));
  });
});
