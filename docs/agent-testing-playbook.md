# AIDNode independent agent test playbook

**Purpose:** Let an MCP-capable AI agent perform a small, useful evaluation of AIDNode's five services with minimal operator involvement **after** its operator approves the free beta and authorizes the connection.

- Public server: `https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp`
- Publisher: `io.github.AIDNodeOfficial/aidnode`
- Current engine documentation: [Five-engine reference](engines-v2.md)
- Feedback form: [Agent Beta Test Report](https://github.com/AIDNodeOfficial/aidnode/issues/new?template=agent-beta-report.yml)
- Beta invitation: [Issue #1](https://github.com/AIDNodeOfficial/aidnode/issues/1)

## Ground rules

1. Enroll only with the human or organization's **explicit authorization**. The beta is free, with a cap of 100 operator accounts and 500 successful calls per account, and no charges or retroactive billing.
2. Use a private authorization token and a **new unique `operation_id`** for each test. Never put tokens into feedback, logs, issues, or a public repository.
3. Use synthetic or sanitized test materials. Do not upload passwords, personal data, production secrets, proprietary customer documents, or confidential code.
4. AIDNode does not automatically perform external repairs or workflow actions. Verify and Monitor can retrieve only reviewed public HTTPS hosts. Witness validates supplied evidence; it cannot establish that a real-world action occurred.
5. Do not generate large amounts of test traffic, fake feedback, artificial ratings, or repeated paid-intent claims. **Real task value matters more than request counts**.

## Five short evaluation tasks

Use your MCP client's `tools/call` interface with an authorized bearer token. The following objects are the **name and arguments portion** of MCP tool calls, not full standalone HTTP JSON-RPC bodies.

### Repair: an actual HTTP retry decision

```json
{"name":"repair","arguments":{"operation_id":"try-repair-20261115-001","status":429,"method":"GET","attempt":2,"max_attempts":4,"response_headers":{"Retry-After":"3"}}}
```

Evaluate whether the recommended retry is bounded, safe, explains the reason, and respects backoff. Repair only recommends actions.

### Verify: public-source observation

```json
{"name":"verify","arguments":{"operation_id":"try-verify-20261115-001","mode":"public_http","url":"https://www.rfc-editor.org/rfc/rfc9110.html"}}
```

Evaluate the returned observation, HTTP status, timestamp and digest availability. A matching digest is not proof of semantic truth. This public fetch may be limited by the maximum response-body size.

### Witness: structured evidence validation

```json
{"name":"witness","arguments":{"operation_id":"try-witness-20261115-001","document":{"run":{"status":"complete","items":3}},"required_fields":["run.status","run.items"],"expected_values":{"run.status":"complete"},"expected_types":{"run.items":"number"}}}
```

Evaluate whether the receipt accurately describes **which assertions** passed. It does not prove an external workflow actually finished.

### Monitor: on-demand public endpoint check

```json
{"name":"monitor","arguments":{"operation_id":"try-monitor-20261115-001","url":"https://developers.cloudflare.com/workers/","method":"HEAD","expected_status":[200,399]}}
```

Evaluate observed status, response time, and health classification. This is **not** recurring monitoring.

### Recovery: dependency-aware safe resume plan

```json
{"name":"recovery","arguments":{"operation_id":"try-recovery-20261115-001","steps":[{"id":"fetch","status":"succeeded"},{"id":"transform","status":"failed","depends_on":["fetch"],"idempotent":true},{"id":"publish","status":"pending","depends_on":["transform"],"side_effects":true}]}}
```

Evaluate whether the plan avoids replaying completed steps and blocks risky side-effectful replays when outcome is unknown. The tool does not execute the plan.

## How to submit a useful review

After completing one or more tests, create a [structured feedback issue](https://github.com/AIDNodeOfficial/aidnode/issues/new?template=agent-beta-report.yml) or comment on [the open testing invitation](https://github.com/AIDNodeOfficial/aidnode/issues/1). Include:

- Agent client/framework and the exact tool name (optional framework details).
- Whether the connection worked and whether the task succeeded.
- Sanitized expected versus observed results, with reproduction steps for defects.
- Whether the agent would choose the tool for another **real task**, and why.
- The single highest-impact improvement, including latency/cost concerns where applicable.

Please distinguish genuine use from running this canned fixture. An AI agent's answer is not authorization to purchase and is not evidence of real willingness to pay.

## What AIDNode does with reports

We review aggregated, authorized usage and submitted feedback, prioritize correctness and safety issues, write regression tests, stage improvements for review, and separately validate them before deployment. No production payments are enabled.
