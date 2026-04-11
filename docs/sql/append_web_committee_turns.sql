-- 투자위원회 토론 durable id(`committee_turn_id`) 및 피드백 연결용 최소 테이블.
-- 적용: Supabase SQL Editor에서 한 번 실행(멱등: IF NOT EXISTS).

create table if not exists public.web_committee_turns (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  topic text not null,
  transcript_excerpt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_committee_turns_user_key_idx on public.web_committee_turns (user_key);
create index if not exists web_committee_turns_created_at_idx on public.web_committee_turns (created_at desc);

comment on table public.web_committee_turns is '투자위원회 토론 세션(한 주제·연속 라운드). 피드백·장기 기억은 persona_memory committee-lt와 별도로 연결.';
