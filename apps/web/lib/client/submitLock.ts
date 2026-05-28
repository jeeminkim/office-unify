export type ActionPhase = 'idle' | 'clicked' | 'running' | 'success' | 'error';

export type ActionLogEntry = {
  at: string;
  actionKey: string;
  actionLabel: string;
  phase: ActionPhase;
  message: string;
  nextHint?: string;
};

export function formatActionMessage(phase: ActionPhase, label: string): string {
  switch (phase) {
    case 'clicked':
      return `"${label}" 버튼을 눌렀습니다.`;
    case 'running':
      return `"${label}" 처리 중입니다.`;
    case 'success':
      return `"${label}" 완료되었습니다.`;
    case 'error':
      return `"${label}" 실패했습니다.`;
    default:
      return '';
  }
}

/** In-memory lock per action key to ignore duplicate requests while running. */
export function createSubmitLockRegistry() {
  const running = new Set<string>();

  return {
    tryAcquire(key: string): boolean {
      if (running.has(key)) return false;
      running.add(key);
      return true;
    },
    release(key: string): void {
      running.delete(key);
    },
    isRunning(key: string): boolean {
      return running.has(key);
    },
  };
}

export function pushActionLog(
  prev: ActionLogEntry[],
  entry: Omit<ActionLogEntry, 'at'> & { at?: string },
  max = 3,
): ActionLogEntry[] {
  const row: ActionLogEntry = { ...entry, at: entry.at ?? new Date().toISOString() };
  const rowTime = Date.parse(row.at);
  const next = prev.filter((old) => {
    if (old.actionKey !== row.actionKey) return true;
    if (old.phase === 'running' && (row.phase === 'success' || row.phase === 'error')) return false;
    if (old.phase !== row.phase) return true;
    const oldTime = Date.parse(old.at);
    if (!Number.isFinite(rowTime) || !Number.isFinite(oldTime)) return true;
    return Math.abs(rowTime - oldTime) > 1500;
  });
  return [row, ...next].slice(0, max);
}
