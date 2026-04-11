-- web_persona_chat 멱등 요청 테이블 (다중 인스턴스·Vercel에서 공유)
-- 기존 phase1 스키마와 충돌 없이 append 적용.

CREATE TABLE IF NOT EXISTS web_persona_chat_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  persona_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  user_content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  processing_stage TEXT,
  llm_assistant_text TEXT,
  response_json JSONB,
  user_message_id TEXT,
  assistant_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_web_persona_chat_requests_user_idem UNIQUE (user_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_web_persona_chat_requests_user_status
  ON web_persona_chat_requests (user_key, status, updated_at DESC);

COMMENT ON TABLE web_persona_chat_requests IS 'Persona chat POST 멱등·복구 추적 (LLM/메시지/기억 단계)';

-- updated_at은 애플리케이션에서 갱신한다. 공통 트리거가 있으면 여기서 생략 가능.
