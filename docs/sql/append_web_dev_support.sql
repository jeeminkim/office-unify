-- dev_support: 피드백(개인화) + 최고 평가 시 도출물 저장
-- Supabase SQL 에디터에서 한 번 실행 (service role API는 RLS 우회).

create table if not exists public.web_dev_support_feedback (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  rating text not null check (rating in ('top', 'ok', 'weak')),
  task_type text not null check (task_type in ('flow', 'sql', 'ts')),
  prompt text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_web_dev_support_feedback_user_created
  on public.web_dev_support_feedback (user_key, created_at desc);

create table if not exists public.web_dev_support_saved_best (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  feedback_id uuid references public.web_dev_support_feedback (id) on delete set null,
  task_type text not null check (task_type in ('flow', 'sql', 'ts')),
  title text,
  prompt text not null,
  flow_markdown text,
  mermaid_code text,
  content text,
  example text,
  explanation text,
  warnings jsonb,
  db_type text,
  schema_context text,
  sql_style_hints text,
  raw_result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_web_dev_support_saved_best_user_created
  on public.web_dev_support_saved_best (user_key, created_at desc);

comment on table public.web_dev_support_feedback is 'dev_support 결과 평가 — ok/weak는 개인화 힌트 집계에 사용';
comment on table public.web_dev_support_saved_best is '평가 top일 때만 저장되는 Flow(md)/SQL/TS 스냅샷';

comment on column public.web_dev_support_saved_best.flow_markdown is 'Flow: 순서도용 마크다운(Mermaid+요약). SQL/TS는 null 가능';
