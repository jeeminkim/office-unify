import { describe, expect, it } from 'vitest';
import { createSubmitLockRegistry, formatActionMessage, pushActionLog } from '@/lib/client/submitLock';

describe('submitLock', () => {
  it('duplicate acquire returns false', () => {
    const lock = createSubmitLockRegistry();
    expect(lock.tryAcquire('repair_apply')).toBe(true);
    expect(lock.tryAcquire('repair_apply')).toBe(false);
    lock.release('repair_apply');
    expect(lock.tryAcquire('repair_apply')).toBe(true);
  });

  it('action log keeps last 3 entries', () => {
    const logs = pushActionLog([], {
      actionKey: 'a',
      actionLabel: 'test',
      phase: 'success',
      message: formatActionMessage('success', 'test'),
    });
    const more = pushActionLog(logs, {
      actionKey: 'b',
      actionLabel: 'b',
      phase: 'clicked',
      message: formatActionMessage('clicked', 'b'),
    });
    expect(more.length).toBeLessThanOrEqual(3);
  });

  it('dedupes near-identical action logs and removes stale running row on success', () => {
    const at = '2026-05-29T00:00:00.000Z';
    const running = pushActionLog([], {
      at,
      actionKey: 'regen',
      actionLabel: '재생성',
      phase: 'running',
      message: 'running',
    });
    const duplicated = pushActionLog(running, {
      at: '2026-05-29T00:00:00.500Z',
      actionKey: 'regen',
      actionLabel: '재생성',
      phase: 'running',
      message: 'running',
    });
    expect(duplicated).toHaveLength(1);
    const success = pushActionLog(duplicated, {
      at: '2026-05-29T00:00:01.000Z',
      actionKey: 'regen',
      actionLabel: '재생성',
      phase: 'success',
      message: 'success',
    });
    expect(success).toHaveLength(1);
    expect(success[0].phase).toBe('success');
  });
});
