# Connect AIDNode to Cline (remote MCP)

**AIDNode** is a free-beta, remotely hosted Streamable HTTP MCP server. It is not a locally installed executable.

## 1. Get an authorized free beta key

A human operator must authorize joining the development beta and agree to its terms. The beta is free with **no retroactive billing**, 100 account capacity and up to 500 successful operations per account.

Review the terms and current availability: https://botstop-dev.botstop-dev-lab-2026.workers.dev/beta

From an operator-controlled terminal, submit your own **unique** operator identifier, an agent name, and explicit agreement:

```bash
curl --fail --show-error --request POST \
  'https://botstop-dev.botstop-dev-lab-2026.workers.dev/beta/join' \
  --header 'Content-Type: application/json' \
  --data '{"operator_id":"your-unique-operator-identifier","agent_name":"My Cline Agent","agree_beta_terms":true}'
```

The API responds with an **API key once**. Do not put that key into a GitHub repository, public chat, issue, or logs.

## 2. Configure Cline

In Cline, open **MCP Servers > Remote Servers**, enter the remote address below and choose **Streamable HTTP**. For authenticated tool calls add your secret key to the Authorization header.

**Server URL:** `https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp`

Alternatively, edit Cline's `cline_mcp_settings.json` using the example below, then replace the placeholder **locally**. Cline uses exactly `"streamableHttp"` (camel case) for this transport.

```json
{
  "mcpServers": {
    "aidnode": {
      "type": "streamableHttp",
      "url": "https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer REPLACE_WITH_YOUR_PRIVATE_BETA_KEY"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

> **Credential handling:** Cline may store the token as local configuration. Use a secure, operator-controlled computer. Do not paste a real key into a shared or committed file.

## 3. Test the connection

- Confirm Cline discovers `repair`, `verify`, `witness`, `monitor`, `recovery`, and `submit_beta_feedback`.
- Try `repair` with an HTTP 429 error and `operation_id` set to a unique 8-character-plus string. It should offer recovery advice, **not actually execute a repair**.
- Try `verify` with two short, non-sensitive text strings and your own unique `operation_id`.
- Try `witness` with an example JSON object and explicit field requirements, **not a real customer's sensitive data**.
- Try `monitor` against an approved public HTTPS endpoint. AIDNode currently supports on-demand checks, not ongoing alert subscriptions.
- Try `recovery` with sanitized multi-step workflow data. Recovery generates a safe plan but does not execute external actions.
- Use the [five-tool testing playbook](docs/agent-testing-playbook.md) for realistic example requests.

The public MCP `initialize` and `tools/list` handshakes do not require a key, but actual `tools/call` requests do.

## 4. Give useful feedback

The beta asks for voluntary feedback at usage checkpoints, and the [structured feedback form](https://github.com/AIDNodeOfficial/aidnode/issues/new?template=agent-beta-report.yml) supports all five services. The [public invitation](https://github.com/AIDNodeOfficial/aidnode/issues/1) also accepts comments.

Please report connection issues, correct and incorrect results, and how the output affected real tasks. This feedback does not authorize future payment.

## What these tools do not do

- Repair suggests recovery steps but never performs them.
- Verify compares **supplied** data and may retrieve small artifacts from an approved public HTTPS allowlist; it cannot certify real-world factual accuracy.
- Witness checks **supplied** structures, optionally references approved public evidence, and issues a validation receipt; it cannot prove someone completed a task in the external world.
- Monitor performs **on-demand** health checks of approved public HTTPS endpoints, not recurring scheduled monitoring.
- Recovery recommends dependency-aware workflow resumption steps without executing them.

**Privacy:** Never submit secrets, passwords, private customer files, or personal information.

**Published Registry identity:** `io.github.AIDNodeOfficial/aidnode`.
