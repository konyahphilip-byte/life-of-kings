# Media closure confirmation — 21 November 2026

Status: **LOCALLY TESTED**. Branch `codex/media-close-confirmation-20261120`, based on deployed/main `56e0c2ebf83dfc2c89fccd0bc552691e4ae42b9b`. This receipt accompanies the six-file repair; the containing Git revision identifies the exact source. Publication, exact-source remote CI, integration/release review and owner approval remain open. No migration, provider change, infrastructure provisioning or deployment occurred.

## Existing behavior reused and defect reproduced

Reuse the current API identity, host-only authorization, CSRF/origin checks, media session records, LiveKit SDK, Communications view and existing error presentation. Do not substitute peer-to-peer calls, activate legacy private calls or import the wider PR31 stack.

The end-room route previously swallowed a failed provider DeleteRoom request and saved `ended` plus a success audit. The native local HTTP RED in `work/media-close-20261120/red.json` reproduced that false confirmation after five earlier checks. The repair requires provider acknowledgement before saving the ended status/audit. A rejection returns static `503 media_end_unconfirmed`, preserves the active record and allows a later retry. It does not claim that an ambiguous request definitely failed remotely. Generic error normalization and sensitive-data rules are unchanged.

The active room view now displays an accessible error alert explaining that remote closure is unconfirmed, retains Leave, disables duplicate pending End actions and permits a later acknowledged retry. No new styling or broad redesign. The message does not expose provider response content.

## Exact changed files

- `server/index.mjs`: acknowledged provider deletion before ended state/audit.
- `src/modules/Communications.tsx`: visible unconfirmed-closure feedback and pending-action control.
- `src/modules/Communications.test.tsx`: provider and transport failure followed by acknowledged retry.
- `scripts/test-media-close.mjs`: actual API and SDK HTTP transport against a synthetic local provider/accounts; temporary SQLite only; owned-child IPC and ephemeral ports before any account writes.
- `.github/workflows/release-checks.yml`: include the new HTTP regression in existing release CI.
- `scripts/test-public-trends-http.mjs`: reuse the already established `fileURLToPath` correction for working-directory paths containing spaces.
- This receipt. No schema, dependency, private-call admission or financial authority change.

## Retained failing and passing evidence

All commands use task-local Node26.12.1; system Node is unchanged. Installed Vite8.3.5 and Undici versions remain unchanged. No assertions, deadlines, worker settings or isolation were relaxed.

| Check | Actual result and scope |
| --- | --- |
| Provider acknowledgement RED / GREEN | Original RED retained; final `owned-api-green.json`: **15/15**, real local API/SDK transport, synthetic provider. Anonymous/outsider/CSRF denials reach no provider; refusal saves no success; acknowledged retry saves one audit; ended app joins/stale end refused. |
| Active-view UI RED / GREEN | `ui-red.json`: **2 passed / 2 failed** missing visible alert. `ui-green.json`: **4/4**, including provider and transport errors. LiveKit presentation mocked; no device media. |
| Final full regression | `final/full.json`: **567/567, 43 files**, 136.498 seconds command duration. |
| Final production checks | TypeScript, production build, dependency-security checks passed. Existing Communications large-chunk warning remains. |
| Final local HTTP suites | Provider, payment, identity, job, support, Chale, work-status, direct-message and public-trends suites passed. Synthetic accounts/providers; no payment or AI service activation. |
| Disposable PostgreSQL | Final PostgreSQL17.10 **84 checks** passed. This retained compatibility suite does not establish hosted media or private calling security. |
| Dependency audit | Final npm audit: **zero vulnerabilities reported**. |
| Complete final gate sequence | `final/checks.json`: **15/15 exit0**, all six code/test/workflow hashes unchanged before/after. New media HTTP15 and UI4 evidence are separately retained and hash-bound to the same source. |

The earlier fifteen-gate attempt stopped at public-trends startup after twelve successful gates. `path-probe.json` shows encoded URL pathname as cwd produced ENOENT; decoded cwd starts the API. `trends-corrected.json` and the final suite pass all six trends checks. This was a harness path defect, not evidence that public news sourcing is operational. Preserve that failure and the prior 565-test pre-UI run as historical results, not final qualification. Historical QA001 timing remains undiagnosed.

Independent source review found two bounded issues: invisible active-view feedback and a fixed-port test listener. Both were corrected; follow-up review reported no remaining bounded findings. The implementation agent subsequently verified the completed final gate record and matching hashes. No independent production release approval or hosted acceptance is implied.

## Separate actual LiveKit finding — unresolved

Existing PR31 source `4fa3da537d98b5f02f97d6db37d10f57aa2a97cc` was tested by existing Linux CI run40951751722 attempt2, checkout merge06069a134ba05004afe5abd1bf8b076fab729432. Its tree matches that PR source. Twelve actual pinned LiveKit1.13.11/Caddy/Redis diagnostic checks passed; **cachedTokenRejoinDenied=false**. A removed participant can reuse a still-valid token while the room exists. Deleting the room with room auto-creation disabled blocks that replay. Successful diagnostic CI is not a strict revocation security pass.

That result is in the workspace `Evidence/limited-release-20261120/media-evidence.json` and actual job log. This repair does not fix cached/in-flight rejoin, private lifecycle, per-call/video consent, relationship revocation or incoming call delivery. Private calls remain disabled, including when media keys are present. No physical phones, hardware capture, public trusted TLS/TURN or approved owned-media server was accepted.

## Research rationale

The official [LiveKit RoomService contract](https://docs.livekit.io/reference/other/roomservice-api/) defines DeleteRoom as a provider operation; a failed/unknown request cannot justify a confirmed application success. Existing actual pinned-server tests take precedence over assuming Cloud revocation behavior applies to self-hosted server1.13.11. [Node URL conversion](https://nodejs.org/api/url.html#urlfileurltopathurl-options) supports decoding filesystem URLs; [child-process IPC](https://nodejs.org/api/child_process.html#subprocesssendmessage-sendhandle-options-callback) supports ownership-bound test readiness. These APIs were verified with the installed pinned runtime; no runtime upgrade was introduced.

## Cost, integration and safe recovery

No paid dependency, service, real money transfer or EcoVibes platform fee introduced. Existing infrastructure and reusable local harnesses only. Source is based on main56, separate from old-base PR31 and GPS PR32. A future integration must reconcile routes/tests rather than overwrite independent authorization work.

Do not rollback this repair to the swallowed-error handler. Use a reviewed forward fix, preserve unconfirmed records for controlled recovery, or keep media admission disabled through an approved change. Any provider settings or deployed disable action requires owner authorization. This local commit neither changes the public service nor enables calls.

Next smallest calling task: implement and test terminal room generations and durable cleanup so no cached/in-flight token can reopen a revoked/ended private call, using the retained actual pinned-server reproduction. Keep private admission disabled until server, device-consent, incoming delivery, owned TLS/TURN and two-phone/slow-network acceptance pass.

## Environment limit

Final tests completed successfully before this receipt. At the historical 21 November inspection the Mac reported about20MiB free. On 24 November the volume reports 4,000,372KiB available (about3.81GiB), so that capacity blocker has cleared. Recheck capacity before further large tests/builds. No personal files, retained failures or unrelated worktrees were deleted to create capacity.
