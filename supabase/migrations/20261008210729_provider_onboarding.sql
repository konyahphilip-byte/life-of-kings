-- Provider services remain API-only; existing RLS and revoked browser grants apply.
alter table public.provider_profiles
  add column service_json text,
  add column revision integer not null default 0 check (revision >= 0),
  add column updated_at timestamptz;
alter table public.verification_requests
  add column target_role text check (target_role in ('seller','provider')),
  add column profile_version integer;
-- Older ambiguous verification requests require resubmission with an explicit scope.
-- Do not guess which role a multi-role account intended to verify.
create index verification_user_scope on public.verification_requests(user_id,target_role,status);
-- These API-only tables were created after the original RLS loop.
alter table public.media_sessions enable row level security;
alter table public.media_session_members enable row level security;
revoke all on public.media_sessions from anon, authenticated;
revoke all on public.media_session_members from anon, authenticated;
insert into public.ecovibes_schema_version(version)
values ('20261008210729_provider_onboarding') on conflict (version) do nothing;
