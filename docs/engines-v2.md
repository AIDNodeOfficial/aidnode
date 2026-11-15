# AIDNode Service Engines v2.1

**The Support Network for Autonomous Agents.** Live beta endpoint: `https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp`

AIDNode runs five **deterministic, auditable service engines**, not newly trained foundation models. Responses are structured JSON and limited to the evidence actually observed. All tools require an authorized free beta API key for execution and a unique `operation_id` per request. The MCP `initialize` and `tools/list` methods are public.

**Current public-beta limits:** first 100 operator accounts, 500 successful calls per account, no live billing, no retroactive charge. Do not send personal information, secrets, private source code, or confidential business data.

## AIDNode Repair

**Why use it:** diagnose an HTTP/transport failure, determine whether a retry is safe, honor `Retry-After`, and produce a bounded, machine-readable recovery recommendation.

MCP example:
```json
{"name":"repair","arguments":{"operation_id":"repair-case-001","status":429,"method":"GET","attempt":2,"max_attempts":4,"response_headers":{"Retry-After":"3"}}}
```

Returns: `category`, `probable_cause`, `automatic_retry_permitted`, `requires_outcome_check`, `action`, `retry_policy`, and `steps`.

**No recovery action is performed.** State-changing operations with uncertain outcomes are explicitly blocked from automatic replay. Recommendations are rule-tested, not validated against every API provider's behavior.

## AIDNode Verify

**Why use it:** independently retrieve *allowlisted public* HTTPS content, compute a content digest, or compare caller-provided text/JSON with canonical hashes and change paths.

MCP example (public source):
```json
{"name":"verify","arguments":{"operation_id":"verify-case-001","mode":"public_http","url":"https://www.rfc-editor.org/rfc/rfc9110.html"}}
```

Also supports `mode:"compare_text"` (legacy `previous` and `current` strings) and `mode:"compare_json"` for structured changes. `expected_sha256` is optional for a public source.

**Limitations:** public fetches are restricted to a fixed set of reviewed hostnames, 7-second timeout, 32 KB maximum observed body, no URL credentials, queries, redirects, or private addresses. A matching digest establishes an observed artifact match, **not that the content is factually true, complete, or its claimed author is authentic**. For large pages, the digest may be unavailable.

## AIDNode Witness

**Why use it:** check required nested fields, expected values/types, document digest, and optionally a separately fetched public artifact's SHA-256. Return a hash-based HMAC-signed validation receipt.

MCP example:
```json
{"name":"witness","arguments":{"operation_id":"witness-case-001","document":{"run":{"status":"complete","items":3}},"required_fields":["run.status","run.items"],"expected_values":{"run.status":"complete"},"expected_types":{"run.items":"number"}}}
```

Returns: `passed`, `failures`, `document_sha256`, `evidence_basis`, `external_evidence` (if requested) and a `signature` when the server signing secret is configured. The receipt authenticates **AIDNode's assessment of submitted evidence**, not actual completion of an outside-world task.

Verify a receipt via `POST https://botstop-dev.botstop-dev-lab-2026.workers.dev/receipts/verify` with `{"receipt":<original-receipt>}`. Changes to a signed receipt invalidate the signature. HMAC receipts are verified through the AIDNode service; they are not independently verifiable without that service.

## AIDNode Monitor

**Why use it:** trigger a real, independent HTTPS `HEAD` or `GET` probe against an approved public endpoint. Checks status, HTTP reachability, response time, optional content hash, and redirect behavior.

MCP example:
```json
{"name":"monitor","arguments":{"operation_id":"monitor-case-001","url":"https://developers.cloudflare.com/workers/","method":"HEAD","expected_status":[200,399]}}
```

Returns: `healthy`, `observed`, and `checks`, including timestamps and time to response. Public destination restrictions protect against SSRF and proxy abuse.

**Limitations:** v2 beta is *on-demand only*. Recurring subscriptions, arbitrary customer-owned domains, alert delivery, and broad integration checks are not yet implemented.

## AIDNode Recovery

**Why use it:** safely plan how to resume a failed multi-step workflow using dependency ordering, known outcomes, idempotency, and side-effect risk.

MCP example:
```json
{"name":"recovery","arguments":{"operation_id":"recovery-case-001","steps":[{"id":"fetch","status":"succeeded"},{"id":"transform","status":"failed","depends_on":["fetch"],"idempotent":true},{"id":"publish","status":"pending","depends_on":["transform"],"side_effects":true}]}}
```

Returns: `plan.resume_in_topological_order`, `plan.preserve_completed`, `plan.blocked`, `plan.compensation_candidates`, and `plan.operator_review_recommended`.

**No external actions are replayed.** Unknown in-flight outcomes and non-idempotent retries are blocked, not guessed to be safe. Orchestrators must implement their own authorized execution and outcome reconciliation.

## Security and scope

- Only public, reviewed HTTPS origins are eligible for Verify/Monitor remote fetches. No arbitrary proxying or internal-network access.
- A valid `operation_id` is required for the existing beta usage ledger and replay protection.
- No payments, stablecoins, recurring charges, or retroactive charges are enabled.
- AIDNode does not certify fact truth, task completion, identity, or ownership unless separately and independently established.
- Rules and unit tests are intended as a dependable foundation, **not a guarantee of production accuracy**. Independent operator trials and reliability benchmarks remain necessary.

Report genuine bugs and results at [AIDNode's beta testing thread](https://github.com/AIDNodeOfficial/aidnode/issues/1).
