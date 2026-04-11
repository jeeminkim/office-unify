-- 선택: 웹 전용 장기 기억 테이블 (현재 앱은 `persona_memory`에 JSON v1로 저장 유지)
-- 운영에서 Discord/레거시와 분리·감사가 필요해지면 적용 후 리포지토리를 전환한다.
-- 적용 전 `docs/persona-web-memory-migration.md` 참고.

CREATE TABLE IF NOT EXISTS web_persona_memory (
  user_key TEXT NOT NULL,
  persona_key TEXT NOT NULL,
  content_version INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_key, persona_key)
);

CREATE INDEX IF NOT EXISTS idx_web_persona_memory_updated ON web_persona_memory (updated_at DESC);

COMMENT ON TABLE web_persona_memory IS '웹 페르소나 전용 장기 기억(선택). payload는 web JSON v1 등 앱 규약.';
