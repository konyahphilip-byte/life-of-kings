-- Link verified Supabase Auth users to EcoVibes profiles.
-- The API owns all reads and writes; browser roles receive no table access.
create table public.supabase_identities (
  supabase_user_id uuid primary key,
  user_id uuid not null unique references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.supabase_identities enable row level security;
revoke all on public.supabase_identities from anon, authenticated;
