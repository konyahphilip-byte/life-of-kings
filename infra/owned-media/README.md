# EcoVibes-operated media server

This package runs open-source LiveKit, Caddy and Redis on a **dedicated Linux host**. It does not require LiveKit Cloud. It does not purchase a VM, change DNS, retrieve secrets, enable client calling or deploy the app. Infrastructure remains BLOCKED until a host, DNS and protected credential workflow are approved and verified.

## Generate the configuration

Use the repository's pinned Node runtime. Supply public settings only, never API keys. The output directory must be new:

```sh
node infra/owned-media/config.mjs media.example.org turn.example.org 203.0.113.10 198.51.100.7/32 2026-11-01T12:00:00Z /path/to/new-output
```

The example addresses and domains are documentation values. Replace them with **approved, owned** DNS names and the host's actual public IPv4; renew the UTC deadline before generation. Plans expire within 31 days. Generated JSON is valid YAML for LiveKit and Compose. No credentials are generated or embedded by this command. No installation script is downloaded or executed.

Outputs: pinned Compose stack, LiveKit configuration, Caddy TLS/SNI routing, loopback Redis configuration, reviewed host-firewall input policy, systemd start/preflight and stop timer, public plan. LiveKit/Caddy/Redis images are pinned by manifest digest; updates require review and another Linux smoke check. These pins are supply-chain identity, **not proof of a vulnerability-free image**.

The initial 2-vCPU/8-GB host proposal is a small-pilot starting point requiring benchmarks. Track/byte/room limits reduce exposure but do not prove capacity or cap provider billing. No egress/ingress/recording, agents, SIP, cloud fallback, public Redis, metrics or debugging listener is configured. Opus/VP8/H264 are supported; existing app data modes still control capture/encoding. Measure actual audio/video/TURN traffic before promising data usage.

## Network and trust boundary

Both DNS names must point directly to the approved public IPv4. Use DNS-only records, without a generic HTTP-only proxy in front of TURN. Public TCP80 supports certificate issuance; TCP443 carries trusted HTTPS/WSS and TURN/TLS via distinct SNI names. TCP7881, UDP3478 and UDP50000–60000 support ICE/TURN media. SSH is restricted to one approved IPv4 /32. IPv6 SSH and other application/control listeners are not opened.

Caddy terminates TLS and forwards signalling to loopback7880, TURN to5349. TURN uses PROXY v2 from loopback to preserve the actual remote address. `external_tls` advertises TURN/TLS443; `tls_port:5349` is the private listener. Never expose cleartext7880/5349 or Redis6379. The nftables file is **not automatically applied**: review existing host rules, provider firewall, administrator address and console recovery first. A firewall table's existence alone does not prove effective policy; verify denied ports externally. No commands flush the host ruleset.

Production certificates require a trusted public CA. The isolated smoke uses a throwaway internal CA with explicit validation; it cannot prove public certificate issuance/renewal or mobile network reachability. Caddy stores certificates in a protected volume. Apply operational access, retention and backup controls; never publish its private keys.

## Activation gate and operator sequence

Before activation record the approved provider/region/VM, total cost cap/renewal policy, usable credits/expiry, owned DNS, administrative access, pilot deadline and credential delivery method. Existing AWS credits are finite and must be freshly verified; a budget alarm is not a hard spending cap. The current Render HTTP service cannot substitute for this host's required UDP listeners.

1. Review this exact source, image provenance/security findings, generated public plan and Linux smoke evidence. Provision only the specifically approved host. Keep the existing Render/Supabase app unchanged.
2. Install reviewed Docker Engine/Compose and nftables packages using the OS's authenticated package mechanism. Copy the generated files to root-owned `/opt/ecovibes-media`; executable mode700 for `preflight.sh`. Preserve mode644 for the nonsecret `redis.conf` so the Redis container's nonroot process can read it; other generated configurations stay600. Restrict directory/config write access to the operator.
3. Configure approved DNS and provider/host firewall with console recovery available. Check both names resolve to the exact public IP and scan allowed/denied ports. Do not run another service on80/443.
4. A supported private operator workflow must place a unique API key map at root-owned, nonsymlink `/etc/ecovibes-media/livekit-keys.yaml`, mode600. The generator/preflight never reads or prints it. Do not paste credentials into chat, Git, cloud-init/user-data, command arguments or logs. Do not proceed while the required credential workflow is unavailable. The existing backend later receives matching values through its provider settings, after the admission gate is reviewed.
5. After host approval create the root-owned `/etc/ecovibes-media/host-approved` marker. This marker is only an operational interlock; it is not founder authorization or a security proof. Pull the exact pinned images. Install the three systemd units and enable the expiry timer **before** starting `ecovibes-media.service`. Inspect the timer deadline and synchronized clock.
6. Verify trusted certificates and renewal, authenticated joins, denied third-user/control access, real TURN-only allocation/media, limits, reconnect and two-phone audio/video. Record measured bandwidth/quality in each data mode and mobile/Wi-Fi transitions. Never test with private conversations or production transactions.
7. Keep private app calls disabled until accepted relationship, per-call/video consent, transaction-time admission and strict cached/in-flight token revocation are verified. An operating SFU does not supply application consent. **Adding credentials alone must not enable legacy private calling.** Chale stays independent.

## Stop, rollback and monitoring

The timer stops the stack at the UTC pilot deadline. Start preflight refuses expired plans. Docker automatic restarts are disabled so a VM reboot cannot bypass that preflight; systemd controls restarts. Also confirm provider-side resource/credit expiry. **Stopping containers does not stop VM, disk or public-IP charges**; approved provider shutdown/deletion needs its own owner decision. Renewing a pilot requires reviewed costs and a new plan.

Use process health, CPU/RAM, interface byte counters, certificate expiry and aggregated connection/failure counters. Logs are warn-level, rotated locally (10MB ×3 per container), with no HTTP access log or call content recording. Operational inspection must still redact tokens, addresses, identity/room names and private metadata. Define authorized log access/deletion and any metrics export before pilot. No paid monitoring resource is created.

Rollback: disable new app admission, disconnect/end active calls through the reviewed provider API, stop this service, retain protected volumes and restore the last reviewed image/config with the same admission safeguards. No destructive database or volume cleanup is part of production rollback. The smoke's `down --volumes` applies **only** to its randomly named disposable synthetic fixture. No restore drill or provider-global token-revocation guarantee is claimed.

## Verification

```sh
node node_modules/vitest/vitest.mjs run infra/owned-media/config.test.mjs
# Linux + Docker only, isolated synthetic identities and certificates:
node scripts/test-owned-media-server.mjs
```

The second check starts the actual pinned stack, validates TLS, checks no automatic room creation, a two-person limit, TURN authentication, removal and deleted-room replay. It separately reports whether a cached token can rejoin an existing room after removal; this observation must not be converted into an unsupported strict-revocation claim. It never captures hardware or forwards a private call. CI is not a public-host or physical-phone test.

Sources checked29October2026: [LiveKit VM deployment](https://docs.livekit.io/transport/self-hosting/vm/), [network ports](https://docs.livekit.io/transport/self-hosting/ports-firewall/), [deployment/TURN](https://docs.livekit.io/transport/self-hosting/deployment/), [upstream templates at1a7b369](https://github.com/livekit/deploy/tree/1a7b369f94e3a2f890d366fceeb4f273bf9fb3f6/generate/templates), [LiveKit v1.13.11 config](https://github.com/livekit/livekit/blob/v1.13.11/pkg/config/config.go), [Caddy layer4 proxy](https://github.com/mholt/caddy-l4/tree/master/modules/l4proxy). Apache2.0 LiveKit/Caddy template provenance retained; review current Redis licensing and all image advisories before production activation.
