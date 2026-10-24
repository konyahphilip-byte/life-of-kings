# October 24: account email delivery blocker and local guidance fix

## October 24 clean release candidate (supersedes earlier local-only status below)

Pre-code plan: work/auth-email-20261024/PLAN.md. Reused the clean attached worktree on published42405dfde4f4cf6a52d35e075904c019a10d4ade, branch codex/auth-email-guidance-20261024. Exactly five intended release files: BackendWorkspace.tsx, auth-errors.ts, auth-errors.test.ts, BackendWorkspace.auth.test.tsx and this receipt. The backend reconstructs published base by reversing one import and two throw substitutions. The helper/tests match the earlier reviewed local source byte for byte. Dirty development source was preserved; nine runtime/package/CI/provider/identity hashes remain unchanged.

Clean candidate verification: **240 tests in22 files passed**, test-file interval59.596seconds; build **1,654 modules** passed with the existing Communications chunk warning. Seven existing local HTTP fixtures passed **363 checks** (52 provider,27 payment,39 identity,134 jobs,58 support,19 Chale workflow,34 owned-work). All accounts/provider replies are synthetic, payments mocked, inference disabled. Existing deadlines/assertions/worker setting/isolation/retries unchanged. Historical intermittent timeouts remain unexplained; this pass does not close QA-001. Initial port attempt was blocked before mutation by the sandbox temporary-file restriction; approved exact rerun completed. Markdown Render documentation retrieval failed on content type; current HTML lifecycle/health/rollback references were read.

Independent read-only exact-candidate review found no Critical/Important code or publication issue. No auth request/verification/session/MFA/role/recovery semantics, database migration, dependencies, provider/credential/environment or paid setting changed. Current published42405dfd/dep-dbe8eudg1s2s73eoivmg is the schema-compatible rollback target; no rollback drill performed. Publication and exact candidate/main CI are still pending at this snapshot; no hosted behavior is claimed by these local tests.

**Domain purchase remains on hold:** founder asked about free alternatives instead of approving checkout. The review cart does not reserve ecovibes.africa. Cost/revenue discussions are planning only, not spending, commercial pricing or billing activation. SMTP remains unconfigured; clearer errors do not fix confirmation/recovery delivery. Do not repeat the private second-account sign-in request while email delivery blocks signup. No email was sent, account auto-confirmed, verification weakened, private media/GPS started or financial record seeded. Actual confirmation/recovery, nonempty separate-account Chale isolation, broader AI quality/failure and all physical Connect/GPS/launch gates remain open.


## Actual hosted observation

Founder supplied a mobile signup screenshot showing email rate limit exceeded. No password, email address or contact information from that screenshot was copied into fixtures, logs or this receipt. No repeated signup, recovery, invitation or other email request was sent by the agent.

Read-only inspection of the approved Supabase project poscxeapsaxuahausmoc found the Rate Limits email control disabled and the Emails page saying custom SMTP is required. Its default-template notice confirms custom SMTP is not configured. Site URL and the one allowed redirect remain https://ecovibes-api.onrender.com. No auth setting, user, permission, email template, provider or secret was changed or read.

Current official [rate-limit documentation](https://supabase.com/docs/guides/auth/rate-limits) documents two emails/hour for the built-in project sender. The [SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp) also limits that sender to project-team recipients and requires custom sending for public use. The actual remaining quota/reset instant and status of this attempted account were not read, and are not inferred. Waiting alone may not resolve the recipient restriction. Do not disable email confirmation, auto-confirm users or add testers to the Supabase project team as a workaround.

The Markdown changelog fetch failed because of its content type; the HTML changelog and current Auth docs were read instead. The visible Supabase technical-issue banner was not established as the cause of this specific quota error.

## Local code change and scope

Pre-code plan and exact saved baseline: work/auth-email-20261024. Inspected workers; no other active editor. Added only src/modules/backend/auth-errors.ts, auth-errors.test.ts and BackendWorkspace.auth.test.tsx. BackendWorkspace.tsx adds one import and substitutes exactly two error throws, in authWithSupabase and sendRecovery. Reversing those three edits reconstructs the entire saved dirty baseline byte for byte.

Only over_email_send_rate_limit and email_address_not_authorized receive safe, actionable guidance. Unknown errors, malformed codes and general request/credential limits preserve the original error object. Quota guidance does not claim delivery, account existence or a precise reset time. Failed signup/recovery never proceeds to a success notice or creates a session. Existing confirmed password sign-in, verification, MFA, recovery completion, roles and every unrelated source path remain unchanged. No new retry mechanism or promise to lift the provider limit is introduced.

## Actual checks

- Initial test command was blocked by sandbox access to Vitest's temporary cache before tests began. Approved rerun produced the intended RED: **two failures/one pass**. Signup/recovery rendered the raw provider message, while existing-account password sign-in passed.
- Implemented the exact-code helper and two substitutions. Focused helper/component execution: **13 passed** across two files. Synthetic mocked Auth replies only; no hosted requests or real credentials.
- Related account/Chale regression execution: **55 passed** across four files (9 existing app-identity,33 existing Sidekick,3 new account-email and10 new helper cases). These include the same13 tests, so do not add the totals. Existing deadlines, assertions, worker setting, isolation and retries preserved. Reported test-file interval30.08s.
- Production build passed, **1,657 modules**, with the existing Communications bundle-size warning. This is the dirty development source, not the published release candidate.
- Exact baseline-reconstruction and scoped whitespace checks passed. Independent read-only reviewer found no Critical, Important or Minor issue in the slice; reviewer did not run tests or inspect providers. Original failures remain in red.json; no retroactive pass.

This patch is **local and unreleased**. No clean-candidate publication, PR, fresh CI, merge or deployment is claimed for the guidance fix. Published Chale42405dfd/dep-dbe8eudg1s2s73eoivmg remains unchanged.

## Domain and provider handoff

Founder has no domain and requested ecovibes.africa, then asked about a budget for one million visits/year. Recommended US$20/year for the domain; domain registration fees are separate from hosting/media/AI/email usage. A live Hover search showed ecovibes.africa available at US$14.99 for one year with US$14.99 annual renewal. A single domain was added to the cart for review, not purchased. The cart confirms one year, US$14.99 plus US$0.20 ICANN fee, total **US$15.19 before any applicable tax**, free WHOIS privacy and no selected paid email add-on. Requested founder approval for a maximum US$20 including tax, with private contact/payment/terms handoff. Approval, final taxes and account setup remain pending. No account was created, contract accepted, payment submitted, paid plan activated or external person contacted. Availability is time-sensitive and the cart does not reserve the domain.

Cloudflare's public TLD price list did not list .africa; the existing Cloudflare account is not proof that this extension can be registered there. Official [Hover .africa pricing](https://www.hover.com/tld/buy-africa-domain) independently lists US$14.99 registration/renewal; exact selected-name price came from the live search. No million-visit capacity or US$0 infrastructure guarantee is inferred.

After an approved domain is actually registered: verify sender DNS and configure a bounded email service privately in Supabase, keeping confirmation enabled. Then perform one real signup/confirmation and recovery journey with the founder; exact redirect/session/revocation and two-account Chale privacy checks remain gates. Resend Free is one researched possibility, not configured, selected as final or verified for this project. No AWS resource or secret operation occurred.
