/**
 * `persona_memory.last_feedback_summary`에 저장하는 웹 전용 장기 기억.
 * JSON(v1)으로 구조화하며, 파싱 불가 시 레거시 평문으로 간주한다.
 * 저장소 전략·분리 테이블 검토는 `docs/persona-long-term-memory-strategy.md` 참고.
 */

import { PERSONA_CHAT_MEMORY_SNIPPET_MAX_CHARS } from '@office-unify/shared-types';

const SNIPPET_MAX = PERSONA_CHAT_MEMORY_SNIPPET_MAX_CHARS;
const ENTRY_CAP = 24;
const STORAGE_MAX = 4000;

/** 장기 기억 스니펫: 원문 전체를 넣지 않고 짧게 요약·절단 */
export function buildAssistantSnippetForLongTerm(assistantText: string): string {
  const t = assistantText.replace(/\s+/g, ' ').trim();
  if (t.length <= SNIPPET_MAX) return t;
  return `${t.slice(0, SNIPPET_MAX - 1)}…`;
}

export const WEB_PERSONA_LONG_TERM_SOURCE = 'web_persona_chat' as const;

export type WebPersonaLongTermPayloadV1 = {
  v: 1;
  source: typeof WEB_PERSONA_LONG_TERM_SOURCE;
  updatedAt: string;
  entries: Array<{ at: string; snippet: string }>;
};

/** PB 장기 기억 이관 등에서 재사용 */
export function parseWebLongTermPayload(raw: string | null | undefined): WebPersonaLongTermPayloadV1 | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (
      o &&
      typeof o === 'object' &&
      (o as { v?: unknown }).v === 1 &&
      (o as { source?: unknown }).source === WEB_PERSONA_LONG_TERM_SOURCE &&
      Array.isArray((o as WebPersonaLongTermPayloadV1).entries)
    ) {
      return o as WebPersonaLongTermPayloadV1;
    }
  } catch {
    /* legacy plain text */
  }
  return null;
}

/** 프롬프트·UI 표시용: 구조화 항목 또는 레거시 평문 */
export function formatLongTermForPrompt(raw: string | null | undefined): string {
  const structured = parseWebLongTermPayload(raw);
  if (structured?.entries?.length) {
    return structured.entries
      .slice(-12)
      .map((e) => `· [${e.at}] ${e.snippet}`)
      .join('\n');
  }
  const t = raw?.trim();
  return t ?? '';
}

export function mergeWebLongTerm(prevRaw: string | null, assistantText: string): string {
  const stamp = new Date().toISOString();
  const snippet = buildAssistantSnippetForLongTerm(assistantText);

  const prevStruct = parseWebLongTermPayload(prevRaw);
  let payload: WebPersonaLongTermPayloadV1;

  if (prevStruct) {
    payload = {
      ...prevStruct,
      updatedAt: stamp,
      entries: [...prevStruct.entries, { at: stamp, snippet }].slice(-ENTRY_CAP),
    };
  } else if (prevRaw?.trim()) {
    payload = {
      v: 1,
      source: WEB_PERSONA_LONG_TERM_SOURCE,
      updatedAt: stamp,
      entries: [
        { at: stamp, snippet: '[이전 비구조 요약에서 이관]' },
        { at: stamp, snippet: prevRaw.trim().slice(0, SNIPPET_MAX) },
        { at: stamp, snippet },
      ],
    };
  } else {
    payload = {
      v: 1,
      source: WEB_PERSONA_LONG_TERM_SOURCE,
      updatedAt: stamp,
      entries: [{ at: stamp, snippet }],
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
