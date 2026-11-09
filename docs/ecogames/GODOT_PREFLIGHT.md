# Godot-aware source inspection in EcoGames

Status: LOCALLY BUILT on the PR55 stack. No new migration, engine runner, AI execution, hosted activation or deployment. This document describes the supported inspector, not a Godot compiler or a security certification.

## Reconciled dependencies (9 November 2026)

The existing draft order remains PR51 → PR52 → PR53 → PR54 → PR55. Fresh GitHub metadata confirms that all five are open drafts, unmerged, with both current workflows passing. Full changed-file lists and workflow metadata are retained in work/ecogames-godot-preflight-20261109/pr-reconciliation.json.

| Draft | Scope | Exact current head | Release / browser workflow |
| --- | --- | --- | --- |
| [51](https://github.com/konyahphilip-byte/life-of-kings/pull/51) | Games hub | 34b12ce3d3d414a32cdff1d8687759c248c67c1e | 42463250388 / 42463250498 |
| [52](https://github.com/konyahphilip-byte/life-of-kings/pull/52) | Control Hub, additive workboard schema | 323f337c77f9713b4186a3124340e32206cdd5e3 | 42518745158 / 42518745165 |
| [53](https://github.com/konyahphilip-byte/life-of-kings/pull/53) | Private Vault and text Studio, additive schema | edd5b8f1cba7de6ae63d94b342b59ab23441209b | 42534706524 / 42534706530 |
| [54](https://github.com/konyahphilip-byte/life-of-kings/pull/54) | Folder-preserving source ZIP | 9f81144f8cdef52902e28559b8328dba7b9f0ca5 | 42540711148 / 42540711182 |
| [55](https://github.com/konyahphilip-byte/life-of-kings/pull/55) | Selected-folder text import | dd07c2ba5974c5a63015cc92b27d6cb3c9e82e9a | 42585263187 / 42585263372 |

PR55's public head and CI checkout 856fe5d9b4d99cbcfb4344c70b532577ccfe7065 share tree 8586533315bdae3d68122b4555e6b4b17a7c86c4. Its 14 approved blobs match local 5411bcf2f8a6458f04cc72b62c513a6c29e9e123. Actual retained CI logs show 748 tests/53 files, build1700, audit0/security8 and 34 folder browser checks. Those logs do not prove native engine import. The prior local-only folder-publication wording was stale and is corrected in VAULT_STUDIO.md. Historical dated receipts remain intact.

Parent migrations 20261108150000 and 20261108210000 remain UNAPPLIED. Current-main/dependency compatibility, review, explicit migration/merge/activation/deploy approval, guarded rollback and hosted real-account/device acceptance remain release gates. This new inspector has local evidence only until separately approved public publication and exact remote CI.

## Functional boundary

Inside an existing selected project, Inspect Godot source reads only the current in-memory text draft. It runs only after an explicit click, works offline and does not save, fetch assets, execute source, install plugins, render imported markup or contact Chale. Selecting a folder still uses the existing metadata preview, selected-file read and separate save consent.

The shared parser recognizes an exact root project.godot, Godot4 config_version=5 and text scene/resource format=3. It tokenizes comments, strings, balanced delimiters and the supported declarative property subset. It reports malformed or unsupported structures conservatively. It is not a GDScript compiler: successful reference inspection does not establish script syntax, types, engine compatibility, safety or playability.

Supported references include project startup/autoload/settings paths; scene/resource external and subresource IDs; literal GDScript extends, preload, load, @icon and ResourceLoader threaded paths. Nested scene-relative paths can resolve within the project root. Relative script-loader paths are reported for manual review rather than guessing their semantics. UID-only references require original metadata/manual repair; conflicting UID/path declarations are errors. Dynamic paths, unknown loader calls, custom bases and unsupported variants remain explicit limitations.

The graph uses file nodes and source-reference edges. Missing source, wrong capitalization, unsafe paths, incompatible Script/PackedScene types, duplicate IDs, undefined local resource IDs and cycles produce friendly explanations and manual repair suggestions. Reports distinguish absent binary assets from missing text source. Present asset text is not proof that a native importer accepted it. C# projects, native extensions, enabled plugins and @tool scripts are flagged for separate runtime/editor review, never installed or executed.

Existing source content is never rewritten, reformatted or normalized in place. BOM, CRLF and empty content remain exact. Reports bind to the active owner and exact draft object; account changes, edits, cancellation and disabled state invalidate old results immediately. Late work cannot display another account's report. Errors and filenames render as plain text. Source/report data remains in memory, outside analytics, browser persistence and shared AI indexes.

### Bounds and results

Existing Vault caps remain five projects, 20 files/project, 32,768 UTF-8 bytes/file and 128,000 combined canonical Vault bytes. Inspection adds 20,000 tokens/file, 200 graph references, 200 ordinary issues plus one limit marker, 64 nested variant levels and a 10-second UI deadline. It yields between files for cancellation. Limit exhaustion is visible, not an all-clear.

The ecogames-godot-preflight-v1 report returns root, nodes, edges, issues, coverage, engineExecuted=false and one of:

- static-checked: no issues in the supported reference subset.
- limited: manual checks/unsupported dependencies remain.
- needs-repair: at least one supported check found an error.

The UI spells out “not Godot execution.” No static state means that an imported project has run.

## Verification and native separation

Regression tests cover real nested fixture references, malformed files, strict resource metadata, missing source/assets, conflicts, plugins, cancellation, stale results and account isolation. A local Chrome/API journey uses synthetic accounts and trusted text at narrow/wide widths; it also verifies no inspector writes or AI requests. Existing empty presence heartbeats remain separate and may contain only {}.

The optional native test accepts no creator project/path input. It extracts only hard-coded, script-owned fixtures to temporary folders, verifies exact source ZIP bytes, and uses the previously downloaded official Godot4.7.2 macOS archive after SHA256, binary-to-archive and Apple-signature checks. Portable editor data stays task-local; HOME is unchanged. The positive fixture must import without errors. The negative fixture must emit the expected resource error, even if the engine exits0. Neither check proves a creator project or playable game.

CI runs static/ZIP checks and explicitly reports native import UNVERIFIED when no verified GODOT_BIN is selected. It never installs an editor or runs uploaded code implicitly. Native creator imports, GUI usability, physical phones, gameplay, packaged builds and AAA rendering remain unverified or unimplemented.

See the [local release receipt](../releases/2026-11-09-ecogames-godot-preflight-local.md) for exact commands, passes, failures and limits.

## Future Chale action contract — design only

shared/game-project-tools.d.mts defines future explain, prepare and apply interfaces. No endpoint, agent, AI request or edit executor is enabled.

The server must derive the actor/account/project permission and independently validate every input. A tool may not accept a claimed owner as authority. Explanations require a separate explicit sanitized-summary consent and receive only bounded counts and known issue codes from summarizeGodotPreflight: no paths, source, title or account IDs. The summary is a minimization helper, not authorization.

A proposed source edit would require separately selected paths and AI-processing consent, exact expected project revision and source SHA256, a stable operation ID, and a proposal containing a bounded diff with expected original-file hashes. Application would require a human-reviewed proposal digest and confirmation, another server permission/revision/hash check and duplicate-safe save. Stale proposals must conflict. Audit records must omit raw source and sensitive prompt content. Runtime validation, authentication, consent expiry, isolation, negative tests and provider-cost approval remain prerequisites; TypeScript declarations enforce none of them at runtime.

Turning off the optional Chale character must remain independent of chat/tools. This increment neither trains on conversations nor sends project source to a model.

## Next dependency-ready stages

1. Binary asset handling: inspect the existing authorized media/storage service before adding another store. Introduce a private owner/project-bound asset manifest with actual byte hashes, verified MIME/type, selected-file upload consent, strict byte/count quotas and duplicate-safe saves. Test cross-account denial, interrupted transfer, deletion/retention, private URL expiry and backup/restore. Rebuild missing references only after actual assets exist. Native importer and malicious-asset risks require their own isolated validation.
2. Playable previews: establish a separately reviewed isolated build/runner boundary, trusted pinned engines, CPU/memory/time/output limits, no host credentials, restricted network/filesystem and explicit untrusted-execution policy. A source ZIP or static report is not a preview. Do not run creator @tool/plugins in the app or the current trusted-fixture test.
3. Chale visual editing: connect the typed proposal contract only after runtime authorization, selected-source processing consent, preview/confirmation, base-hash/revision checks, duplicate protection and recovery tests work. Keep private source out of public retrieval indexes. No automatic rewrite.
4. Publishing/generation/AAA: require separate functioning build, moderation, distribution, device/performance and real-game evidence before enabling or claiming them.

No dependency, service, paid API, inference call, purchase or fee is added. GH₵0 core access remains. Local CPU/memory use is bounded by the existing text-project limits; this does not promise unlimited free hosting capacity.

## Official format references

- [Godot text scene format](https://docs.godotengine.org/en/4.5/engine_details/file_formats/tscn.html) documents text headers, IDs and resource paths.
- [Godot4.7.2 text loader source](https://raw.githubusercontent.com/godotengine/godot/4.7.2-stable/scene/resources/resource_format_text.cpp) is the version-specific native reference.
- [ProjectSettings](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html), [GDScript](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html) and [editor plugins](https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html) guide the deliberately bounded static checks.
