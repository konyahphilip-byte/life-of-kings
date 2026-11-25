# M01 store foundations — security

Recorded on 25 November 2026 while joining an existing assignment.

Trust boundaries: untrusted merchant/model input -> strict configuration validation; authenticated server principal -> current membership; public read -> explicit publication/moderation/visibility. The access adapter is not registered, and its injected callbacks are not verified database enforcement. Require same-transaction authorized work and revocation locking before exposing an endpoint.

See [source-based contracts](../../../docs/marketplace/M01_STORE_FOUNDATIONS.md). No production sign-off is implied.
