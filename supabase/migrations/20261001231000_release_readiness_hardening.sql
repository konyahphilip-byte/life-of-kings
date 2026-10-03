-- Security and transaction-state hardening required before hosted launch.

-- Personalization is off until the account holder explicitly enables it.
alter table public.recommendation_settings
  alter column personalization_enabled set default false;

-- Preserve the pre-refund order state so rejected/failed refunds can be retried.
alter table public.refunds
  add column if not exists previous_order_status text
  check (previous_order_status is null or previous_order_status in ('delivered', 'disputed'));

-- Keep the selected catalog variant and its price snapshot with each order line.
alter table public.order_items
  add column if not exists variant_id text,
  add column if not exists variant_title text;

insert into public.ecovibes_schema_version(version)
values ('20261001231000_release_readiness_hardening')
on conflict (version) do nothing;
