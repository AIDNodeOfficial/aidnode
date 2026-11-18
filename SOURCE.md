# Source provenance

`src/worker.js` was committed **byte-for-byte as deployed** in commit 1 of branch `olivia/v9-source-and-fixes`.

| Field | Value |
|---|---|
| Cloudflare Worker | `botstop-dev` (workers.dev) |
| Version | v9, id `3677a494-514a-45cf-8b26-522913c0c9e2` |
| Deployed | 2026-11-15 18:42:28 UTC (12:42 PM CST), 100% of traffic |
| Engine version reported by `/health` | 2.3.0 |
| Retrieved | 2026-11-15, read-only `GET /workers/scripts/botstop-dev/content/v2` |
| SHA-256 of as-deployed `src/worker.js` | `9d77bde11fbbd2d9f2ecd7b34a28f8d5a5ec778ae38611171c6c2b754d6403f0` |

Bindings (by name only; values are never in git):
- `DB` is D1 `botstop-dev-db`.
- `BETA_MODE` and `BILLING_MODE` are plain-text vars.
- `REGISTRATION_PEPPER` is a **secret binding**. It stays in Cloudflare.
- `WITNESS_SIGNING_KEY` (engine 2.5.0+) is a **secret binding** used only to sign and verify Witness receipts (`key_id aidnode-witness-k1`). It stays in Cloudflare. Legacy pepper-signed receipts verify until 2026-12-18 CST; see `docs/engines-v2-5-witness-key-split.md`.

`migrations/0000_schema.sql` is the production D1 **schema only**: tables, indexes and triggers, read-only dump, no rows.

Before committing, the file was scanned for secrets, keys, emails, IPs and account IDs. None were found. The Worker reads all secrets from `env`.

**Rollback:** in Cloudflare, redeploy version `3677a494` (v9). The previous version is v8 `acabb016`.
