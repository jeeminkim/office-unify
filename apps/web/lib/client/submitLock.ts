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
      return `「${label}」 버튼이 눌렸습니다.`;
    case 'running':
      return `「${label}」 처리 중입니다.`;
    case 'success':
      return `「${label}」 완료되었습니다.`;
    case 'error':
      return `「${label}」 실패했습니다.`;
    default:
      return '';
  }
}

/** In-memory lock per action key — ignore duplicate while running. */
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
  return [row, ...prev].slice(0, max);
}
