-- Shared, privacy-conscious discovery signals and production launch controls.
-- The API remains the only reader/writer for these records.

alter table public.sessions
  add column if not exists auth_assurance text not null default 'aal1'
  check (auth_assurance in ('aal1', 'aal2'));

create table if not exists public.recommendation_activity_signals (
  user_id uuid not null references public.users(id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  pillar text not null check (pillar in ('connect','create','play','trade','grow','earn')),
  action text not null check (action in ('opened','saved','dismissed','purchased','followed','watched','liked','completed','attended','applied')),
  topic text not null check (char_length(topic) between 1 and 64),
  weight double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id, action, topic)
);
create index if not exists recommendation_activity_user_recent
  on public.recommendation_activity_signals(user_id, created_at desc);
create index if not exists recommendation_activity_topic
  on public.recommendation_activity_signals(user_id, topic, active);

insert into public.recommendation_activity_signals
  (user_id,item_type,item_id,pillar,action,topic,weight,active,created_at,updated_at)
select user_id,item_type,item_id,
  case when item_type='product' then 'trade' else 'grow' end,
  action,topic,weight,active,created_at,updated_at
from public.recommendation_signals
on conflict (user_id,item_type,item_id,action,topic) do nothing;

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  expires_at timestamptz not null,
  hits integer not null check (hits >= 0)
);
create index if not exists rate_limit_buckets_expiry
  on public.rate_limit_buckets(expires_at);

create table if not exists public.ecovibes_schema_version (
  version text primary key,
  applied_at timestamptz not null default now()
);
insert into public.ecovibes_schema_version(version)
values ('20261001230000_launch_controls_and_shared_learning')
on conflict (version) do nothing;

alter table public.recommendation_activity_signals enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.ecovibes_schema_version enable row level security;
revoke all on public.recommendation_activity_signals from anon, authenticated;
revoke all on public.rate_limit_buckets from anon, authenticated;
revoke all on public.ecovibes_schema_version from anon, authenticated;
