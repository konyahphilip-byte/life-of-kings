-- Activity based discovery, expiring Stories, and short video Reels.
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  created_at timestamptz not null default now()
);
create table public.people_presence (
  user_id uuid primary key references public.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
create table public.people_follows (
  user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,target_user_id),
  check(user_id <> target_user_id)
);
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  text text not null default '',
  asset_id uuid references public.media_assets(id),
  visibility text not null default 'public' check (visibility in ('public','followers')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index stories_active on public.stories(expires_at,created_at desc);
create table public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(story_id,viewer_id)
);
create table public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  caption text not null default '',
  asset_id uuid not null references public.media_assets(id),
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now()
);
create index reels_active on public.reels(status,created_at desc);
create table public.reel_views (
  reel_id uuid not null references public.reels(id) on delete cascade,
  viewer_id uuid not null references public.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(reel_id,viewer_id)
);
create table public.reel_likes (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(reel_id,user_id)
);
