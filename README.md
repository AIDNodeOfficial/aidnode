# AIDNode

**The Support Network for Autonomous Agents**

[![AIDNode MCP connector](https://glama.ai/mcp/connectors/io.github.AIDNodeOfficial/aidnode/badges/score.svg)](https://glama.ai/mcp/connectors/io.github.AIDNodeOfficial/aidnode)

**Remote MCP URL:** `https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp` · Streamable HTTP · free beta key · **[Agent quick start (Claude Code, Cursor, VS Code, Cline, LangChain, CrewAI, OpenAI Agents SDK)](docs/quickstart-agents.md)**

```bash
claude mcp add --transport http aidnode https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp --header "Authorization: Bearer $AIDNODE_API_KEY"
```

AIDNode is an experimental, free-beta **Model Context Protocol (MCP)** service hosted on Cloudflare. It provides five structured agent utilities for diagnostics, comparison, constrained public-source evidence checks, validation receipts, endpoint probes, and safe workflow recovery planning.

AIDNode is **not a conversational AI agent**. Repair and Recovery are advisory, Verify and Monitor can independently fetch only approved public HTTPS origins, and Witness signs checks of evidence but **cannot certify real-world task completion**. These are auditable deterministic engines, not newly trained AI models.

## Calling AI-agent operators and developers: free beta testers wanted

**Have an MCP-compatible AI agent?** AIDNode is looking for independently operated agents to try Repair, Verify, Witness, Monitor, and Recovery on practical, non-sensitive tasks. The beta is free (up to 100 operator accounts, 500 successful calls each), with no payments or retroactive charges.

**[Join the public beta-testing invitation and share feedback](https://github.com/AIDNodeOfficial/aidnode/issues/1)**. Operator permission is required before enrollment. AIDNode values honest results, including failures and limitations, not artificial bot traffic.

**[Agent test playbook](docs/agent-testing-playbook.md)** provides five safe example tests. **[Submit structured feedback](https://github.com/AIDNodeOfficial/aidnode/issues/new?template=agent-beta-report.yml)** to report what actually worked, failed, or needs improvement. Reports must use authorized, non-sensitive data. This is a genuine beta evaluation, not a request for paid endorsements or synthetic traffic.

### Cline developer preview

AIDNode has been [submitted to Cline's MCP Marketplace for review](https://github.com/cline/mcp-marketplace/issues/3824). **Submission is pending review and is not a Marketplace approval.**

Cline users can [follow the remote Streamable HTTP setup guide](llms-install.md) to test the service with operator authorization. Cline-specific end-to-end testing by an outside developer is still requested.

## Live service

- **Website:** https://botstop-dev.botstop-dev-lab-2026.workers.dev/about
- **MCP endpoint (Streamable HTTP):** https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp
- **Health:** https://botstop-dev.botstop-dev-lab-2026.workers.dev/health
- **OpenAPI:** https://botstop-dev.botstop-dev-lab-2026.workers.dev/openapi.json
- **Agent onboarding:** https://botstop-dev.botstop-dev-lab-2026.workers.dev/llms.txt
- **Free beta terms/capacity:** https://botstop-dev.botstop-dev-lab-2026.workers.dev/beta
- **Discovery metadata:** https://botstop-dev.botstop-dev-lab-2026.workers.dev/discovery.json
- **MCP Server Card (SEP-2127):** https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp/server-card (listed in `/.well-known/ai-catalog.json`)

The legacy `botstop-dev` hostname is preserved for compatibility. The public-facing service is branded **AIDNode**.

## Available tools

| Tool | What it actually does |
| --- | --- |
| `repair` | Classifies API/transport failures and creates idempotency-aware, bounded retry plans. Advisory only. |
| `verify` | Compares text or canonical JSON and can independently fetch small artifacts from a fixed list of approved public HTTPS origins. No factual-truth certification. |
| `witness` | Checks structured evidence, optionally compares an independently fetched public artifact, and issues an HMAC-signed receipt. Not proof of real-world completion. |
| `monitor` | Performs on-demand, restricted HTTPS status/content health probes. Recurring schedules are not yet available. |
| `recovery` | Builds safe dependency-aware workflow resume and compensation plans; never executes recovery actions. |
| `submit_beta_feedback` | Accepts optional, nonbinding agent feedback at usage checkpoints (currently Repair, Verify, Witness and overall). |

**[Read the complete five-engine guide](docs/engines-v2.md)**, including exact MCP call examples, limitations, and receipt verification.

## Free development beta

- Up to **100 operator accounts**, with **500 successful operations per account**.
- **No payment, charges, or retroactive billing** during the beta.
- Any suggested future price is research only, not a commitment to pay.
- Operator authorization is required to enroll an agent.
- Never send credentials, personal data, secrets, or confidential third-party content.

### Authorized enrollment

With operator permission, POST JSON to `/beta/join`:

```json
{
  "operator_id": "your-unique-operator-id",
  "agent_name": "Your Agent Name",
  "agree_beta_terms": true
}
```

Store the returned beta API key privately. For protected `tools/call` operations, send `Authorization: Bearer <API key>`. **Never commit API keys, Cloudflare secrets, or personal credentials to GitHub.**

MCP `initialize` and `tools/list` are public; calls to the tools require a beta key.

## Official MCP Registry

- Published registry name: **`io.github.AIDNodeOfficial/aidnode`**
- Listing metadata: [server.json](server.json)
- Instructions: [HOW_TO_START.md](HOW_TO_START.md)
- Manual publishing workflow: [Validate and Publish AIDNode MCP](.github/workflows/publish-mcp.yml)

The workflow is **manual only**, not triggered by normal commits. It must confirm the public health endpoint and an MCP initialize handshake, validate `server.json`, authenticate with GitHub OIDC, and only then attempt publication.

**Repository existence does not mean Registry publication succeeded.** Check the Actions job logs and the public Registry record before announcing a live listing.

This repository contains **public metadata and instructions**, not the Cloudflare application source, secrets, or customer data.
