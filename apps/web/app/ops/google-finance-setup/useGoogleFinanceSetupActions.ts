"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSubmitLockRegistry,
  formatActionMessage,
  pushActionLog,
  type ActionLogEntry,
  type ActionPhase,
} from "@/lib/client/submitLock";

export type RunActionOptions = {
  key: string;
  label: string;
  nextHint?: string;
  onSuccess?: () => void;
};

export function useGoogleFinanceSetupActions() {
  const lockRef = useRef(createSubmitLockRegistry());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([]);
  const [inFlight, setInFlight] = useState<Record<string, ActionPhase>>({});

  const logAction = useCallback((key: string, label: string, phase: ActionPhase, nextHint?: string) => {
    const message = formatActionMessage(phase, label);
    setStatusMessage(message);
    setActionLogs((prev) =>
      pushActionLog(prev, {
        actionKey: key,
        actionLabel: label,
        phase,
        message,
        nextHint,
      }),
    );
    setInFlight((prev) => ({ ...prev, [key]: phase }));
  }, []);

  const runAction = useCallback(
    async (opts: RunActionOptions, fn: () => Promise<void>) => {
      const { key, label, nextHint, onSuccess } = opts;
      if (!lockRef.current.tryAcquire(key)) {
        setDuplicateMessage("이미 처리 중입니다. 완료될 때까지 기다려 주세요.");
        return;
      }
      setDuplicateMessage(null);
      logAction(key, label, "clicked");
      logAction(key, label, "running");
      try {
        await fn();
        logAction(key, label, "success", nextHint);
        onSuccess?.();
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : "알 수 없는 오류";
        setStatusMessage(`「${label}」 실패했습니다: ${errMsg}`);
        setActionLogs((prev) =>
          pushActionLog(prev, {
            actionKey: key,
            actionLabel: label,
            phase: "error",
            message: errMsg,
            nextHint: "다시 시도할 수 있습니다.",
          }),
        );
        setInFlight((prev) => ({ ...prev, [key]: "error" }));
        throw e;
      } finally {
        lockRef.current.release(key);
        setInFlight((prev) => ({ ...prev, [key]: prev[key] === "running" ? "idle" : prev[key] }));
      }
    },
    [logAction],
  );

  const isRunning = useCallback((key: string) => inFlight[key] === "running", [inFlight]);

  return {
    statusMessage,
    duplicateMessage,
    actionLogs,
    runAction,
    isRunning,
    setStatusMessage,
    setDuplicateMessage,
  };
}

/** 60s countdown after repair apply — does not auto-fetch. */
export function usePostApplyWaitTimer(active: boolean) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!active) return;

    let remaining = 60;
    const intervalId = window.setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining > 0 ? remaining : 0);
      if (remaining <= 0) window.clearInterval(intervalId);
    }, 1000);

    const startId = window.setTimeout(() => setSecondsLeft(60), 0);

    return () => {
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
    };
  }, [active]);

  useEffect(() => {
    if (active) return;
    const resetId = window.setTimeout(() => setSecondsLeft(0), 0);
    return () => window.clearTimeout(resetId);
  }, [active]);

  return { secondsLeft: active ? secondsLeft : 0, ready: active && secondsLeft === 0 };
}
