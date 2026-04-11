/**
 * Private Banker 전용 장기 기억 — `persona_memory` 행 키는 채팅 세션(`j-pierpont`)과 분리한다.
 * - 채팅/세션: `persona_key` = `j-pierpont` (web_persona_chat_*)
 * - 장기 기억: `persona_name` = `j-pierpont-lt` (persona_memory 전용 네임스페이스)
 *
 * 기존에 `j-pierpont` 행에만 저장돼 있던 PB 기억은 읽기 시 병합 후, 이후 쓰기는 `j-pierpont-lt`로만 한다.
 * 레거시 행 수동 정리: docs/sql/cleanup_legacy_j_pierpont_persona_memory_optional.sql
 */

import { PERSONA_CHAT_MEMORY_SNIPPET_MAX_CHARS } from '@office-unify/shared-types';
import { toPersonaWebKey, type PersonaWebKey } from '@office-unify/shared-types';
import {
  formatLongTermForPrompt,
  parseWebLongTermPayload,
  type WebPersonaLongTermPayloadV1,
} from '../webPersonaLongTerm';

const SNIPPET_MAX = PERSONA_CHAT_MEMORY_SNIPPET_MAX_CHARS;
const ENTRY_CAP = 18;
const STORAGE_MAX = 4000;

/** `persona_memory.persona_name` — 채팅 슬러그 `j-pierpont`와 분리 */
export const PRIVATE_BANKER_LT_MEMORY_KEY: PersonaWebKey = toPersonaWebKey('j-pierpont-lt');

export const PRIVATE_BANKER_LONG_TERM_SOURCE = 'private_banker_v1' as const;

export type PrivateBankerLongTermPayloadV1 = {
  v: 2;
  source: typeof PRIVATE_BANKER_LONG_TERM_SOURCE;
  updatedAt: string;
  entries: Array<{ at: string; snippet: string }>;
};

export function parsePrivateBankerLongTermPayload(raw: string | null | undefined): PrivateBankerLongTermPayloadV1 | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (
      o &&
      typeof o === 'object' &&
      (o as { v?: unknown }).v === 2 &&
      (o as { source?: unknown }).source === PRIVATE_BANKER_LONG_TERM_SOURCE &&
      Array.isArray((o as PrivateBankerLongTermPayloadV1).entries)
    ) {
      return o as PrivateBankerLongTermPayloadV1;
    }
  } catch {
    /* legacy */
  }
  return null;
}

/** 답변에서 행동·약점·전제 힌트가 있는 줄을 우선해 200~500자 수준으로 압축 (숫자 원장 저장 금지) */
export function extractPrivateBankerMemorySnippet(assistantText: string): string {
  const lines = assistantText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const scored = lines.filter((l) =>
    /약점|패턴|체크리스트|전제|무효화|행동\s*분류|매매\s*유형|매수\s*유형|확인됨|미확인|추론|리스크|비중|손절|익절|추가매수|관심추가|관심제외/.test(l),
  );
  const body = (scored.length ? scored.join(' ') : assistantText.replace(/\s+/g, ' ').trim()).slice(0, SNIPPET_MAX);
  const t = body.trim();
  if (t.length <= SNIPPET_MAX) return t;
  return `${t.slice(0, SNIPPET_MAX - 1)}…`;
}

export function formatPrivateBankerLongTermForPrompt(raw: string | null | undefined): string {
  const structured = parsePrivateBankerLongTermPayload(raw);
  if (structured?.entries?.length) {
    return structured.entries
      .slice(-10)
      .map((e) => `· [${e.at.slice(0, 10)}] ${e.snippet}`)
      .join('\n');
  }
  return formatLongTermForPrompt(raw);
}

function seedFromWebPayload(web: WebPersonaLongTermPayloadV1, stamp: string): PrivateBankerLongTermPayloadV1 {
  const migrated = web.entries.slice(-8).map((e) => ({
    at: e.at,
    snippet: e.snippet.slice(0, SNIPPET_MAX),
  }));
  return {
    v: 2,
    source: PRIVATE_BANKER_LONG_TERM_SOURCE,
    updatedAt: stamp,
    entries: migrated.length
      ? [{ at: stamp, snippet: '[web_persona_chat 기억에서 이관 — 원장·숫자는 재확인 필요]' }, ...migrated]
      : [],
  };
}

export function mergePrivateBankerLongTerm(prevRaw: string | null, assistantText: string): string {
  const stamp = new Date().toISOString();
  const snippet = extractPrivateBankerMemorySnippet(assistantText);

  const prevPb = parsePrivateBankerLongTermPayload(prevRaw);
  const prevWeb = parseWebLongTermPayload(prevRaw);

  let payload: PrivateBankerLongTermPayloadV1;

  if (prevPb) {
    payload = {
      ...prevPb,
      updatedAt: stamp,
      entries: [...prevPb.entries, { at: stamp, snippet }].slice(-ENTRY_CAP),
    };
  } else if (prevWeb) {
    payload = seedFromWebPayload(prevWeb, stamp);
    payload.entries = [...payload.entries, { at: stamp, snippet }].slice(-ENTRY_CAP);
  } else if (prevRaw?.trim()) {
    payload = {
      v: 2,
      source: PRIVATE_BANKER_LONG_TERM_SOURCE,
      updatedAt: stamp,
      entries: [
        { at: stamp, snippet: '[비구조 요약에서 이관 — 수치·종목은 사용자 최신 자료로만]' },
        { at: stamp, snippet: prevRaw.trim().slice(0, SNIPPET_MAX) },
        { at: stamp, snippet },
      ],
    };
  } else {
    payload = {
      v: 2,
      source: PRIVATE_BANKER_LONG_TERM_SOURCE,
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
