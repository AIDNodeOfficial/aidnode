# AIDNode weekly review: 2026-11-23 (review only)

## Verified baseline (Cloudflare D1 read-only)

- 3 beta accounts, all explicitly named internal acceptance/smoke tests.
- 43 successful recorded operations: Repair 13, Verify 8, Witness 19, Monitor 0, Recovery 3.
- 0 external operator accounts verified; 0 `beta_feedback` records.
- No new external feedback in GitHub beta issue #1 or Cline reviewer comments as of November 23.
- D1 `beta_feedback.service` CHECK currently permits only `repair`, `verify`, `witness`, `overall`, **not `monitor` or `recovery`**. This is a concrete five-tool feedback-collection gap, not an engine outage. The published GitHub feedback form does support all five.
- No external demand or cost-per-operation measurement can be inferred from internal traffic.

## Five ranked engineering investigations

| Priority | Tool | Failure scenario / proposed acceptance criterion | Evidence status |
|---|---|---|---|
| P0 | Repair | An ambiguous POST timeout must never be automatically replayed without a verified idempotency key and outcome reconciliation. | Regression candidate, not independently rerun this week |
| P0 | Verify | An allowlisted URL that redirects to an unapproved or private destination must not be fetched or counted as verified. Non-2xx digest matches must not count as success. | Regression candidate, not independently rerun this week |
| P0 | Witness | A changed receipt body or altered `signature.key_id` must fail verification; legacy receipts should stop verifying after the documented Dec 18 cutoff. | v2.5.0 signing-key split documented as deployed; cutoff test still pending |
| P1 | Monitor | A 429 or CDN challenge should be distinguished from an origin outage, with observed HTTP evidence and no unauthorized egress. | No recorded Monitor operations; synthetic fixtures needed |
| P0 | Recovery | A completed non-idempotent side effect with uncertain outcome must be blocked pending reconciliation, not replayed. | Regression candidate, not independently rerun this week |

## Concrete defect: feedback schema omits Monitor and Recovery

Production D1 schema observed November 23:

```sql
service TEXT NOT NULL CHECK(service IN ('repair','verify','witness','overall'))
```

**Reproduction in a disposable SQLite database only:** create a minimal table with the same `service` constraint; `INSERT ... service='monitor'` and `service='recovery'` both fail with a CHECK constraint error, while `service='repair'` succeeds. This is schema-level evidence that these services cannot be represented in that table. Whether the current HTTP feedback endpoint rejects them gracefully still requires an authorized integration test.

**Proposed fix (not deployed):** rebuild the `beta_feedback` table in a reviewed, transactional D1 migration with the same columns, foreign key, uniqueness constraint and index, changing only the service CHECK to:

```sql
CHECK(service IN ('repair','verify','witness','monitor','recovery','overall'))
```

SQLite cannot directly modify a table CHECK constraint using `ALTER TABLE`. Use the official table-rebuild procedure with a carefully reviewed transaction, copy existing rows, recreate `beta_feedback_by_date`, and verify row counts, foreign keys, uniqueness and original constraints. Test against a fresh disposable D1 database and back up before any production migration. The endpoint's own service enum and checkpoint handling must be checked separately, otherwise the database migration alone will not fix agent feedback.

**Acceptance tests:** all six service labels accepted; unknown labels rejected; original rows preserved; duplicate (account,checkpoint,service) rejected; checkpoint 10/50/100/250/500 enforced; no billing, credentials, or operator limits changed.

## Growth and costs

- Cline submission [#3824](https://github.com/cline/mcp-marketplace/issues/3824) remains open. The only observed comment was by AIDNodeOfficial, not a reviewer.
- [GitHub beta invitation #1](https://github.com/AIDNodeOfficial/aidnode/issues/1) has no external comments.
- MCP Registry and Glama are referenced in existing project materials. Treat listing/discovery as distinct from independently verified tool usage.
- Do not submit duplicate directory applications or unsolicited messages. Use an explicit listing/submission form when available.
- Cloudflare resource unit-cost telemetry was not gathered this run. No credible unit cost estimate or willingness-to-pay figure is available.
- Preserve free beta: 100 accounts maximum, 500 successful calls each, no billing or retroactive charges.

## Release gate

Review only. **No deployment, migration, billing change, customer terms change, or paid submission is authorized by this document.** Before shipping: isolate tests, obtain a green CI result, check endpoint/schema compatibility, obtain owner approval for production, and prepare rollback.
