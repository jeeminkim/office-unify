-- Phase 1: 웹 페르소나 채팅 — 일별 세션(KST) + 메시지
-- 적용 전 Supabase SQL 편집기 또는 migration 파이프라인에서 실행.
-- 기존 legacy 테이블은 변경하지 않는다.

-- 일별 세션: user_key + persona_key + session_date_kst(달력) 유일
CREATE TABLE IF NOT EXISTS web_persona_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key TEXT NOT NULL,
  persona_key TEXT NOT NULL,
  session_date_kst DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_key, persona_key, session_date_kst)
);

CREATE INDEX IF NOT EXISTS idx_web_persona_sessions_lookup
  ON web_persona_chat_sessions (user_key, persona_key, session_date_kst DESC);

CREATE TABLE IF NOT EXISTS web_persona_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES web_persona_chat_sessions (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_persona_messages_session_time
  ON web_persona_chat_messages (session_id, created_at);

-- RLS: 서비스 롤 키는 기본적으로 RLS 우회. 앱에서 anon 키를 쓰게 될 경우
-- 별도 정책이 필요하다.

-- 장기 기억: legacy `persona_memory` 재사용
-- 웹에서는 discord_user_id 컬럼에 OfficeUserKey 문자열을,
-- persona_name 컬럼에 PersonaWebKey 슬러그(예: ray-dalio)를 넣는다.
-- last_feedback_summary 에 롤링 텍스트 요약을 저장한다.
-- NOT NULL 제약이 있는 환경이면 persona_memory 스키마에 맞춰 기본값을 채운 뒤 upsert 할 것.
