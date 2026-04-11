"use client";

import { useCallback, useEffect, useState } from "react";
import type { CommitteeDiscussionLineDto } from "@office-unify/shared-types";
import Link from "next/link";
import { CommitteeTurnFeedbackRow } from "@/components/CommitteeTurnFeedbackRow";

const jsonHeaders: HeadersInit = {
  "Content-Type": "application/json",
};

const TOPIC_MAX = 8000;

export function CommitteeDiscussionClient() {
  const [topic, setTopic] = useState("");
  const [roundNote, setRoundNote] = useState("");
  const [transcript, setTranscript] = useState<CommitteeDiscussionLineDto[]>([]);
  const [phase, setPhase] = useState<"idle" | "loading_round" | "after_round" | "loading_closing" | "closed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [reportMd, setReportMd] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [committeeTurnId, setCommitteeTurnId] = useState<string | null>(null);
  const [committeeLongTerm, setCommitteeLongTerm] = useState<string | null>(null);

  const loadCommitteeMemory = useCallback(async () => {
    try {
      const res = await fetch("/api/committee/memory", { credentials: "same-origin" });
      const data = (await res.json()) as { longTermMemorySummary?: string | null; error?: string };
      if (res.ok) setCommitteeLongTerm(data.longTermMemorySummary ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadCommitteeMemory();
  }, [loadCommitteeMemory]);

  const canStart = topic.trim().length > 0 && phase !== "loading_round" && phase !== "loading_closing";

  const runRound = useCallback(
    async (prior: CommitteeDiscussionLineDto[]) => {
      setError(null);
      setPhase("loading_round");
      try {
        const res = await fetch("/api/committee-discussion/round", {
          method: "POST",
          headers: jsonHeaders,
          credentials: "same-origin",
          body: JSON.stringify({
            topic: topic.trim(),
            roundNote: roundNote.trim() || undefined,
            priorTranscript: prior,
            ...(committeeTurnId ? { committeeTurnId } : {}),
          }),
        });
        const data = (await res.json()) as {
          lines?: CommitteeDiscussionLineDto[];
          committeeTurnId?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const lines = data.lines ?? [];
        if (data.committeeTurnId) setCommitteeTurnId(data.committeeTurnId);
        setTranscript((prev) => [...prev, ...lines]);
        setRoundNote("");
        setPhase("after_round");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "라운드 실패");
        setPhase(prior.length === 0 ? "idle" : "after_round");
      }
    },
    [topic, roundNote, committeeTurnId],
  );

  const startDiscussion = () => void runRound([]);

  const continueRound = () => void runRound(transcript);

  const endDiscussion = async () => {
    if (transcript.length === 0) return;
    setError(null);
    setPhase("loading_closing");
    try {
      const res = await fetch("/api/committee-discussion/closing", {
        method: "POST",
        headers: jsonHeaders,
        credentials: "same-origin",
        body: JSON.stringify({
          topic: topic.trim(),
          transcript,
          ...(committeeTurnId ? { committeeTurnId } : {}),
        }),
      });
      const data = (await res.json()) as {
        cio?: CommitteeDiscussionLineDto;
        drucker?: CommitteeDiscussionLineDto;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.cio && data.drucker) {
        setTranscript((prev) => [...prev, data.cio!, data.drucker!]);
      }
      setPhase("closed");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "정리 발언 실패");
      setPhase("after_round");
    }
  };

  const generateReport = async () => {
    if (transcript.length === 0) return;
    setError(null);
    setLoadingReport(true);
    setReportMd(null);
    try {
      const res = await fetch("/api/committee-discussion/report", {
        method: "POST",
        headers: jsonHeaders,
        credentials: "same-origin",
        body: JSON.stringify({
          topic: topic.trim(),
          transcript,
        }),
      });
      const data = (await res.json()) as { markdown?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setReportMd(data.markdown ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "보고서 생성 실패");
    } finally {
      setLoadingReport(false);
    }
  };

  const busyRound = phase === "loading_round";
  const busyClosing = phase === "loading_closing";
  const showContinue = phase === "after_round";
  const showClosed = phase === "closed";

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 bg-slate-50 p-6 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">투자위원회 · 턴제 토론</h1>
        <Link href="/" className="text-sm text-slate-500 underline underline-offset-4 hover:text-slate-800">
          ← dev_support 홈
        </Link>
      </div>
      <p className="text-sm text-slate-500">
        Hindenburg → James Simons → CIO → Peter Drucker 순으로 한 라운드씩 발언합니다. 서버가 조회한 보유·관심 원장이 시스템 프롬프트에 포함됩니다(조일현 페르소나는 제외). 토론 내용은 이 화면에만 쌓이며 일반 persona-chat 세션과는 별도입니다. 피드백은 서버에 턴 ID로 저장되어 위원회 전용 장기 기억(committee-lt)에 반영됩니다. 조일현 Markdown 보고서는{" "}
        <strong className="font-medium text-slate-700">아래 버튼을 눌렀을 때만</strong> 서버가 생성합니다.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
        <strong className="text-slate-800">위원회 피드백 기억 (committee-lt)</strong>
        <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap">{committeeLongTerm ?? "—"}</p>
      </div>

      <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">토론 주제</span>
          <textarea
            className="min-h-[100px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            value={topic}
            maxLength={TOPIC_MAX}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="오늘 위원회에 올릴 질문·맥락…"
            disabled={busyRound || busyClosing || transcript.length > 0}
          />
        </label>
        <p className="text-xs text-slate-500">
          {topic.length}/{TOPIC_MAX}자 · 시작 후에는 주제를 바꾸려면 페이지를 새로고침하세요.
        </p>

        {transcript.length === 0 ? (
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={!canStart}
            onClick={() => void startDiscussion()}
          >
            {busyRound ? "라운드 실행 중…" : "토론 시작 (1라운드)"}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">기록</h2>
        <div className="max-h-[480px] space-y-4 overflow-y-auto rounded-lg border border-dashed border-slate-200 p-3">
          {transcript.length === 0 ? (
            <p className="text-sm text-slate-400">아직 발언이 없습니다.</p>
          ) : (
            transcript.map((line, i) => (
              <div key={`${line.slug}-${i}`} className="border-b border-slate-100 pb-3 last:border-0">
                <div className="text-xs font-semibold text-slate-500">
                  {line.displayName}{" "}
                  <span className="font-mono text-slate-400">({line.slug})</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{line.content}</p>
              </div>
            ))
          )}
        </div>

        {committeeTurnId && transcript.length > 0 ? (
          <CommitteeTurnFeedbackRow
            committeeTurnId={committeeTurnId}
            onSaved={(summary) => {
              if (summary) setCommitteeLongTerm(summary);
              void loadCommitteeMemory();
            }}
          />
        ) : null}

        {showContinue ? (
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">다음 라운드에 덧붙일 메모 (선택)</span>
              <textarea
                className="min-h-[64px] rounded border border-slate-200 px-2 py-1 text-sm"
                value={roundNote}
                onChange={(e) => setRoundNote(e.target.value)}
                placeholder="추가 질문·초점…"
                disabled={busyRound || busyClosing}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={busyRound || busyClosing}
                onClick={() => void continueRound()}
              >
                {busyRound ? "진행 중…" : "한 라운드 더"}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                disabled={busyRound || busyClosing}
                onClick={() => void endDiscussion()}
              >
                {busyClosing ? "정리 발언 생성 중…" : "토론 종료 → CIO·Drucker 정리"}
              </button>
            </div>
          </div>
        ) : null}

        {showClosed ? (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-600">정리 발언이 위 기록에 추가되었습니다.</p>
          </div>
        ) : null}

        {transcript.length > 0 ? (
          <div className="border-t border-dashed border-emerald-200 bg-emerald-50/40 px-3 py-3 text-sm">
            <h3 className="font-semibold text-emerald-900">조일현 Markdown 보고서 (요청 시에만)</h3>
            <p className="mt-1 text-xs text-emerald-900/80">
              토론·정리 발언과 무관하게 자동 생성되지 않습니다. GPT Builder에 붙일 .md가 필요할 때만 아래 버튼을 누르세요.
            </p>
            <button
              type="button"
              className="mt-2 rounded-md bg-emerald-800 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={loadingReport || busyRound || busyClosing}
              onClick={() => void generateReport()}
            >
              {loadingReport ? "보고서 작성 중…" : "보고서 생성 (서버 호출)"}
            </button>
          </div>
        ) : null}
      </div>

      {reportMd !== null ? (
        <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-emerald-900">GPT Builder용 Markdown</h2>
            <button
              type="button"
              className="rounded border border-emerald-700 bg-white px-3 py-1 text-xs text-emerald-900 hover:bg-emerald-100"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(reportMd);
                } catch {
                  setError("클립보드 복사에 실패했습니다.");
                }
              }}
            >
              전체 복사
            </button>
          </div>
          <textarea
            readOnly
            className="min-h-[200px] w-full rounded border border-emerald-200 bg-white font-mono text-xs text-slate-800"
            value={reportMd}
          />
        </div>
      ) : null}
    </div>
  );
}
