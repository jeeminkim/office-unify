"use client";

import { useState } from "react";
import type { PersonaChatFeedbackRating } from "@office-unify/shared-types";
import { PERSONA_CHAT_FEEDBACK_NOTE_MAX_CHARS } from "@office-unify/shared-types";

const jsonHeaders: HeadersInit = { "Content-Type": "application/json" };

type Props = {
  personaKey: string;
  assistantMessageId: string;
  onSaved?: (longTermMemorySummary: string | null) => void;
  /** 예: 페르소나 · J. Pierpont */
  assistantLabel?: string;
};

function ratingLabel(r: PersonaChatFeedbackRating): string {
  if (r === "top") return "매우 도움";
  if (r === "ok") return "보통";
  return "약함";
}

export function PersonaAssistantFeedbackRow(props: Props) {
  const { personaKey, assistantMessageId, onSaved, assistantLabel = "페르소나" } = props;
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<PersonaChatFeedbackRating | null>(null);

  const submit = async (rating: PersonaChatFeedbackRating) => {
    if (loading || submitted) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/persona-chat/feedback", {
        method: "POST",
        headers: jsonHeaders,
        credentials: "same-origin",
        body: JSON.stringify({
          personaKey: personaKey.trim(),
          assistantMessageId,
          rating,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; longTermMemorySummary?: string | null };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSubmitted(rating);
      setNoteOpen(false);
      onSaved?.(data.longTermMemorySummary ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <p className="mt-1 text-xs text-slate-500">
        평가 저장됨 ({ratingLabel(submitted)}) · 장기 기억에 반영되었습니다.
      </p>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-500">이 {assistantLabel} 답변이 도움이 되었나요?</span>
        <button
          type="button"
          disabled={loading}
          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          onClick={() => void submit("top")}
        >
          매우 도움
        </button>
        <button
          type="button"
          disabled={loading}
          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          onClick={() => void submit("ok")}
        >
          보통
        </button>
        <button
          type="button"
          disabled={loading}
          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          onClick={() => void submit("weak")}
        >
          약함
        </button>
        <button
          type="button"
          className="text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-600"
          onClick={() => setNoteOpen((v) => !v)}
        >
          {noteOpen ? "메모 닫기" : "메모 추가"}
        </button>
      </div>
      {noteOpen ? (
        <div className="mt-1.5">
          <textarea
            className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800"
            rows={2}
            maxLength={PERSONA_CHAT_FEEDBACK_NOTE_MAX_CHARS}
            placeholder="장기 기억에 함께 남길 메모(선택)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={loading}
          />
          <p className="text-[10px] text-slate-400">
            {note.length}/{PERSONA_CHAT_FEEDBACK_NOTE_MAX_CHARS}자
          </p>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
