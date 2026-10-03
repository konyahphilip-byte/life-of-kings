# Chale AI

Chale AI is a model-backed assistant served by the EcoVibes API. It uses OpenAI's Responses API and can search active public Marketplace products and open Quick&Handi jobs when a request depends on current EcoVibes listings. It can also answer general questions. It cannot post, buy, message, apply, book, or change account settings.

## Configure the model

Set these variables in the API process environment:

```dotenv
AI_PROVIDER_KEY=your_openai_api_key
AI_MODEL=gpt-6-astra
```

For local development, put them in the ignored project `.env` file and restart the API with `npm run dev:api`. Do not prefix the key with `VITE_`, commit it, or paste it into chat. On Render, set `AI_PROVIDER_KEY` as a secret environment variable for `ecovibes-api`; the model name is already declared in `render.yaml` and can be overridden there.

The API key needs access to the OpenAI API and available API billing. The web app never receives the key. `GET /api/v1/ai/status` reports whether a key is configured. Without a key, Chale AI reports that it cannot generate an intelligent answer and can still show matches from the EcoVibes live catalogue.

The default `gpt-6-astra` is OpenAI's most capable model and its premium-priced option. Change `AI_MODEL` to `gpt-5.6-terra` or `gpt-5.6-luna` if a lower-cost model is preferred; see the [current model catalog and pricing](https://developers.openai.com/api/docs/models/gpt-6-astra).

## Search and privacy

The model can call one server-side catalog search. The server limits that tool to active public products and open jobs, strips control characters, limits the result set, and does not include private account or payment data. For signed-in users with personalization enabled, chosen interests and learned listing signals can reorder the public matches; pausing personalization removes that influence. The signal profile itself is not sent to the model. Catalogue text is treated as untrusted context.

When the model is configured, each request sends recent chat messages and, when a search is used, matching public listing details to OpenAI so it can generate a reply. The assistant UI discloses that EcoVibes interests can influence listing matches when personalization is enabled. The API sets `store: false` on Responses requests. This is not a promise that provider abuse-monitoring or other account-level data controls are disabled; review the OpenAI data controls that apply to the API account. Users are told in the assistant UI not to enter passwords or payment codes.

Requests are limited to 10 per minute per API client address. The model can be changed with `AI_MODEL`; the default is `gpt-6-astra`.
