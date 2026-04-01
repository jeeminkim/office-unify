-- Follow-up 질문용 옵션 스냅샷 (customId followup:select|… / followup:menu|… 본문 재파싱 최소화)
-- Supabase SQL editor에서 실행.

CREATE TABLE IF NOT EXISTS followup_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  chat_history_ref TEXT,
  analysis_type TEXT,
  persona_name TEXT,
  prompt_type TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followup_snapshots_user ON followup_snapshots (discord_user_id);
CREATE INDEX IF NOT EXISTS idx_followup_snapshots_created ON followup_snapshots (created_at DESC);

COMMENT ON TABLE followup_snapshots IS 'Follow-up 질문 UI: CHOICE / NEXT_ACTION / FREE_INPUT 옵션 스냅샷';
