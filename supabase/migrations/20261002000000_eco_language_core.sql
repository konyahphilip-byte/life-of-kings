-- Eco Language profile foundation. Only the EcoVibes API reads or writes preferences.
create table public.user_language_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  profile_json jsonb not null default '{"preferredLanguage":"en-GH","contentLanguages":["en-GH"],"voiceInputLanguage":"en-GH","voiceOutputLanguage":"en-GH","regionCode":"GH","allowCodeSwitching":false}'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(profile_json) = 'object')
);

alter table public.user_language_preferences enable row level security;
revoke all on public.user_language_preferences from anon, authenticated;

insert into public.ecovibes_schema_version(version)
values ('20261002000000_eco_language_core')
on conflict (version) do nothing;
