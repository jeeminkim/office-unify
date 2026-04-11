/**
 * 웹 페르소나 채팅(일별 세션 + 장기 기억) 최소 DTO.
 */

/** URL/설정에서 쓰는 슬러그, 예: `ray-dalio` */
export type PersonaWebKey = string & { readonly __brand: 'PersonaWebKey' };

export function toPersonaWebKey(raw: string): PersonaWebKey {
  return raw.trim().toLowerCase() as PersonaWebKey;
}

/** KST 기준 일 단위 세션 식별에 쓰는 날짜 문자열 */
export type DailySessionDateKst = string & { readonly __brand: 'DailySessionDateKst' };

export type PersonaChatMessageRole = 'user' | 'assistant';

export type PersonaChatMessageDto = {
  id: string;
  role: PersonaChatMessageRole;
  content: string;
  createdAt: string;
};

export type PersonaChatSessionDto = {
  sessionId: string;
  personaKey: PersonaWebKey;
  sessionDateKst: DailySessionDateKst;
  messages: PersonaChatMessageDto[];
};

/** GET /api/persona-chat/session */
export type PersonaChatSessionInitResponseBody = {
  session: PersonaChatSessionDto;
  /** 표시·프롬프트용 장기 요약(구조화 JSON이면 펼친 텍스트) */
  longTermMemorySummary: string | null;
  /** 직전 KST 일의 마지막 assistant 한 줄(선택, 프롬프트 힌트용) */
  previousDayAssistantHint: string | null;
  /** 서버 레지스트리에 등록된 페르소나 슬러그 */
  registeredPersonaKeys: string[];
};

/** POST /api/persona-chat/message */
export type PersonaChatMessageRequestBody = {
  /** 생략 시 서버 기본 페르소나 */
  personaKey?: string;
  content: string;
  /**
   * 클라이언트가 생성한 멱등 키(권장: UUID).
   * 성공 응답이 동일 프로세스 캐시에 있으면 LLM/DB를 다시 실행하지 않는다.
   */
  idempotencyKey?: string;
};

/** 투자위원회 토론(턴제) 한 발언자의 한 줄 */
export type CommitteeDiscussionLineDto = {
  slug: string;
  displayName: string;
  content: string;
};

/** POST /api/persona-chat/feedback — 장기 기억에 반영할 답변 평가 */
export type PersonaChatFeedbackRating = 'top' | 'ok' | 'weak';

export type PersonaChatFeedbackRequestBody = {
  personaKey: string;
  assistantMessageId: string;
  rating: PersonaChatFeedbackRating;
  note?: string;
};

export type PersonaChatFeedbackResponseBody = {
  ok: true;
  longTermMemorySummary: string | null;
};

export type PersonaChatMessageResponseBody = {
  userMessage: PersonaChatMessageDto;
  assistantMessage: PersonaChatMessageDto;
  longTermMemorySummary: string | null;
  /** 동일 idempotencyKey로 이미 처리된 요청에 대한 재전송 응답 */
  deduplicated?: boolean;
  /**
   * Private Banker 전용 — 서버가 응답 형식을 최소 보정했을 때만 짧은 안내(선택).
   * `/persona-chat` 응답에서는 생략된다.
   */
  pbFormatNote?: string;
  /**
   * 투자위원회 페르소나(persona-chat) — 형식 보정 시에만 짧은 안내(선택).
   */
  personaFormatNote?: string;
  /** OpenAI 예산/폴백 등으로 Gemini를 썼을 때 서버 안내(선택). */
  llmProviderNote?: string;
};
