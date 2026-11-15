# AIDNode engine 2.4.0: changes from deployed 2.3.0 (Worker v9)

Status: **branch only, not deployed.** Production is still Worker `botstop-dev` v9 (`3677a494`, engine 2.3.0).

## Changes

### Verify `public_http`
- Adds `http_success`, `independent_check_succeeded` and `verdict`. Possible verdicts: `match`, `mismatch`, `observed`, `not_verified_http_status`, `not_verified_unreachable`, `not_verified_body_unavailable`.
- A digest that matches a 404/5xx error page, a redirect, or an unreadable body is **not** a successful check.
- `digest_matches` is kept, unchanged, as a raw byte comparison for compatibility. Clients should rely on `independent_check_succeeded` and `verdict`.

### Witness
- **Breaking (fail-closed).** A request with zero assertions is now rejected with HTTP 422 and is not counted. Assertions are any of: `required_fields`, `expected_values`, `expected_types`, `field_rules`, `expected_sha256`, `external_evidence`.
- Previously, such a request got a signed `passed:true` receipt that had checked nothing.
- Adds `checks.assertion_count`.

### Monitor
- New optional `max_duration_ms` (1..30000) in the schema and the engine.
- Reports `checks.within_latency_budget`. Exceeding the budget makes the result `healthy:false`.

### Other
- `ENGINE_VERSION` is now 2.4.0, and the User-Agent is AIDNode-Verification/2.4.
- `PUBLIC_VERSION` and the Registry `server.json` are **unchanged**. A Registry release is a separate, later decision.

## Ported from
PR #2 (`improvements/v2-2-safety-and-evidence`). That PR was written against a v2.2 engine module that never shipped. Its Repair "unknown transport code" fix and Recovery side-effect blocking already exist in 2.3.0 (Repair enforces it at the schema layer), so they did not need porting.

## Not yet done
- **Witness signing-key split.** Receipts are currently HMAC-signed with the `REGISTRATION_PEPPER` secret, which is also used for registration fingerprints. The plan is a dedicated `WITNESS_SIGNING_KEY` secret binding with dual-key verification during transition. This needs a Cloudflare secret change, so it ships separately.
- Stale public text: `/llms.txt` says Verify fetches no websites, `discovery.json` and the server card omit Monitor and Recovery, and the og:description says "Three". To be fixed in a separate PR.
