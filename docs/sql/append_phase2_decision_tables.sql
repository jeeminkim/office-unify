-- Phase 2 append-only: 구조화된 의사결정 산출물 (실행/주문 없음)
-- 운영 적용: Supabase SQL editor에서 실행 후 `docs/DATABASE_SCHEMA.md`와 정합 확인.
-- 이후 hardening(버전·idempotency·vote FK 등): `append_phase2_decision_tables_hardening.sql` 를 별도 실행.

-- decision_artifacts: 분석 1회당 최종 위원회 결정 스냅샷
CREATE TABLE IF NOT EXISTS decision_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  chat_history_id INTEGER REFERENCES chat_history (id) ON DELETE SET NULL,
  analysis_type TEXT NOT NULL,
  final_decision TEXT NOT NULL,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  veto_applied BOOLEAN NOT NULL DEFAULT FALSE,
  veto_reason TEXT,
  weighted_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  normalized_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  decision_summary TEXT,
  committee_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_claims_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_artifacts_user_created
  ON decision_artifacts (discord_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_artifacts_chat
  ON decision_artifacts (chat_history_id);

-- committee_vote_logs: 위원별 judgment/vote/weight (설명 가능성)
CREATE TABLE IF NOT EXISTS committee_vote_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  chat_history_id INTEGER REFERENCES chat_history (id) ON DELETE SET NULL,
  analysis_type TEXT NOT NULL,
  persona_name TEXT NOT NULL,
  judgment TEXT NOT NULL,
  vote_value SMALLINT NOT NULL,
  weight_value DOUBLE PRECISION NOT NULL,
  weighted_score DOUBLE PRECISION NOT NULL,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  referenced_claim_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_committee_vote_logs_chat
  ON committee_vote_logs (chat_history_id, created_at DESC);

COMMENT ON TABLE decision_artifacts IS 'Phase2: LLM→claim→judgment→vote→veto 후 구조화 결정 (실행 없음)';
COMMENT ON TABLE committee_vote_logs IS 'Phase2: 위원별 투표 가중치 로그';
