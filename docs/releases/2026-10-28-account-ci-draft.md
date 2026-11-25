# Phase 0 recovery draft and database CI - 28 October 2026

Status: **LOCALLY BUILT**. Candidate branch codex/account-recovery-ci-20261028, based on reviewed c69cce9. This is a dated evidence snapshot supporting the single readiness dashboard. Draft publication and CI results are recorded separately in the draft PR and primary work/account-ci-20261028; merge, deployment and complete recovery remain blocked.

| Capability | Previous problem | Changes made | Test evidence | Current status | Remaining blocker |
| --- | --- | --- | --- | --- | --- |
| Database CI coverage | Release workflow did not run the actual PostgreSQL revocation fixture | Require private-socket fixture, executable preflight and fixed Ubuntu24.04 / installed PG16 path | Workflow independently reviewed; fresh local PG17.10 67/67; actual GitHub result pending at candidate construction | LOCALLY BUILT | Exact candidate/merge CI must run and logs be read |
| Recovery local package | Five reviewed local checkpoints lacked exact aggregate CI | Prepare one scoped draft with existing email/revocation/callback/browser/outcome repairs | Existing final 483/483, 46 focused, TypeScript/build1672; product hashes unchanged in this CI increment | LOCALLY BUILT | Real provider/Auth/browser/inbox acceptance; guard-first rollout/rollback |
| Browser removal | Mutable local SDK sign-out can erase B or a newer A while delayed | Reproduced with actual installed SDK, synthetic storage/network; rejected unsafe addition | Two delayed-ACK cases both erased replacement; current helper preserved B with no removal | UNVERIFIED | Supported ownership/session-aware design and two-client tests |
| Real email delivery | SMTP absent and default templates locked | Existing branded HTML/text and approved recovery redirect retained; no setting change | Earlier read-only provider audit, no real email or inbox test here | BLOCKED | Verified owned sender/domain/SMTP/DNS and private credential workflow |

## Exact increment scope

Only .github/workflows/release-checks.yml changes runtime verification: pin the documented Ubuntu24.04 runner, explicitly require /usr/lib/postgresql/16/bin executables, then run existing test:auth-revocation-postgres. No system PostgreSQL service, live database, credentials, deployment or hosted migration step is introduced. No product, server, dependency, lockfile or migration content changes in this increment.

Documentation: this receipt, current continuation/dashboard, and existing primary sprint tracker. No new database migration. Parent20261027121500_identity_auth_revocations.sql remains UNAPPLIED to Supabase, SHA25649f1f61cd4a145dc365095d790fb0f6c8664bb41142c3535a17944c1767ccc42.

The aggregate draft contains only scoped reviewed Phase0 work; the dirty primary workspace and old job-call/message WIP are excluded. Independent aggregate review found no detected literal credentials or unrelated implementation source. Draft publication is not approval to merge or deploy.

## Checks and failure history

- Fresh disposable PostgreSQL17.10: all67 privilege/RLS/lock/retry/rollback checks pass; private Unix socket, TCP disabled, synthetic rows only, cluster stopped and removed.
- CI runs its own installed PG16 fixture. Local PG17 and GitHub PG16 evidence must be distinguished; no unsupported version-parity or hosted acceptance claim.
- Final recovery product source is unchanged from c69cce9: historical483/483/36files,46focused/4files, TypeScript/build1672 and bounded source review pass. They are not repeated local runs in this workflow-only increment. Exact CI must verify the aggregate.
- The initial local PG attempt stopped before startup because PG_BINDIR was missing, then passed with the verified path. The CLI GitHub read returned401; the existing connected app reports publication permission. No login/password/token handoff or credential inspection.
- Retain all earlier REDs, stopped/superseded runs and QA-001 timing failures; a later green run does not diagnose their cause.
-145 protected primary source/assets and six final recovery source hashes remain unchanged.

GitHub's official [Ubuntu24.04 runner image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) documents installed PostgreSQL16 and the upcoming ubuntu-latest OS transition. The workflow uses the existing installation and fails if required binaries are missing; it does not silently skip database checks.

## Remaining release gates

Actual browser cleanup, provider logout/late-processing outcomes, genuine signed Auth AMR/session/clock behavior, in-flight sensitive domain authorization, two real accounts/inboxes and mobile/low-end journeys remain UNVERIFIED. SMTP/sending domain/SPF/DKIM/DMARC and supported private credential handling remain BLOCKED. No actual email was sent.

Before any hosted rollout, require exact-source CI, compatible reviewed production schema and marker, actual Auth acceptance, guard-first release and guard-preserving rollback. Retain revocation history. Old26c1b555/cf9 is not a safe rollback after barriers exist. The safe unknown-outcome no-redispatch behavior must also be retained. No restore drill is implied.

No source is merged or deployed by this increment. Existing PR23/main26c1b555 remains the last verified hosted source; no new provider audit or real hosted-account test was performed here. No DNS, domain purchase, SMTP installation, paid service, real money, public launch or unrelated feature expansion.
