-- Adaptive recommendations are written and read only by the EcoVibes API.
create table public.recommendation_preferences (
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 64),
  created_at timestamptz not null default now(),
  primary key (user_id, topic)
);

create table public.recommendation_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  personalization_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.recommendation_signals (
  user_id uuid not null references public.users(id) on delete cascade,
  item_type text not null check (item_type in ('product', 'job')),
  item_id uuid not null,
  action text not null check (action in ('opened', 'saved', 'dismissed', 'purchased')),
  topic text not null check (char_length(topic) between 1 and 64),
  weight double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id, action, topic)
);
create index recommendation_signals_user_recent
  on public.recommendation_signals(user_id, created_at desc);
create index recommendation_signals_user_topic
  on public.recommendation_signals(user_id, topic, active);

alter table public.recommendation_preferences enable row level security;
alter table public.recommendation_settings enable row level security;
alter table public.recommendation_signals enable row level security;
revoke all on public.recommendation_preferences from anon, authenticated;
revoke all on public.recommendation_settings from anon, authenticated;
revoke all on public.recommendation_signals from anon, authenticated;
