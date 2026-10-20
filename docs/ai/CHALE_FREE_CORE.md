# Chale Free Core — October 16, 2026

## Recovery audit and implementation

The existing app is React/TypeScript/Vite, with a Node HTTP API, cookie sessions linked to Supabase Auth, Postgres in production and SQLite for local checks. Chale already had a safe app-guide fallback, public catalog search, six bounded read/draft tools, CSRF/origin checks, opt-in recommendation ranking and account-change isolation. It depended on a paid OpenAI key and defaulted to a large model. Hosted deployment and production account/payment checks remain unfinished.

Implemented inside that app:

- Central provider boundary in `server/chale-provider.mjs`: native Ollama, compatible local/self-hosted inference, optional Bedrock Converse, and the existing OpenAI tool workflow. Disabled by default. No provider retry or paid fallback. Bedrock/OpenAI require explicit paid approval. Remote self-hosted endpoints require HTTPS, authentication and explicit remote approval. Chat payloads cannot select endpoints, models, keys or limits.
- Free Core uses server-side guide/catalog retrieval and one generation. It exposes no action tools or private records. Weak guide matches are excluded; unsupported questions, empty searches and explicit questions about the unavailable Wallet receive a labelled deterministic answer without model expense. Physical-wallet product searches and separate Marketplace checkout guidance retain their existing paths. The Wallet route is currently English keyword matching, not complete multilingual intent detection. Existing six-tool workflow remains available only with the explicitly enabled OpenAI adapter.
- Database-enforced request allowances: 20/day per signed-in identity, 5/day per guest socket address, 200/day platform total by default; UTC date reset, plus existing 10/minute abuse limit. Attempts count even if busy, failed or handled by the guide. Caller-supplied IDs and forwarded IP headers cannot select another quota. No migration needed: existing `rate_limit_buckets` is used.
- One concurrent generation per API process by default, 256 output tokens in Free Core, timeout, cancellation, response-body bounds, and incomplete-response rejection. Usage reports only numeric counters and duration; logs exclude prompts, answers and account identifiers. Public status exposes no endpoint/key. No persistent conversation memory or cross-user response cache was added.
- UI explains model data use, request allowance/reset, busy and exhausted states. Canonical guide cards and existing offline/stop/account-switch protections remain.

## Private runtime actually selected

The available Mac is Intel x64, macOS 13.7.8, 8 GiB RAM, approximately 20 GiB free storage. Current [Ollama requires macOS 14 or later](https://docs.ollama.com/macos), so it was not installed. No OS upgrade or global package installation was attempted.

The official [llama.cpp](https://github.com/ggml-org/llama.cpp) macOS x64 build `b11669` loads successfully on this machine. It serves the official [Qwen3-0.6B-GGUF](https://huggingface.co/Qwen/Qwen3-0.6B-GGUF) Q8_0 model (Apache-2.0). This is a small prototype model, not a claim of production quality or African-language competence. Qwen3.5-4B remains an evaluation candidate for suitable hardware; it was not silently substituted in reported results.

Pinned acquisition:

- Runtime archive: `https://github.com/ggml-org/llama.cpp/releases/download/b11669/llama-b11669-bin-macos-x64.tar.gz`
- Runtime SHA-256: `cab28238d78158109b48deb27b05d50e0dcef56275d2e76da9ca8281526c7532`
- Model revision: `23749fefcc72300e3a2ad315e1317431b06b590a`
- Model file: `Qwen3-0.6B-Q8_0.gguf`, 639,446,688 bytes
- Model SHA-256: `9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031`
- Both downloaded artifacts were independently hash-checked. They remain under ignored `work/chale-runtime/`; neither is a repository asset.

`npm run dev:chale-local` serves the existing built EcoVibes app at `http://127.0.0.1:8790`, with a separate SQLite preview database. The model binds only loopback port 11435. It has a random per-run key shared with the API in memory, restricted CORS, no model UI, no built-in file/shell tools, and no MCP proxy. The launcher uses an environment whitelist and does not load the app `.env` or cloud credentials. Ports already owned by other processes cause failure. Stop the launcher to stop its children. Existing app/database on other ports is preserved.

After `npm run build`, start that launcher, then run `npm run test:chale-local`. This explicit test creates a synthetic local account and exercises real HTTP/model inference. Results go to ignored `work/chale-runtime/evaluations/<timestamp>.json`, with the latest also available at `local-evaluation.json`. Setup and chat requests have deadlines; failure receipts identify the phase. It rejects cloud/paid configuration and redirects, and uses no production records. It is not run automatically by the unit suite.

## Evidence and model limitations

First real backend inference answered a provider-onboarding question in about 10 seconds. Five initial HTTP requests then completed at approximately 4–9 seconds each. The sixth guest request was denied with 429 `ai_daily_limit` before inference. Money and private-data requests did not execute actions or expose records.

Manual review found an unsupported recipe-suggestions claim in the initial off-topic answer and overly definitive wording for an empty catalog. This is a quality failure, not a launch pass. Added deterministic handling for weak/no guide matches and empty searches, with regression coverage. A larger evaluation set, multilingual review, longer conversations and adversarial tests remain necessary; a prompt and five samples do not establish general factual reliability.

The earlier local verification passed 203 unit/component tests across 18 files, production build, and 19 HTTP checks with a simulated paid provider. Its separate five-case real local evaluation passed protocol/evidence assertions, but manual review found generic provider instructions and imprecise wallet wording. A subsequent real rerun timed out on its first inference: this failure is preserved. After restarting the preview and adding canonical Wallet handling, another five-case run passed (two actual inferences, three explicit guide replies). Wallet no longer depends on model wording. The newer suite passed 208 tests and 19 HTTP checks. These samples do not establish production quality or uptime; see `docs/CONTINUATION.md` for current verification and failure history. Native Ollama and AWS Bedrock have simulated protocol coverage only. No AWS inference was purchased or called.

October 17 recovery: the refreshed production build passed, but the browser model request and a subsequent real HTTP evaluation both hit the model timeout. The browser correctly showed the labelled app-guide fallback. A separate premature health-check run also failed and is retained. The final real-inference failure (`evaluations/2026-10-17T00-42-14-244Z.json`) followed a successful health check, so startup timing does not explain that timeout. The cause remains unconfirmed. The private preview was stopped after verification. Do not advertise this local runtime as an available or reliable public AI service.

## AWS option — proposed, not activated

**October 19 status:** the user approved up to ten private Bedrock tests with a US$1 total ceiling. No paid calls have been made. Browser authorization for `ecovibes-chale-test` expired; no CLI profile was established. Wait for the user to be present to restart login. Do not ask for duplicate spending approval. Public deployment and server rental are outside this approval. See `../CONTINUATION.md` for the handoff and spending-accounting requirements.

The user has an AWS account. `aws configure list-profiles` returned no configured profile on this machine; no AWS resources or account billing state were accessed. No credentials were requested in chat.

For low initial traffic, evaluate Bedrock's managed Qwen before renting an always-on model server. This preserves the local open-weight route while avoiding a fixed inference-server bill. The [AWS Qwen3 Next model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-qwen-qwen3-next-80b-a3b.html) documents Converse support and the runtime model ID `qwen.qwen3-next-80b-a3b`. Account availability and selected region must still be confirmed.

[AWS pricing](https://aws.amazon.com/bedrock/pricing/) checked October 16 lists Qwen3 Next 80B A3B in Ireland at $0.18 per million input tokens and $1.41 per million output tokens. **Illustration:** 1,000 replies × (1,000 input + 200 output tokens) costs about **US$0.46 for inference**. This is an estimate, not a cap; longer inputs, other models, traffic, taxes and app hosting change it. The current request quotas are not a dollar-based spending limit. Budget alerts are not a guaranteed shutoff. By comparison [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/) lists Linux/IPv4 4 GiB at $24/month and 8 GiB at $44/month before extras; no throughput claim is made for those CPU instances.

Before any paid test or public deployment:

1. User approves a specific small paid test and spending policy, as required by the supplied directive.
2. Sign in to AWS privately; confirm region, model access and billing controls. Create least-privilege model-invoke access; use short-lived credentials where possible. Never use a root access key.
3. Put `AWS_BEARER_TOKEN_BEDROCK` only in the API host's secret settings. The [AWS bearer-key documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html) supports direct authenticated Converse requests. Current adapter uses that method, not general AWS access keys.
4. Set non-secret values `CHALE_PROVIDER=bedrock`, `AWS_REGION=eu-west-1`, `AI_MODEL=qwen.qwen3-next-80b-a3b`. Only after approval enable `CHALE_ALLOW_PAID=true` and `CHALE_REMOTE_APPROVED=true`. Begin with global allowance 10 and output limit 256 for evaluation. An already approved deployment URL and hosted app security checks are still required.
5. Run a real bounded inference and adversarial/quality evaluation; verify no private record access or financial actions. Confirm real usage in AWS. Keep rollout private until approved.

## Remaining work and rollback

Not implemented: streaming, persistent opt-in chat memory/deletion, document embedding/vector RAG, private account/order tools, live facility/opportunity search, language benchmarks, training pipeline, AI cloud customer keys/billing, monthly dollar reservations, durable token ledger and cross-instance concurrency leases. Low-bandwidth plain-text responses and local guide fallback work; advanced voice is not claimed.

Guest users behind a reverse proxy currently share its socket quota; forwarded headers are deliberately not trusted. Define a trusted proxy policy or require verified sign-in for hosted model access. Daily caps are database-wide, concurrency is process-local; use one API replica for the initial private model trial or implement a shared lease before scaling. Confirm hosted Postgres behavior, TLS/secrets, retention, model runtime patching and quality gates before public use.

To disable inference, set `CHALE_PROVIDER=disabled` and restart the API. Guide/search fallback remains. No schema rollback is required. Existing OpenAI keys alone no longer activate inference: operators must explicitly select a paid provider and model. Do not push local main wholesale; it still contains unpublished Games work behind approval gates.
