-- Valerie & CO — Durable Payment Callback Queue & Race-Safe Payment Initialization

create table if not exists public.payment_queue (
  id text primary key,
  seq bigint generated always as identity,
  dedupe_key text unique not null,
  order_id text not null,
  kind text not null default 'midtrans_webhook',
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  last_error text not null default '',
  next_run_at bigint not null default 0,
  locked_at bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_queue_pending_idx
  on public.payment_queue (next_run_at, seq)
  where status in ('pending', 'processing');

create index if not exists payment_queue_order_seq_idx
  on public.payment_queue (order_id, seq desc);

alter table public.payment_queue enable row level security;
revoke all on public.payment_queue from public, anon, authenticated;
grant all on public.payment_queue to service_role;
grant all on all sequences in schema public to service_role;

create or replace function public.vco_enqueue_payment_job(
  p_id text,
  p_dedupe_key text,
  p_order_id text,
  p_kind text,
  p_payload jsonb,
  p_now bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.payment_queue%rowtype;
  v_inserted public.payment_queue%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('pq_key:' || p_dedupe_key));

  select * into v_existing
  from public.payment_queue
  where dedupe_key = p_dedupe_key;

  if found then
    return jsonb_build_object('duplicate', true, 'job', to_jsonb(v_existing));
  end if;

  insert into public.payment_queue (
    id, dedupe_key, order_id, kind, payload, status, attempts, last_error, next_run_at, locked_at
  ) values (
    p_id, p_dedupe_key, p_order_id, coalesce(nullif(p_kind, ''), 'midtrans_webhook'), coalesce(p_payload, '{}'::jsonb),
    'pending', 0, '', coalesce(p_now, 0), 0
  )
  returning * into v_inserted;

  return jsonb_build_object('duplicate', false, 'job', to_jsonb(v_inserted));
end;
$$;

create or replace function public.vco_claim_payment_jobs(
  p_order_id text,
  p_now bigint,
  p_lock_timeout_ms bigint default 30000,
  p_limit integer default 10
)
returns setof public.payment_queue
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  if p_order_id is not null and length(p_order_id) > 0 then
    perform pg_advisory_xact_lock(hashtext('pq_order:' || p_order_id));
  end if;

  return query
  with picked as (
    select pq.id
    from public.payment_queue pq
    where
      (p_order_id is null or length(p_order_id) = 0 or pq.order_id = p_order_id)
      and (
        (pq.status = 'pending' and pq.next_run_at <= p_now)
        or (pq.status = 'processing' and pq.locked_at < (p_now - coalesce(p_lock_timeout_ms, 30000)))
      )
    order by pq.seq asc
    limit v_limit
    for update skip locked
  )
  update public.payment_queue q
  set
    status = 'processing',
    locked_at = p_now,
    updated_at = now()
  from picked
  where q.id = picked.id
  returning q.*;
end;
$$;

create or replace function public.vco_finish_payment_job(
  p_id text,
  p_status text,
  p_attempts integer,
  p_next_run_at bigint,
  p_last_error text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.payment_queue
  set
    status = p_status,
    attempts = coalesce(p_attempts, attempts),
    next_run_at = coalesce(p_next_run_at, 0),
    last_error = coalesce(p_last_error, ''),
    locked_at = 0,
    updated_at = now()
  where id = p_id;
end;
$$;

create or replace function public.vco_set_payment_init_tx(
  p_order_id text,
  p_payment_patch jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order jsonb;
  v_cur_payment jsonb;
  v_cur_status text;
  v_merged_payment jsonb;
  v_next_order jsonb;
begin
  select data into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  v_cur_payment := coalesce(v_order->'payment', '{}'::jsonb);
  v_cur_status := coalesce(nullif(v_cur_payment->>'status', ''), 'pending');

  -- Never allow Snap URL / Core API init write-back to overwrite settled/failed/refunded state
  v_merged_payment := (v_cur_payment || coalesce(p_payment_patch, '{}'::jsonb))
    || jsonb_build_object('status', v_cur_status);

  v_next_order := jsonb_set(v_order, '{payment}', v_merged_payment);

  update public.orders
  set
    payment_status = v_merged_payment->>'status',
    data = v_next_order,
    updated_at = now()
  where id = p_order_id;

  return v_next_order;
end;
$$;

revoke all on function public.vco_enqueue_payment_job(text, text, text, text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.vco_enqueue_payment_job(text, text, text, text, jsonb, bigint) to service_role;

revoke all on function public.vco_claim_payment_jobs(text, bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.vco_claim_payment_jobs(text, bigint, bigint, integer) to service_role;

revoke all on function public.vco_finish_payment_job(text, text, integer, bigint, text) from public, anon, authenticated;
grant execute on function public.vco_finish_payment_job(text, text, integer, bigint, text) to service_role;

revoke all on function public.vco_set_payment_init_tx(text, jsonb) from public, anon, authenticated;
grant execute on function public.vco_set_payment_init_tx(text, jsonb) to service_role;
