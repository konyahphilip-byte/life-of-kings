# Chale AI in EcoVibes

Chale AI is part of the existing React app and Node API. Open **Ask Chale AI** from any screen to get help with the current page, find public listings, work through a problem, or draft an improvement. Live replies use OpenAI's Responses API through `POST /api/v1/ai/chat`; no separate agent service is required. Chale’s sole product scope is EcoVibes: its app workflows, public listings and community ideas. It is instructed to redirect unrelated requests to an EcoVibes task; this instruction still needs behavioral evaluation with a funded live model.

## Instructions and app knowledge

The assistant's instructions in `server/chale-ai.mjs` call for warmth, patience, practical next steps and respect for people's resources and choices. They draw on African community, resilience and a mother's care without assuming anyone's background, stereotyping Africa or pretending to be a mother. For ideas, Chale separates facts from assumptions and proposes a small affordable experiment, an observable result and a practical risk. It does not guarantee income, impact or success.

`shared/chale-app-guide.json` is the versioned authority for navigation and feature availability. The model must look up this guide before giving specific app procedures. The UI renders its own checked-in copy of a selected guide, rather than accepting model-written navigation instructions. Guide cards open the real app section and distinguish implemented features, previews and services that require a connected provider. Update this shared guide when screens or capabilities change.

The browser supplies only the current page and data mode. The API validates these values and derives sign-in, preferred language and learning flags from the authenticated session. A supplied user ID cannot select another account. The model receives these safe flags, not the user's identity, roles, private messages, balances or learning activity records. Changing accounts clears the assistant conversation and drafts and aborts pending requests so a late answer cannot appear in another account's chat.

## Tools and limits

All six tools have strict schemas. The server also validates arguments, rejects unknown tools or extra fields, strips control characters and bounds text lengths.

| Tool | Purpose | Effect |
| --- | --- | --- |
| `search_app_guide` | Find actual navigation steps and feature limitations. | Reads up to three matching guide entries. |
| `diagnose_ecovibes_issue` | Match an app symptom to verified guidance and allowlisted configuration flags. | Returns bounded checks and canonical guides; configuration is not live health or account approval. |
| `get_my_context` | Get safe current-page, data-mode, sign-in, language and learning flags. | Reads the server's allowlisted context. |
| `search_ecovibes_catalog` | Find active public products and open Quick&Handi jobs. | One catalog lookup per reply; at most eight sanitized public results. |
| `draft_support_request` | Prepare a title and useful problem details. | Creates a review draft in the reply; nothing is submitted. |
| `propose_improvement` | Describe a problem, benefit, experiment and risk. | Creates a review draft in the reply; nothing is published or implemented. |

A reply allows at most three provider requests and six tool calls. Duplicate tool calls reuse their result. Chat input allows up to eight messages, 1,200 characters per message and 6,000 characters total. Requests are limited to 10 per minute per API client address. The frontend offers **Stop answer**. Closing the active request aborts the server’s provider fetch and stops further tool calls or provider rounds. A provider may already have processed part of the request; cancellation does not guarantee a refund or remote termination.

Catalog results contain public listing fields only. Signed-in users with learning enabled may receive ranked public matches, but the underlying private interest and activity profile is not sent to the model. User messages, listing text and tool text are untrusted data. Diagnostic flags include only booleans for relevant server configuration, sign-in and learning. They never include service URLs, credentials, private records or provider approval. Diagnostics distinguish requirements met, missing configuration and unknowns; a configured key is not proof of available credits. The model cannot post, purchase, message, apply, book, alter settings or balances, approve staff actions, or run arbitrary code.

## Shared learning and consent

Chale uses EcoVibes' existing recommendation system. It does not train or fine-tune a model on conversations. Personalization starts off; signed-in users control it on **Home → Tune interests**. Selected interests and eligible activity signals can influence recommendations across the app. Activity influence decays over time, with bounded contributions and diversity in listing recommendations.

When learning is enabled, Chale's live listing cards offer **Save** and **Show less**. These explicit actions use the existing `/recommendations/signals` endpoint with the signed-in session, a CSRF token and a validated live listing ID. The Home feed refreshes after accepted feedback. If learning was paused elsewhere, the server returns a paused result without recording the signal and Chale says no feedback was saved.

Use **Pause personalization** to stop using the profile and recording learning signals. **Resume personalization** restores its use. **Reset learned activity → Confirm reset** clears learned signals while keeping explicitly chosen interests. The assistant's **Tune learning on Home** link takes users to these controls; chat cannot change consent or reset a profile.

## Offline and unavailable-model behavior

The bundled app guide remains usable when the already-loaded app is offline or the model is unavailable. Offline replies send no messages or searches. They are labeled **App guide**, use local guide matching and can offer support or idea templates containing the user's text. These templates are not generated model answers. They are review drafts with a **Copy draft** action; the user chooses whether to share them through the real support form or another destination.

When online model generation fails, the UI labels its fallback **App guide** and may separately search live public listings. Saver and extreme modes use at most one fallback search; standard mode uses at most two. Extreme mode shows fewer listings. Empty results are not replaced with invented catalog items. A working guide or search fallback does not prove that live AI generation is available.

## Server configuration and privacy

Set a server-side key and optional model in the API process environment:

```dotenv
AI_PROVIDER_KEY=your_openai_api_key
AI_MODEL=gpt-6-astra
```

`OPENAI_API_KEY` is accepted when `AI_PROVIDER_KEY` is absent. Alternatively, set `OPENAI_ENV_FILE` to an administrator-controlled environment file containing `OPENAI_API_KEY`. An absolute path is accepted; a relative path resolves from the app root. The loader reads only that key assignment and does not apply other variables from the file. An existing process key takes precedence. Keep the file outside public assets, restrict access to the API account, and keep it out of version control.

For local development, use the ignored project `.env` file and restart `npm run dev` or `npm run dev:api`. For deployment, use the host's server secret environment configuration. Do not prefix secrets or the key-file path with `VITE_`, include them in client code, commit them, or paste them into chat. The web app never receives the key. `AI_MODEL` must name a model available to the API project.

`GET /api/v1/ai/status` reports key configuration, selected model, app-guide version and capabilities. `configured: true` is a configuration check; it does not verify model access, billing or a successful generation. Complete a chat request to test those separately.

Live replies send the recent bounded conversation, safe app context, and any returned public listing details to OpenAI. Responses requests set `store: false`. This does not disable all provider abuse monitoring or account-level retention; apply the API project's data controls as appropriate. Users should keep passwords, authentication codes, payment codes and private identifiers out of chat and review drafts before sharing.

## Test the workflow

Use Node.js 22.13 or newer. From the app root, run:

```sh
npm test -- server/chale-diagnostics.test.mjs server/chale-ai.test.mjs server/openai-env.test.mjs src/modules/assistant/Sidekick.test.tsx server/recommendations.test.mjs
npm test
npm run test:chale-workflow
npm run build
npm run dev
```

The targeted suite exercises the bounded provider/tool workflow with simulated provider responses, context privacy, provider failures, key loading, verified navigation, feedback consent, account isolation, cancellation and local drafts. These tests do not call the live model or prove API billing is available. The `test:chale-workflow` command starts the actual HTTP API against a temporary database, creates two test accounts and listings, and exercises all six tools through a simulated OpenAI provider, CSRF/origin checks, consent, feedback, account isolation, pause/reset and provider error handling. It loads no app credentials and removes its database when finished. Set `CHALE_TEST_REPORT` to an output filename to save its JSON receipt. The full suite checks the surrounding app; the build checks TypeScript and production bundling.

Test the following in the running app, using a test account and test listings where needed:

1. Open Waste, launch Chale, and ask “How do I request a waste collection?” Confirm the page context and guide steps. Use **Open Waste** and confirm it opens that section.
2. Ask about Wallet or Calls & Live. Confirm that guide cards disclose preview or connected-provider requirements and do not claim a payment or call happened.
3. With a configured, funded API project, ask Chale to find a real product or job. Confirm its results against the actual listing, then use the card to open Marketplace or Quick&Handi. No matches should produce an honest empty result.
4. Sign in, use **Tune learning on Home**, enable personalization and choose an interest. Ask for listings, use **Save** or **Show less**, and confirm the Home learning feed refreshes. Pause learning and verify no feedback is recorded. Resume, reset learned activity and verify chosen interests remain.
5. Ask “Help me report a collection problem” or “Help me improve a recycling idea.” Review the draft and use **Copy draft**. Confirm no support request, post or account change is created by chat.
6. Disconnect after loading the app and repeat a guide or draft request. Confirm the **App guide** label and no new network requests. Reconnect and test a model failure; guidance should remain available.
7. Ask “My video call will not start.” Check that diagnostics distinguish configuration from live operation and show only verified app steps. Ask an unrelated question and check the funded model redirects to EcoVibes without answering the unrelated task.
8. Start a request and use **Stop answer**. Start another, then sign out or switch test accounts. Confirm pending requests are aborted and the old conversation and drafts do not appear for the new account. Press Escape to close Chale and return focus to its launcher.

If a live request returns `usage_limit_exceeded`, `insufficient_quota`, `credit_balance_exhausted` or `rate_limit_exceeded`, the API returns `ai_usage_limited` and the app uses its guide fallback. Live verification encountered exhausted API credits (`credit_balance_exhausted`), and an earlier hosted-agent check encountered an organization usage limit; that is provider access evidence, not an app-test failure or proof that every deployment is limited. Check the API organization's billing and project limits, then repeat one bounded live request. Other provider failures return `ai_unavailable`; check the server's non-secret error classification and model configuration.
