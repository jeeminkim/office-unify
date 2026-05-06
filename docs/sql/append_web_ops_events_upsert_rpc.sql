-- Apply manually in Supabase SQL Editor.
-- This migration is additive.
-- It creates/updates a fingerprint-based RPC for web_ops_events.
-- App code must gracefully fallback when this RPC is not installed.

create unique index if not exists ux_web_ops_events_fingerprint_not_null
on public.web_ops_events(fingerprint)
where fingerprint is not null;

create or replace function public.upsert_web_ops_event_by_fingerprint(
  p_user_key text,
  p_domain text,
  p_event_type text,
  p_severity text,
  p_code text,
  p_message text,
  p_detail jsonb,
  p_fingerprint text,
  p_status text default 'open',
  p_route text default null,
  p_component text default null,
  p_action_hint text default null
)
returns table (
  id uuid,
  inserted boolean,
  updated boolean,
  reopened boolean,
  ignored boolean,
  occurrence_count integer,
  status text,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_prev_status text;
  v_next_status text;
  v_occurrence integer;
begin
  if p_fingerprint is null or btrim(p_fingerprint) = '' then
    raise exception 'p_fingerprint is required';
  end if;

  select e.id, e.status, e.occurrence_count
    into v_id, v_prev_status, v_occurrence
  from public.web_ops_events e
  where e.fingerprint = p_fingerprint
  limit 1
  for update;

  if v_id is null then
    insert into public.web_ops_events (
      user_key,
      domain,
      event_type,
      severity,
      code,
      message,
      detail,
      fingerprint,
      status,
      route,
      component,
      action_hint,
      occurrence_count,
      first_seen_at,
      last_seen_at,
      created_at,
      updated_at
    ) values (
      nullif(p_user_key, ''),
      p_domain,
      p_event_type,
      p_severity,
      p_code,
      p_message,
      p_detail,
      p_fingerprint,
      coalesce(nullif(p_status, ''), 'open'),
      p_route,
      p_component,
      p_action_hint,
      1,
      now(),
      now(),
      now(),
      now()
    )
    returning
      web_ops_events.id,
      true,
      false,
      false,
      false,
      web_ops_events.occurrence_count,
      web_ops_events.status,
      web_ops_events.last_seen_at
    into id, inserted, updated, reopened, ignored, occurrence_count, status, last_seen_at;

    return next;
    return;
  end if;

  v_next_status := case
    when v_prev_status = 'ignored' then 'ignored'
    when v_prev_status = 'resolved' then 'open'
    when v_prev_status in ('open', 'investigating', 'backlog') then v_prev_status
    else coalesce(nullif(p_status, ''), 'open')
  end;

  update public.web_ops_events
  set occurrence_count = coalesce(v_occurrence, 1) + 1,
      last_seen_at = now(),
      updated_at = now(),
      message = p_message,
      detail = p_detail,
      severity = p_severity,
      event_type = p_event_type,
      code = p_code,
      domain = p_domain,
      route = coalesce(p_route, route),
      component = coalesce(p_component, component),
      action_hint = coalesce(p_action_hint, action_hint),
      status = v_next_status,
      resolved_at = case when v_prev_status = 'resolved' and v_next_status = 'open' then null else resolved_at end
  where web_ops_events.id = v_id
  returning
    web_ops_events.id,
    false,
    true,
    (v_prev_status = 'resolved' and v_next_status = 'open'),
    (v_next_status = 'ignored'),
    web_ops_events.occurrence_count,
    web_ops_events.status,
    web_ops_events.last_seen_at
  into id, inserted, updated, reopened, ignored, occurrence_count, status, last_seen_at;

  return next;
exception
  when unique_violation then
    select e.id, e.status, e.occurrence_count
      into v_id, v_prev_status, v_occurrence
    from public.web_ops_events e
    where e.fingerprint = p_fingerprint
    limit 1;
    if v_id is null then
      raise;
    end if;
    v_next_status := case
      when v_prev_status = 'ignored' then 'ignored'
      when v_prev_status = 'resolved' then 'open'
      when v_prev_status in ('open', 'investigating', 'backlog') then v_prev_status
      else coalesce(nullif(p_status, ''), 'open')
    end;

    update public.web_ops_events
    set occurrence_count = coalesce(v_occurrence, 1) + 1,
        last_seen_at = now(),
        updated_at = now(),
        message = p_message,
        detail = p_detail,
        severity = p_severity,
        event_type = p_event_type,
        code = p_code,
        domain = p_domain,
        status = v_next_status,
        resolved_at = case when v_prev_status = 'resolved' and v_next_status = 'open' then null else resolved_at end
    where web_ops_events.id = v_id
    returning
      web_ops_events.id,
      false,
      true,
      (v_prev_status = 'resolved' and v_next_status = 'open'),
      (v_next_status = 'ignored'),
      web_ops_events.occurrence_count,
      web_ops_events.status,
      web_ops_events.last_seen_at
    into id, inserted, updated, reopened, ignored, occurrence_count, status, last_seen_at;

    return next;
end;
$$;
