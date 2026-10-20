# Chale US$0 launch

The owner selected a US$0 launch within free limits on 20 October 2026. This replaces the proposed paid AWS container deployment. Do not create paid AWS resources, upgrade accounts, enable prepaid AI Gateway billing, or switch to paid inference when a free allowance runs out.

## Intended services

- Existing Render `ecovibes-api`, on the Free service plan. Keep one instance and no paid disks or preview environments. Confirm the workspace is also on a free plan and review bandwidth/build limits before launch. Idle services sleep; the first visit can be slow.
- Existing Supabase project `poscxeapsaxuahausmoc`, only after confirming its organization/project remains within the Free plan. Preserve its data, Auth and row-level security. Never use ephemeral Render SQLite for production data.
- Cloudflare Workers AI on **Workers Free**, with no prepaid AI Gateway credits or paid billing route. Its published free allowance is 10,000 neurons per day, shared across account usage. Calls stop when the free allowance is exhausted. The selected model is `@cf/meta/llama-3.1-8b-instruct-fp8-fast`; availability, terms and account eligibility still require verification.

## App configuration

`CHALE_PROVIDER=cloudflare-free` selects a fixed Cloudflare HTTPS endpoint and the selected model. `AI_MODEL` and `CHALE_BASE_URL` cannot redirect this adapter. It uses the existing grounded Ecovibes workflow, not arbitrary external tools. Authentication, public catalogue filtering, consent-based learning and daily request quotas remain enforced by the app.

Keep `CHALE_ALLOW_PAID=false`. Activation also requires `CHALE_REMOTE_APPROVED=true` and `CHALE_CLOUDFLARE_FREE_PLAN_CONFIRMED=true`. The latter is an operator attestation after inspecting Cloudflare's plan; the app cannot independently prove the account's billing plan. Do not set it just because the adapter's tests pass. A paid-mode flag makes this adapter unconfigured.

An operator must configure `CLOUDFLARE_ACCOUNT_ID` and `CHALE_INFERENCE_KEY` through secure service settings. Do not put credentials in chat, source, browser bundles, committed environment files or logs. Scope the token to Workers AI for the intended account, and review permissions before creating it. Keep server credentials separate from public Supabase browser configuration.

Start with `CHALE_GLOBAL_DAILY_REQUESTS=100`, `CHALE_DAILY_REQUESTS=10`, `CHALE_GUEST_DAILY_REQUESTS=1`, `CHALE_CONCURRENCY=1` and `CHALE_MAX_OUTPUT_TOKENS=256`. Request quotas are not neuron estimates: prompt length and other account traffic affect the daily free allowance. The Cloudflare Free plan is the final cost boundary. The adapter performs one request, does not retry, and has no paid fallback. HTTP 429 is returned through the existing safe usage-limit handling. Guide-based help remains available without model inference where supported.

## Release and launch gates

1. Verify Render, Supabase and Cloudflare account plans and free allowances. Stop if any requires payment or an upgrade. Do not add a custom paid domain.
2. Resolve the existing Render startup failure. Its last failed deployment logged `DATABASE_URL is required in production`. This historical log does not prove today's saved environment is unchanged. Validate the current connection securely and retain scoped database permissions/RLS.
3. Configure the server-only token securely. Cloudflare Billing has now been inspected: Workers Free is Active and no payment method is on file. No token, model entitlement or real response has been verified. Render browser sign-in is pending, so its workspace billing/overage protections remain unverified.
4. Publish only the reviewed Chale free-launch changes, preserving unrelated Ecovibes work. The earlier AWS draft PR is not itself this free-launch release.
5. Run provider and app workflow checks; build the exact release. Deploy the reviewed commit to the existing Free Render service, without auto-upgrades.
6. Verify hosted health, sign-in, CSRF/cookies, account isolation, durable data and a real Chale answer. A successful mock or configuration-status response is not a live AI result. Confirm quota exhaustion stops model calls, and public responses never expose credentials or account identifiers.

## Evidence and limitations

The clean selective release passed 188 tests across 18 files and its production build. The existing 19-check HTTP workflow passed with an OpenAI Responses fixture and isolated SQLite; it verifies the app's existing tool and security workflow, not Cloudflare tool calling or real inference. `server/chale-cloudflare.test.mjs` adds 14 checks for configuration gates, endpoint/model pinning, request translation, one-call quota handling, public status privacy and the grounded public-catalogue workflow with a simulated response. The free adapter uses grounded guidance and public evidence; it does not enable native provider tool calls. These tests do not prove hosting availability, model quality, production database access or live inference. No paid resources, account upgrades or real inference calls were made during implementation.

Non-secret Render settings have been saved by merging only the Chale keys. Paid access is false, inference remains disabled and remote approval remains false. The inspected Cloudflare account ID and conservative quotas are saved; the token was not requested from any tool. This does not prove a successful deployment or database connection.

## Official references

- [Cloudflare Workers AI pricing and daily free limit](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare OpenAI-compatible endpoint](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/)
- [Render Free limitations](https://render.com/docs/free)
- [Supabase plans](https://supabase.com/pricing)
