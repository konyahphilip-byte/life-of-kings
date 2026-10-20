# Chale AWS runtime integration

Updated October 20, 2026. Implemented in the existing Ecovibes gateway; still local and not a public deployment. This document is evidence and setup guidance, not permission to create paid services.

## Implemented

`server/chale-provider.mjs` defaults the explicitly selected Bedrock adapter to `CHALE_BEDROCK_AUTH=iam`. `server/chale-bedrock-iam.mjs` uses the pinned AWS SDK, its renewable default credential chain and SigV4. An ECS task role can authenticate without an OpenAI key or a saved Bedrock bearer token. Configuration status does not verify credentials, model entitlement, billing or a successful answer.

The runtime pins the regional AWS endpoint and ignores endpoint overrides and legacy bearer-auth preferences. It allows one SDK attempt per request, explicit output-token limits, caller cancellation, a whole-request deadline including credential resolution/body collection, and at most 256 KiB before SDK JSON deserialization. Provider error text and metadata do not escape. Grounded mode still rejects action tools, incomplete answers and reasoning transcripts. No paid fallback was added.

Explicit `CHALE_BEDROCK_AUTH=bearer` retains the earlier private-token adapter. A fixed short-term bearer token expires; use the IAM path for AWS workloads. No credential or approval flag was enabled by this code change.

## Operator settings

After model access, pricing, the private evaluation and the deployment budget have been verified, the intended settings are:

```dotenv
CHALE_PROVIDER=bedrock
CHALE_BEDROCK_AUTH=iam
AWS_REGION=eu-north-1
# Candidate only; verify current availability, entitlement and price before enabling.
AI_MODEL=qwen.qwen3-32b-v1:0
CHALE_ALLOW_PAID=false
CHALE_REMOTE_APPROVED=false
CHALE_GLOBAL_DAILY_REQUESTS=10
CHALE_CONCURRENCY=1
CHALE_MAX_OUTPUT_TOKENS=256
CHALE_TIMEOUT_MS=45000
```

Both approval flags must be explicitly enabled by the operator after authorization. A request limit is not a dollar spending cap. The existing allowance is at most ten private inference attempts and US$1 total; no calls were made in this slice. Keep a durable reservation/attempt receipt and disable retries before using that allowance. Do not treat it as approval for recurring hosting or public exposure.

Use a non-root application role scoped to the selected model and region. Do not create long-lived access keys. Generate/review its baseline permissions with the AWS IAM tooling before applying them; do not apply an inferred wildcard policy. For the new SDK module, the policy-generation command is:

```sh
uvx iam-policy-autopilot@latest generate-policies "$PWD/server/chale-bedrock-iam.mjs" --language javascript --region eu-north-1 --service-hints bedrock-runtime --pretty
```

The tool was run locally against this module with the actual account and region; the JavaScript language override is required for its `.mjs` extension. Its generated baseline includes unused conditional Converse permissions for guardrails, server tools and bearer access. **Do not apply that broad baseline.** It needs review and narrowing to the selected model invocation before any role is created. No IAM policy was applied. Resolve the actual account/principal and model ARN first. Infrastructure, execution and application roles have separate permissions; the application role must not administer IAM, subscribe to models or access unrelated secrets.

## Hosting shape

One Node container serves the built Vite frontend and `/api/v1` together. Preserve the existing Supabase database and Auth. AWS currently recommends ECS Express Mode for new App Runner customers; it provisions Fargate, a load balancer and networking, all of which can incur charges.

The root Dockerfile uses a non-root runtime and explicit source copies. Its positive `.dockerignore` excludes local environment files, Git history, dependency folders and working data. Only the public Supabase URL/publishable key are build arguments. Server secrets are runtime-only. The image starts with inference disabled. Resolve the Node image to a reviewed digest, build/scan the container and record its digest before release. Docker is unavailable locally, so a container build has not been verified.

Required runtime configuration includes `NODE_ENV=production`, `ECOVIBES_SERVE_WEB=true`, the assigned `PORT`, exact HTTPS `APP_ORIGINS`, and server Supabase public configuration. Supply a verified-TLS `DATABASE_URL` through the host's private secret mechanism. Never embed it or AWS credentials in build arguments, source or browser variables. Production deliberately rejects SQLite and checks schema marker `20261008210729_provider_onboarding`.

Start with one API task because concurrency is process-local. Guest quotas currently use the socket address and therefore share a proxy bucket behind an AWS load balancer. Require verified sign-in for the private trial or implement and verify a trusted-proxy policy before general public access. Give the load balancer more time than the configured inference deadline. Configure the exact hosted origin in Supabase Auth and test cookies, CSRF, reload and account isolation.

## Verification evidence and current blockers

- The IAM configuration regression failed before implementation. The two focused provider suites subsequently passed 29 tests with real SDK signing and a simulated network boundary. No real credentials or model service were used.
- The full isolated working-copy suite passed 221 of 222 tests. The remaining failure is `ProviderPortal.test.tsx`: “does not restore an old approved listing when discovery finishes after an edit.” These existing provider files were unchanged by the AWS slice; this is not a green release suite.
- The production build passed with the existing large Communications chunk warning. The isolated Chale HTTP workflow passed 19 checks with a simulated provider and temporary SQLite. These results do not establish hosted PostgreSQL or real AWS inference.
- Source hashes were checked before integrating the gateway, tests and dependency lock. Twenty-six SDK dependency packages were added; existing locked package versions did not change. The payment/provider/Games work was preserved.
- AWS CLI profile `ecovibes` is expired. Both login modes failed before the browser; an isolated AWS CRT P-256 generation reproduced `AWS_ERROR_SYS_CALL_FAILURE`. No signing key or credential was printed. The browser console is signed in after the owner's security step, but that does not refresh the CLI.
- AWS CloudShell reports account verification in progress and cannot create its environment; the message says this may take up to two days for a new account. No environment was deleted or workaround attempted. No role, paid infrastructure or model invocation was created.
- The current working tree includes unpublished Games work and unrelated ongoing changes. It is a local verification copy, not an approved release source. Assemble and independently verify a selective release from published main; never push local main wholesale.

## Evidence required before calling Chale live

1. Verify an authenticated non-root AWS identity and narrowly scoped model access. Resolve the current regional price and any model terms before a paid call.
2. Reserve and run one synthetic, bounded inference under the existing private allowance; preserve success/failure, stop reason, usage, latency and cost estimate. Review answer quality before more calls.
3. Complete a reviewed release, container build/scan, a successful full release suite, hosted database connection and an approved hosting budget. Keep unrelated game/financial activation outside the release.
4. Deploy one task, then verify HTTPS `/`, JSON `/api/v1/health`, assets, same-origin authentication and `/api/v1/ai/status`.
5. Make a real hosted `POST /api/v1/ai/chat` call and require a completed, nonempty reply with `source: "model"`. Verify real guide navigation/catalog evidence, privacy refusal, Stop, safe failure and explicit learning pause/reset with authorized test accounts.

No successful hosted reply or public URL is established by the current evidence. To disable inference, set `CHALE_PROVIDER=disabled` and restart; guide/search fallback remains available without a schema change.

## Primary references

- [AWS Bedrock authentication](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html)
- [Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html)
- [AWS App Runner availability and ECS Express Mode](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html)
