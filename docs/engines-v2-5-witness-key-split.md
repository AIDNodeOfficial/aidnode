# AIDNode engine 2.5.0: Witness signing-key split

Status: **branch only until merged and deployed.** Production is engine 2.4.0 (Worker `botstop-dev` version `86e37085`).
Decision: approved 2026-11-18 (decision log D-012 / D-015).

## What changes
- New Witness receipts are HMAC-SHA256 signed with a **dedicated Cloudflare secret binding, `WITNESS_SIGNING_KEY`** (generated with a CSPRNG, 32 random bytes, hex-encoded). It is never stored in git, logs or files.
- New receipts carry `signature.key_id = "aidnode-witness-k1"`.
- `key_id` is **bound into the HMAC key derivation** (`SHA-256("aidnode-witness-receipt-v3|" + key_id + "|" + secret)`). Changing `key_id` on a receipt invalidates its signature. A `key_id` by itself never makes a receipt valid.
- `REGISTRATION_PEPPER` is **unchanged** and still used for registration fingerprints. For Witness it is used only to *verify* legacy receipts during the transition (and as a signing fallback only if `WITNESS_SIGNING_KEY` is missing, inside the window).

## Legacy transition (30 days)
- Legacy receipts are receipts with **no `key_id`** or **`key_id = "aidnode-worker-v2"`**, signed with `REGISTRATION_PEPPER` by engines up to 2.4.0.
- They verify until **2026-12-18 23:59:59 CST** (`LEGACY_RECEIPT_ACCEPT_UNTIL = 2026-12-19T05:59:59Z`).
- After the cutoff, `/receipts/verify` returns `{"valid":false,"reason":"legacy_key_retired"}` for them, and the Worker no longer falls back to pepper signing. Follow-up: remove the legacy code path in a cleanup PR after Dec 18, 2026.

## `/receipts/verify` response
Adds `key_id`, `legacy_key` (boolean) and, for legacy receipts, `legacy_accepted_until`. New failure reasons: `unknown_key_id`, `signature_mismatch`, `legacy_key_retired`. Existing reasons (`malformed_receipt`, `invalid_signature_format`, `signing_not_configured`) are unchanged.

## Rollback note
Rolling back to 2.4.0 restores pepper-only verification. Receipts issued by 2.5.0 (`key_id aidnode-witness-k1`) would then **not** verify, while legacy receipts keep verifying. Roll back only if the 2.5.0 smoke test fails.

## Other
- `ENGINE_VERSION` 2.5.0, User-Agent `AIDNode-Verification/2.5`.
- Public smoke-test pin raised from `>= 2.3.0` to `>= 2.4.0` (raise to `>= 2.5.0` after the 2.5.0 deploy).
- `PUBLIC_VERSION` and the Registry `server.json` are unchanged.
