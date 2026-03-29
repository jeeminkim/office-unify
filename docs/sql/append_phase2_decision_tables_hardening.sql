-- Phase 2 hardening (append-only): 기본 `append_phase2_decision_tables.sql` 적용 후 실행.
-- DROP/재생성 금지. ALTER / INDEX / CONSTRAINT 추가만 수행.

-- ---------------------------------------------------------------------------
-- decision_artifacts: 버전·감사 필드·idempotency·결정 CHECK
-- ---------------------------------------------------------------------------

ALTER TABLE decision_artifacts
  ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT '2.1.0';

ALTER TABLE decision_artifacts
  ADD COLUMN IF NOT EXISTS policy_version TEXT NOT NULL DEFAULT '1.1.0';

ALTER TABLE decision_artifacts
  ADD COLUMN IF NOT EXISTS veto_rule_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE decision_artifacts
  ADD COLUMN IF NOT EXISTS supporting_claim_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE decision_artifacts
  ADD COLUMN IF NOT EXISTS created_by_engine TEXT NOT NULL DEFAULT 'decision_engine';

ALTER TABLE decision_artifacts
  ADD COLUMN IF NOT EXISTS original_decision TEXT;

UPDATE decision_artifacts
SET original_decision = final_decision
WHERE original_decision IS NULL;

ALTER TABLE decision_artifacts
  ALTER COLUMN original_decision SET DEFAULT 'NO_ACTION';

ALTER TABLE decision_artifacts
  ALTER COLUMN original_decision SET NOT NULL;

ALTER TABLE decision_artifacts
  DROP CONSTRAINT IF EXISTS decision_artifacts_final_decision_check;

ALTER TABLE decision_artifacts
  ADD CONSTRAINT decision_artifacts_final_decision_check
  CHECK (final_decision IN ('BUY', 'ADD', 'HOLD', 'REDUCE', 'EXIT', 'NO_ACTION'));

ALTER TABLE decision_artifacts
  DROP CONSTRAINT IF EXISTS decision_artifacts_original_decision_check;

ALTER TABLE decision_artifacts
  ADD CONSTRAINT decision_artifacts_original_decision_check
  CHECK (original_decision IN ('BUY', 'ADD', 'HOLD', 'REDUCE', 'EXIT', 'NO_ACTION'));

-- 동일 분석·동일 엔진 버전 중복 방지 (chat_history 없는 행은 제외)
CREATE UNIQUE INDEX IF NOT EXISTS uq_decision_artifacts_chat_analysis_engine
  ON decision_artifacts (chat_history_id, analysis_type, engine_version)
  WHERE chat_history_id IS NOT NULL;

COMMENT ON COLUMN decision_artifacts.engine_version IS 'Decision engine semver (코드 DECISION_ENGINE_VERSION와 정합)';
COMMENT ON COLUMN decision_artifacts.policy_version IS '가중치·임계·veto 규칙 세트 버전';
COMMENT ON COLUMN decision_artifacts.veto_rule_ids_json IS '적용된 VetoRuleId 배열 JSON';
COMMENT ON COLUMN decision_artifacts.supporting_claim_ids_json IS '근거 claim id 배열 (중복 제거)';
COMMENT ON COLUMN decision_artifacts.created_by_engine IS '산출 컴포넌트 식별자';
COMMENT ON COLUMN decision_artifacts.original_decision IS 'veto 적용 전 위원회 후보 결정';

-- ---------------------------------------------------------------------------
-- committee_vote_logs: decision_artifact 연결·버전·raw 이유·무결성
-- ---------------------------------------------------------------------------

ALTER TABLE committee_vote_logs
  ADD COLUMN IF NOT EXISTS decision_artifact_id UUID REFERENCES decision_artifacts (id) ON DELETE SET NULL;

ALTER TABLE committee_vote_logs
  ADD COLUMN IF NOT EXISTS engine_version TEXT NOT NULL DEFAULT '2.1.0';

ALTER TABLE committee_vote_logs
  ADD COLUMN IF NOT EXISTS policy_version TEXT NOT NULL DEFAULT '1.1.0';

ALTER TABLE committee_vote_logs
  ADD COLUMN IF NOT EXISTS raw_vote_reason TEXT;

ALTER TABLE committee_vote_logs
  DROP CONSTRAINT IF EXISTS committee_vote_logs_judgment_check;

ALTER TABLE committee_vote_logs
  ADD CONSTRAINT committee_vote_logs_judgment_check
  CHECK (judgment IN ('BULLISH', 'BEARISH', 'NEUTRAL', 'CAUTION'));

ALTER TABLE committee_vote_logs
  DROP CONSTRAINT IF EXISTS committee_vote_logs_vote_value_check;

ALTER TABLE committee_vote_logs
  ADD CONSTRAINT committee_vote_logs_vote_value_check
  CHECK (vote_value IN (-1, 0, 1));

ALTER TABLE committee_vote_logs
  DROP CONSTRAINT IF EXISTS committee_vote_logs_confidence_check;

ALTER TABLE committee_vote_logs
  ADD CONSTRAINT committee_vote_logs_confidence_check
  CHECK (confidence_score >= 0::double precision AND confidence_score <= 1::double precision);

CREATE UNIQUE INDEX IF NOT EXISTS uq_committee_vote_logs_artifact_persona
  ON committee_vote_logs (decision_artifact_id, persona_name)
  WHERE decision_artifact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_committee_vote_logs_decision_artifact
  ON committee_vote_logs (decision_artifact_id);

COMMENT ON COLUMN committee_vote_logs.decision_artifact_id IS '부모 decision_artifacts.id (hardening 이후 행)';
COMMENT ON COLUMN committee_vote_logs.raw_vote_reason IS 'vote 산출 근거 한 줄(감사용)';
