-- EcoVibes API schema for Supabase Postgres.
-- Access goes through the server API; no table is exposed to anon/authenticated clients.
create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  eco_id text not null unique,
  display_name text not null,
  password_salt text not null,
  password_hash text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create table public.roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('customer','seller','provider','trust_staff','support_staff','admin')),
  created_at timestamptz not null default now(),
  primary key(user_id, role)
);
create table public.sessions (
  token_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  csrf_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user on public.sessions(user_id);

create table public.provider_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  provider_type text not null default 'individual',
  business_name text,
  service_area text,
  verification_state text not null default 'unverified',
  created_at timestamptz not null default now()
);
create table public.seller_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  business_name text,
  location text,
  verification_state text not null default 'unverified',
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id),
  name text not null,
  description text not null default '',
  category text not null,
  product_type text not null default 'physical',
  currency text not null default 'GHS',
  price_minor integer not null check (price_minor > 0),
  cost_minor integer check (cost_minor is null or cost_minor >= 0),
  stock integer not null default 0 check (stock >= 0),
  variants_json text not null default '[]',
  fulfillment_type text not null check (fulfillment_type in ('own_inventory','supplier_fulfilled','dropship','external_checkout')),
  supplier_name text,
  shipping_info text,
  location text,
  image_url text,
  source_type text not null default 'direct',
  source_url text,
  source_external_id text,
  status text not null default 'active' check (status in ('active','paused','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_active on public.products(status,category,created_at desc);
create index products_seller on public.products(seller_id,status);
create unique index products_source_external on public.products(seller_id,source_type,source_external_id) where source_external_id is not null;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id),
  category text not null,
  title text not null,
  description text not null,
  area text not null,
  budget_minor integer not null check (budget_minor >= 0),
  currency text not null default 'GHS',
  timing text not null default 'asap' check (timing in ('asap','scheduled')),
  scheduled_at timestamptz,
  status text not null default 'open' check (status in ('open','assigned','in_progress','awaiting_customer','completed','cancelled','disputed')),
  assigned_provider_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_open on public.jobs(status,area,created_at desc);
create index jobs_customer on public.jobs(customer_id,created_at desc);
create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider_id uuid not null references public.users(id),
  amount_minor integer not null check (amount_minor > 0),
  note text not null,
  eta text not null,
  status text not null default 'pending' check (status in ('pending','selected','declined')),
  created_at timestamptz not null default now(),
  unique(job_id,provider_id)
);
create table public.job_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.users(id),
  currency text not null default 'GHS',
  total_minor integer not null check (total_minor > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','partially_shipped','shipped','delivered','cancelled','disputed','refund_requested')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','partially_refunded','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer on public.orders(buyer_id,created_at desc);
create table public.fulfillment_groups (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  seller_id uuid not null references public.users(id),
  status text not null default 'pending' check (status in ('pending','processing','shipped','delivered','cancelled')),
  tracking_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fulfillment_seller on public.fulfillment_groups(seller_id,status,created_at desc);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  group_id uuid not null references public.fulfillment_groups(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_minor integer not null check (unit_price_minor > 0),
  seller_id uuid not null references public.users(id)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider text not null,
  provider_reference text unique,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null,
  state text not null check (state in ('created','pending','paid','failed','refunded')),
  created_at timestamptz not null default now()
);
create table public.payment_webhook_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text,
  primary key(provider,event_id)
);
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  requester_id uuid not null references public.users(id),
  amount_minor integer not null check (amount_minor > 0),
  reason text not null,
  status text not null default 'requested' check (status in ('requested','approved','rejected','provider_pending','refunded')),
  provider_reference text,
  reviewer_id uuid references public.users(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  actor_id uuid not null references public.users(id),
  details_json text not null default '{}',
  created_at timestamptz not null default now()
);
create index events_aggregate on public.domain_events(aggregate_type,aggregate_id,created_at);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  target_type text,
  target_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications(user_id,read_at,created_at desc);
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  business_type text not null,
  evidence_note text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id uuid references public.users(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.support_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id),
  target_type text not null,
  target_id text not null,
  reason text not null,
  details text not null,
  status text not null default 'open' check (status in ('open','reviewing','resolved')),
  reviewer_id uuid references public.users(id),
  resolution_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  created_at timestamptz not null default now()
);
create table public.staff_access (
  user_id uuid not null references public.users(id) on delete cascade,
  staff_role text not null check (staff_role in ('admin','trust_staff','support_staff')),
  created_at timestamptz not null default now(),
  primary key(user_id,staff_role)
);

-- OAuth state is one-use and hashed; store tokens encrypted by the API before insertion.
create table public.store_connections (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('shopify')),
  shop_domain text not null unique,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text not null,
  status text not null default 'active' check (status in ('active','revoked','error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index store_connections_seller on public.store_connections(seller_id,status);
create table public.store_oauth_states (
  state_hash text primary key,
  seller_id uuid not null references public.users(id) on delete cascade,
  shop_domain text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- The browser never queries these tables directly. The API authenticates and authorizes every request.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'users','roles','sessions','provider_profiles','seller_profiles','products','jobs','job_offers','job_messages',
    'orders','fulfillment_groups','order_items','payments','payment_webhook_events','refunds','domain_events','notifications',
    'verification_requests','support_reports','audit_logs','staff_access','store_connections','store_oauth_states'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end $$;


-- LiveKit rooms are provisioned by the API; clients receive short lived scoped tokens.
create table public.media_sessions (
  id uuid primary key default gen_random_uuid(),
  room_name text not null unique,
  creator_id uuid not null references public.users(id),
  mode text not null check (mode in ('voice','video','live')),
  title text not null,
  visibility text not null check (visibility in ('private','public')),
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index media_sessions_feed on public.media_sessions(mode,visibility,status,created_at desc);
create table public.media_session_members (
  session_id uuid not null references public.media_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('host','participant','viewer','invited')),
  joined_at timestamptz,
  primary key(session_id,user_id)
);
