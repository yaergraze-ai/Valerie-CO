-- Valerie & CO — Supabase Postgres schema, RLS policies, indexes, and transactional RPCs

create table if not exists public.app_users (
  id text primary key,
  email text unique not null,
  password_hash text not null,
  role text not null default 'member' check (role in ('member', 'staff', 'admin', 'super_admin')),
  created_at timestamptz not null default now()
);

alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users add constraint app_users_role_check
  check (role in ('member', 'staff', 'admin', 'super_admin'));

create index if not exists app_users_role_idx on public.app_users (role);

create table if not exists public.app_sessions (
  token text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  expires_at bigint not null
);

create index if not exists app_sessions_user_id_idx on public.app_sessions (user_id);
create index if not exists app_sessions_expires_idx on public.app_sessions (expires_at);

create table if not exists public.google_accounts (
  sub text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists google_accounts_user_id_idx on public.google_accounts (user_id);

create table if not exists public.recovery_tokens (
  token text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  expires_at bigint not null
);

create index if not exists recovery_tokens_user_id_idx on public.recovery_tokens (user_id);

create table if not exists public.verification_codes (
  key text primary key,
  code_hash text not null,
  expires_at bigint not null,
  attempts integer not null default 0
);

create table if not exists public.google_challenges (
  nonce text primary key,
  expires_at bigint not null
);

create table if not exists public.products (
  id text primary key,
  seq bigint generated always as identity,
  name text not null,
  brand text not null,
  category text not null check (category in ('Sneakers', 'Heels', 'Boots', 'Flatshoes')),
  sub_category text,
  price numeric(12,2) not null check (price > 0),
  price_idr bigint check (price_idr is null or price_idr > 0),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  fresh boolean not null default false,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_seq_idx on public.products (active, seq desc);
create index if not exists products_category_idx on public.products (category);

create table if not exists public.members (
  id text primary key references public.app_users(id) on delete cascade,
  seq bigint generated always as identity,
  email text unique not null,
  phone text not null default '',
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop index if exists public.members_phone_partial_idx;
create unique index if not exists members_phone_unique_idx on public.members (phone) where phone <> '';

create table if not exists public.orders (
  id text primary key,
  seq bigint generated always as identity,
  receipt_number text,
  member_id text not null references public.app_users(id) on delete restrict,
  status text not null check (status in ('processing', 'shipped', 'delivered', 'cancelled')),
  currency text not null default 'USD' check (currency in ('USD', 'IDR')),
  total numeric(14,2) not null,
  payment_method text not null default 'direct',
  payment_status text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_member_seq_idx on public.orders (member_id, seq desc);
create index if not exists orders_seq_idx on public.orders (seq desc);

create table if not exists public.checkout_keys (
  user_id text not null references public.app_users(id) on delete cascade,
  key text not null,
  order_id text not null references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.coupons (
  code text primary key,
  seq bigint generated always as identity,
  percent integer not null check (percent >= 1 and percent <= 90),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id text primary key,
  seq bigint generated always as identity,
  member_id text not null references public.app_users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists tickets_member_seq_idx on public.tickets (member_id, seq desc);

create table if not exists public.subscribers (
  email text primary key,
  seq bigint generated always as identity,
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_meta (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security on every exposed public table
alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.google_accounts enable row level security;
alter table public.recovery_tokens enable row level security;
alter table public.verification_codes enable row level security;
alter table public.google_challenges enable row level security;
alter table public.products enable row level security;
alter table public.members enable row level security;
alter table public.orders enable row level security;
alter table public.checkout_keys enable row level security;
alter table public.coupons enable row level security;
alter table public.tickets enable row level security;
alter table public.subscribers enable row level security;
alter table public.store_settings enable row level security;
alter table public.app_meta enable row level security;

-- Revoke default public/client access on sensitive tables (backend service_role only)
revoke all on public.app_users from public, anon, authenticated;
revoke all on public.app_sessions from public, anon, authenticated;
revoke all on public.google_accounts from public, anon, authenticated;
revoke all on public.recovery_tokens from public, anon, authenticated;
revoke all on public.verification_codes from public, anon, authenticated;
revoke all on public.google_challenges from public, anon, authenticated;
revoke all on public.products from public, anon, authenticated;
revoke all on public.members from public, anon, authenticated;
revoke all on public.orders from public, anon, authenticated;
revoke all on public.checkout_keys from public, anon, authenticated;
revoke all on public.coupons from public, anon, authenticated;
revoke all on public.tickets from public, anon, authenticated;
revoke all on public.subscribers from public, anon, authenticated;
revoke all on public.store_settings from public, anon, authenticated;
revoke all on public.app_meta from public, anon, authenticated;

-- Allow read-only public catalogue & non-sensitive store configuration via publishable key
grant select on public.products to anon, authenticated;
grant select on public.store_settings to anon, authenticated;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists store_settings_public_read on public.store_settings;
create policy store_settings_public_read on public.store_settings
  for select
  to anon, authenticated
  using (id = 'main');

-- Ensure backend service_role retains explicit table access
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Transactional checkout: idempotent via checkout_keys, deadlock-safe sorted product row locks
create or replace function public.vco_create_order_tx(
  p_user_id text,
  p_key text,
  p_order jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing jsonb;
  v_req record;
  v_stock integer;
  v_active boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id || ':' || p_key));

  select o.data into v_existing
  from public.checkout_keys ck
  join public.orders o on o.id = ck.order_id
  where ck.user_id = p_user_id and ck.key = p_key;

  if found then
    return jsonb_build_object('duplicate', true, 'order', v_existing);
  end if;

  for v_req in
    select
      elem->>'productId' as product_id,
      sum((elem->>'quantity')::integer)::integer as total_qty
    from jsonb_array_elements(p_order->'items') as elem
    group by elem->>'productId'
    order by elem->>'productId'
  loop
    select stock, active into v_stock, v_active
    from public.products
    where id = v_req.product_id
    for update;

    if not found or not v_active then
      raise exception 'A product is unavailable' using errcode = 'P0002';
    end if;

    if v_stock < v_req.total_qty then
      raise exception 'Insufficient stock' using errcode = 'P0001';
    end if;

    update public.products
    set
      stock = stock - v_req.total_qty,
      data = jsonb_set(data, '{stock}', to_jsonb(stock - v_req.total_qty)),
      updated_at = now()
    where id = v_req.product_id;
  end loop;

  insert into public.orders (
    id,
    receipt_number,
    member_id,
    status,
    currency,
    total,
    payment_method,
    payment_status,
    data
  ) values (
    p_order->>'id',
    p_order->>'receiptNumber',
    p_order->>'memberId',
    p_order->>'status',
    coalesce(p_order->>'currency', 'USD'),
    (p_order->>'total')::numeric,
    coalesce(p_order->>'paymentMethod', 'direct'),
    p_order->'payment'->>'status',
    p_order
  );

  insert into public.checkout_keys (user_id, key, order_id)
  values (p_user_id, p_key, p_order->>'id');

  return jsonb_build_object('duplicate', false, 'order', p_order);
end;
$$;

-- Transactional order update / payment sync / refund with optional atomic stock restoration
create or replace function public.vco_transition_order_tx(
  p_order_id text,
  p_expected_status text,
  p_expected_payment_status text,
  p_next_order jsonb,
  p_restore_stock boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_payment_status text;
  v_req record;
begin
  select status, payment_status into v_status, v_payment_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if p_expected_status is not null and v_status <> p_expected_status then
    raise exception 'Order state changed concurrently' using errcode = 'P0003';
  end if;

  if p_expected_payment_status is not null and coalesce(v_payment_status, '') <> p_expected_payment_status then
    raise exception 'Order payment state changed concurrently' using errcode = 'P0003';
  end if;

  if p_restore_stock then
    for v_req in
      select
        elem->>'productId' as product_id,
        sum((elem->>'quantity')::integer)::integer as total_qty
      from jsonb_array_elements(p_next_order->'items') as elem
      group by elem->>'productId'
      order by elem->>'productId'
    loop
      update public.products
      set
        stock = stock + v_req.total_qty,
        data = jsonb_set(data, '{stock}', to_jsonb(stock + v_req.total_qty)),
        updated_at = now()
      where id = v_req.product_id;
    end loop;
  end if;

  update public.orders
  set
    status = p_next_order->>'status',
    currency = coalesce(p_next_order->>'currency', currency),
    total = (p_next_order->>'total')::numeric,
    payment_method = coalesce(p_next_order->>'paymentMethod', payment_method),
    payment_status = p_next_order->'payment'->>'status',
    data = p_next_order,
    updated_at = now()
  where id = p_order_id;

  return p_next_order;
end;
$$;

create or replace function public.vco_consume_google_challenge(
  p_nonce text,
  p_now bigint
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted text;
begin
  delete from public.google_challenges
  where nonce = p_nonce and expires_at > p_now
  returning nonce into v_deleted;

  return v_deleted is not null;
end;
$$;

create or replace function public.vco_reset_password_tx(
  p_token text,
  p_now bigint,
  p_password_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id text;
begin
  delete from public.recovery_tokens
  where token = p_token and expires_at > p_now
  returning user_id into v_user_id;

  if v_user_id is null then
    return false;
  end if;

  update public.app_users
  set password_hash = p_password_hash
  where id = v_user_id;

  delete from public.app_sessions
  where user_id = v_user_id;

  return true;
end;
$$;

create or replace function public.vco_update_password_tx(
  p_user_id text,
  p_password_hash text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.app_users
  set password_hash = p_password_hash
  where id = p_user_id;

  delete from public.app_sessions
  where user_id = p_user_id;
end;
$$;

create or replace function public.vco_delete_product_tx(
  p_product_id text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_settings jsonb;
begin
  delete from public.products where id = p_product_id;

  select data into v_settings
  from public.store_settings
  where id = 'main'
  for update;

  if found and v_settings ? 'homepage' and (v_settings->'homepage') ? 'productIds' then
    update public.store_settings
    set
      data = jsonb_set(
        v_settings,
        '{homepage,productIds}',
        coalesce(
          (
            select jsonb_agg(elem)
            from jsonb_array_elements(v_settings->'homepage'->'productIds') as elem
            where elem #>> '{}' <> p_product_id
          ),
          '[]'::jsonb
        )
      ),
      updated_at = now()
    where id = 'main';
  end if;
end;
$$;

create or replace function public.vco_create_user_tx(
  p_id text,
  p_email text,
  p_password_hash text,
  p_role text,
  p_member jsonb,
  p_google_sub text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.app_users (id, email, password_hash, role)
  values (p_id, p_email, p_password_hash, p_role);

  if p_google_sub is not null and length(p_google_sub) > 0 then
    insert into public.google_accounts (sub, user_id)
    values (p_google_sub, p_id);
  end if;

  insert into public.members (id, email, phone, name, data)
  values (
    p_id,
    p_email,
    coalesce(p_member->>'phone', ''),
    coalesce(p_member->>'name', ''),
    p_member
  );
end;
$$;

revoke all on function public.vco_create_user_tx(text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.vco_create_user_tx(text, text, text, text, jsonb, text) to service_role;

revoke all on function public.vco_create_order_tx(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.vco_create_order_tx(text, text, jsonb) to service_role;

revoke all on function public.vco_transition_order_tx(text, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.vco_transition_order_tx(text, text, text, jsonb, boolean) to service_role;

revoke all on function public.vco_consume_google_challenge(text, bigint) from public, anon, authenticated;
grant execute on function public.vco_consume_google_challenge(text, bigint) to service_role;

revoke all on function public.vco_reset_password_tx(text, bigint, text) from public, anon, authenticated;
grant execute on function public.vco_reset_password_tx(text, bigint, text) to service_role;

revoke all on function public.vco_update_password_tx(text, text) from public, anon, authenticated;
grant execute on function public.vco_update_password_tx(text, text) to service_role;

revoke all on function public.vco_delete_product_tx(text) from public, anon, authenticated;
grant execute on function public.vco_delete_product_tx(text) to service_role;
