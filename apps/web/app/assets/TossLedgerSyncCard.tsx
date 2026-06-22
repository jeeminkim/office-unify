'use client';

import { useState } from 'react';
import { CheckCircle2, Database, RefreshCw } from 'lucide-react';

type SyncResponse = {
  ok: boolean;
  holdingCount?: number;
  insertedCount?: number;
  updatedCount?: number;
  closedCount?: number;
  message?: string;
  error?: string;
  actionHint?: string;
};

export function TossLedgerSyncCard() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);

  async function syncLedger() {
    if (!window.confirm('현재 토스 보유 수량과 평단을 포트폴리오 원장 기준값으로 동기화할까요?')) return;
    setSyncing(true);
    setResult(null);
    try {
      const response = await fetch('/api/assets/toss/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ confirm: true }),
      });
      setResult(await response.json() as SyncResponse);
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : 'toss_portfolio_sync_failed',
        actionHint: '네트워크와 서버 운영 로그를 확인한 뒤 다시 시도하세요.',
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="mt-6 rounded-[24px] border border-slate-200 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Database size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">포트폴리오 원장 연결</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            직접 입력한 수량·평단 대신 현재 토스 보유현황을 기준값으로 저장합니다. 확인 후 실행되며 동기화 이력도 남습니다.
          </p>
          <button
            type="button"
            onClick={() => void syncLedger()}
            disabled={syncing}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? '동기화 중' : '토스 보유를 원장에 동기화'}
          </button>
        </div>
      </div>
      {result && (
        <div className={`mt-4 rounded-2xl p-4 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          <div className="flex items-start gap-2">
            {result.ok && <CheckCircle2 size={17} className="mt-0.5 shrink-0" />}
            <div>
              <p className="font-semibold">{result.message ?? (result.ok ? '동기화 완료' : result.error ?? '동기화 실패')}</p>
              {result.ok && (
                <p className="mt-1 text-xs">
                  신규 {result.insertedCount ?? 0} · 갱신 {result.updatedCount ?? 0} · 종료 처리 {result.closedCount ?? 0}
                </p>
              )}
              {!result.ok && result.actionHint && <p className="mt-1 text-xs leading-5">{result.actionHint}</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
