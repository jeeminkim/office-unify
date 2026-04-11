/**
 * 투자위원회 피드백 전용 장기 기억 — `persona_memory.persona_name` = `committee-lt` (일반 persona-chat·PB와 분리).
 */

import {
  PERSONA_CHAT_FEEDBACK_NOTE_MAX_CHARS,
  type PersonaChatFeedbackRating,
} from '@office-unify/shared-types';
import { toPersonaWebKey, type PersonaWebKey } from '@office-unify/shared-types';
import { sortLongTermEntriesForDisplay } from '../longTermEntryPriority';
import { buildAssistantSnippetForLongTerm } from '../webPersonaLongTerm';

const ENTRY_CAP = 20;
const STORAGE_MAX = 4000;

export const COMMITTEE_LT_MEMORY_KEY: PersonaWebKey = toPersonaWebKey('committee-lt');

export const COMMITTEE_LONG_TERM_SOURCE = 'committee_v1' as const;

export type CommitteeLongTermEntryV1 = {
  at: string;
  committeeTurnId: string;
  snippet: string;
  rating: PersonaChatFeedbackRating;
  userNote?: string;
};

export type CommitteeLongTermPayloadV1 = {
  v: 3;
  source: typeof COMMITTEE_LONG_TERM_SOURCE;
  updatedAt: string;
  entries: CommitteeLongTermEntryV1[];
};

export function parseCommitteeLongTermPayload(raw: string | null | undefined): CommitteeLongTermPayloadV1 | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (
      o &&
      typeof o === 'object' &&
      (o as { v?: unknown }).v === 3 &&
      (o as { source?: unknown }).source === COMMITTEE_LONG_TERM_SOURCE &&
      Array.isArray((o as CommitteeLongTermPayloadV1).entries)
    ) {
      return o as CommitteeLongTermPayloadV1;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function trimNote(note: string | null | undefined): string | undefined {
  const t = note?.trim();
  if (!t) return undefined;
  return t.slice(0, PERSONA_CHAT_FEEDBACK_NOTE_MAX_CHARS);
}

export function formatCommitteeLongTermEntryLine(e: CommitteeLongTermEntryV1): string {
  const date = e.at.slice(0, 10);
  const note = e.userNote?.trim()
    ? ` — 메모: ${e.userNote.trim().slice(0, PERSONA_CHAT_FEEDBACK_NOTE_MAX_CHARS)}`
    : '';
  return `· ${date} · (위원회) ${e.snippet}${note}`;
}

/** 피드백 우선순위 정렬 후 상위 N건 */
export function formatCommitteeLongTermForPrompt(raw: string | null | undefined): string {
  const structured = parseCommitteeLongTermPayload(raw);
  if (structured?.entries?.length) {
    const sorted = sortLongTermEntriesForDisplay(structured.entries);
    return sorted
      .slice(0, 12)
      .map((e) => formatCommitteeLongTermEntryLine(e))
      .join('\n');
  }
  return '';
}

export function mergeCommitteeLongTermWithFeedback(
  prevRaw: string | null,
  params: {
    committeeTurnId: string;
    sourceText: string;
    rating: PersonaChatFeedbackRating;
    userNote?: string | null;
  },
): string {
  const stamp = new Date().toISOString();
  const snippet = buildAssistantSnippetForLongTerm(params.sourceText);
  const note = trimNote(params.userNote ?? undefined);

  const prev = parseCommitteeLongTermPayload(prevRaw);
  const entry: CommitteeLongTermEntryV1 = {
    at: stamp,
    committeeTurnId: params.committeeTurnId,
    snippet,
    rating: params.rating,
    ...(note ? { userNote: note } : {}),
  };

  let payload: CommitteeLongTermPayloadV1;

  if (prev) {
    payload = {
      ...prev,
      updatedAt: stamp,
      entries: [...prev.entries, entry].slice(-ENTRY_CAP),
    };
  } else {
    payload = {
      v: 3,
      source: COMMITTEE_LONG_TERM_SOURCE,
      updatedAt: stamp,
      entries: [entry],
    };
  }

  let out = JSON.stringify(payload);
  while (out.length > STORAGE_MAX && payload.entries.length > 1) {
    payload = {
      ...payload,
      updatedAt: stamp,
      entries: payload.entries.slice(1),
    };
    out = JSON.stringify(payload);
  }
  return out;
}
