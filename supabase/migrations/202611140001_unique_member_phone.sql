-- Enforce unique non-empty phone numbers across all member accounts in Postgres.
drop index if exists public.members_phone_partial_idx;
create unique index if not exists members_phone_unique_idx
  on public.members (phone)
  where phone <> '';
