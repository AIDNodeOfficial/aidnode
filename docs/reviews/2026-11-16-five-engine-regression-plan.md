# Five-engine regression candidates, 2026-11-16

**Status:** review-only test design; not executable CI tests, not production changes. Cloudflare Worker source is not in this public metadata repository. Do not mark these cases passed without running them against an authorized isolated deployment or test harness.

## Observed baseline

- D1 has 2 beta accounts named as internal fulfillment/acceptance tests, 41 recorded operations: Repair 13, Verify 8, Witness 17, Recovery 3, Monitor 0. These are **internal synthetic tests, not 2 independent customers**.
- D1 has 0 `beta_feedback` records. The public beta invitation has 0 comments.
- Cline marketplace submission #3824 is open; no review comments as checked. Independent Cline-client connection testing is still missing.
- No live engine correctness or performance regression was executed in this review; avoid claiming validated fixes.

## Ranked regression candidates

| Rank | Engine | Fixture / trigger | Required assertion | Why |
| --- | --- | --- | --- | --- |
| P0 | Repair | `POST` with a transport timeout after the body was sent, no idempotency key, unknown commit outcome | `automatic_retry_permitted=false`, explicit outcome reconciliation required | Prevent duplicate payments, orders and side effects |
| P0 | Verify | `public_http` URL with an approved-looking hostname followed by userinfo, redirects to localhost/private ranges, DNS rebinding, or encoded bypasses | Reject unapproved URL/redirect/address; do not fetch private targets; record accurate evidence basis | SSRF and provenance integrity |
| P0 | Witness | Required field is missing, or only caller claims completion with no independently observed external evidence; signed receipt is altered | Validation fails for missing predicate; no real-world-completion assertion; tampered receipt verification fails | Avoid unsupported attestations |
| P1 | Monitor | Approved HTTPS endpoint returns 429/403 anti-bot response, HEAD unsupported, or transient 5xx | Distinguish observed HTTP status from confirmed outage; never auto-probe arbitrary private destinations | Lower false positives and unwanted egress |
| P0 | Recovery | A failed graph includes a completed non-idempotent step, unknown in-flight payment, and dependent publish step | Preserve completed work; block uncertain side effects and dependent actions; never execute any action | Prevent duplicate irreversible operations |

## Additional edge-case assertions

**Repair:** Retry-After in seconds and HTTP-date format, negative/huge values, max-attempt exhaustion, safe GET 503, and POST with explicit idempotency key but unknown provider guarantees. Include deterministic bounded retry jitter and operation-ID replay behavior.

**Verify:** Canonical JSON property order equivalence, array-order sensitivity, text Unicode normalization policy, >32 KB public artifacts, 7-second timeout, HTTP error status, allowlist lookalikes and credentials in URL. State whether a digest covers the entire resource or only an observed subset.

**Witness:** Nested required fields with arrays, `null` versus missing, expected type mismatch, mutation of every signed field, secret rotation, and receipt expiry/retention policy. Do not equate a matching hash with proof of execution.

**Monitor:** 204, 301, 403, 429, 500, timeout, certificate failure, HEAD/GET differences, response content hash mismatch and rate-limiting. Check latency units and timestamps, and label on-demand-only behavior.

**Recovery:** Cyclic dependencies, nonexistent dependencies, repeated step IDs, completed upstream tasks, unknown commit state, compensation suggestion for irreversible steps, and stable topological ordering. No automated action execution.

## How to promote to a real test

1. Locate the actual Worker source and test runner in an authorized environment; this public repo intentionally contains only metadata/docs.
2. Translate each fixture into deterministic unit tests with expected JSON assertions; run against an isolated staging worker using synthetic data.
3. Run auth, replay, SSRF, quota and HMAC-negative tests without secrets in logs.
4. Record exact version, run IDs, pass/fail counts, latency and estimated per-call cost.
5. Only after a reviewed pull request and owner approval consider production deployment.

## External adoption measurement

Use `beta_accounts`, `operations`, `beta_feedback`, plus authorized registration-source metadata. Exclude internal acceptance-test accounts from customer count. A completed operation is not evidence of a successful customer task. Track actual independently operated agents, real tasks, return use and cost only when supported by evidence. Do not claim willingness to pay from an AI-generated response.

## Outreach status

Existing invitation: https://github.com/AIDNodeOfficial/aidnode/issues/1

Existing pending Cline submission (updated for five tools): https://github.com/cline/mcp-marketplace/issues/3824

No new external forum outreach was performed this cycle. Avoid posting unsolicited comments or duplicate directory submissions. Submit to a new directory only after verifying its rules and submission route.
