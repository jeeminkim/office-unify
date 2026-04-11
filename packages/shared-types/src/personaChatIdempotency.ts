import type { PersonaChatMessageResponseBody } from './personaChat';

export type PersonaChatRequestStatus = 'pending' | 'completed' | 'failed';

/**
 * LLM 완료 후 DB 단계 추적(복구·재시도용).
 * - `llm_done`: assistant 텍스트까지 확보, 메시지 쌍 미저장 가능
 * - `messages_done`: 메시지 행 저장 완료, 장기 기억 미반영 가능
 */
export type PersonaChatProcessingStage = 'llm_done' | 'messages_done' | null;

export type PersonaChatRequestRowDto = {
  id: string;
  userKey: string;
  idempotencyKey: string;
  personaKey: string;
  contentHash: string;
  userContent: string;
  status: PersonaChatRequestStatus;
  processingStage: PersonaChatProcessingStage;
  llmAssistantText: string | null;
  responseJson: PersonaChatMessageResponseBody | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};
