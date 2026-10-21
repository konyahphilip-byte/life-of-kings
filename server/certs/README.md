# Supabase database certificate authority

`supabase-prod-ca-2021.crt` is a public CA certificate, not a credential or private key. It was downloaded over verified HTTPS on 21 October 2026 from:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

The URL matches Supabase Studio's official `ssl:certificate_url` configuration at source revision `5491fb60bc0f27b8909a83100d79499aa7667ee5`:
https://github.com/supabase/supabase/blob/5491fb60bc0f27b8909a83100d79499aa7667ee5/apps/studio/hooks/custom-content/custom-content.json

- Subject/issuer: Supabase Root 2021 CA, Supabase Inc.
- SHA-256 fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`
- Valid from 28 April 2021 to 26 April 2031.
- Download validation checked the CA flag, issuer/subject, expiry and self-signature.

Render must set `NODE_EXTRA_CA_CERTS=./server/certs/supabase-prod-ca-2021.crt` before starting Node. The existing PostgreSQL pool retains `rejectUnauthorized: true`; hostname verification remains enabled. Node reads this variable at process startup, so changing it requires a full new deployment. It extends the process's trusted CA list for outbound TLS; it is not limited to the database connection. It does not replace the built-in public roots.

Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`, disable certificate verification, or add `sslmode=no-verify`. Review changes to this trust anchor and check current Supabase guidance before rotation. Schedule renewal well before expiry and retain a successful hosted Postgres health receipt after any rotation.

References: https://supabase.com/docs/guides/platform/ssl-enforcement and https://nodejs.org/api/cli.html#node_extra_ca_certsfile.
