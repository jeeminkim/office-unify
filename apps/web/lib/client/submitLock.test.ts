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
});
