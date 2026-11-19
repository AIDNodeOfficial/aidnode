# AIDNode agent quick start

AIDNode is a **remote MCP server** (Streamable HTTP). There is nothing to install.

- **MCP URL:** `https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp`
- **Auth:** `Authorization: Bearer <beta key>` for `tools/call`. `initialize` and `tools/list` work without a key.
- **Cost:** free development beta, 100 operator accounts, 500 successful calls each, billing disabled.
- **Registry name:** `io.github.AIDNodeOfficial/aidnode`

> Enroll only with your human operator's permission. Never put the key in a repository, issue, chat or log. Never send secrets or personal data to any tool.

## 1. Look before you enroll (no key)

```bash
curl -s https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## 2. Get a key (one time, operator-approved)

```bash
curl --fail -s -X POST https://botstop-dev.botstop-dev-lab-2026.workers.dev/beta/join \
  -H 'Content-Type: application/json' \
  -d '{"operator_id":"your-unique-operator-id","agent_name":"My Agent","agree_beta_terms":true}'
```

The response contains `api_key` **once**. Put it in an environment variable, for example `AIDNODE_API_KEY`.

## 3. First call (curl)

```bash
curl -s https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H "Authorization: Bearer $AIDNODE_API_KEY" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"repair","arguments":{"operation_id":"first-call-0001","status":429,"method":"GET","attempt":1,"max_attempts":4,"response_headers":{"Retry-After":"3"}}}}'
```

Every `tools/call` needs a unique `operation_id` (8-100 chars). Re-sending the same id with the same input returns the stored result without using another call.

## 4. Add it to your client

The snippets below follow each client's documented remote-MCP config format. They have not yet been run end to end against AIDNode by an outside user; if one fails, please [report it](https://github.com/AIDNodeOfficial/aidnode/issues/new?template=agent-beta-report.yml). Replace the key **locally**.

### Claude Code

```bash
claude mcp add --transport http aidnode https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp \
  --header "Authorization: Bearer $AIDNODE_API_KEY"
```

### Cursor (`~/.cursor/mcp.json` or `.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "aidnode": {
      "url": "https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp",
      "headers": { "Authorization": "Bearer ${env:AIDNODE_API_KEY}" }
    }
  }
}
```

### VS Code (`.vscode/mcp.json`)

```json
{
  "inputs": [
    { "type": "promptString", "id": "aidnode-key", "description": "AIDNode beta API key", "password": true }
  ],
  "servers": {
    "aidnode": {
      "type": "http",
      "url": "https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp",
      "headers": { "Authorization": "Bearer ${input:aidnode-key}" }
    }
  }
}
```

### Cline

See [llms-install.md](../llms-install.md) (`"type": "streamableHttp"`).

### LangChain / LangGraph (Python, `langchain-mcp-adapters`)

```python
import os
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "aidnode": {
        "transport": "streamable_http",
        "url": "https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp",
        "headers": {"Authorization": f"Bearer {os.environ['AIDNODE_API_KEY']}"},
    }
})
tools = await client.get_tools()  # repair, verify, witness, monitor, recovery, submit_beta_feedback
```

### CrewAI

```python
import os
from crewai_tools import MCPServerAdapter

params = {
    "url": "https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp",
    "transport": "streamable-http",
    "headers": {"Authorization": f"Bearer {os.environ['AIDNODE_API_KEY']}"},
}
with MCPServerAdapter(params) as tools:
    print([t.name for t in tools])
```

### OpenAI Agents SDK (Python)

```python
import os
from agents import Agent
from agents.mcp import MCPServerStreamableHttp

aidnode = MCPServerStreamableHttp(params={
    "url": "https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp",
    "headers": {"Authorization": f"Bearer {os.environ['AIDNODE_API_KEY']}"},
})
# async with aidnode: agent = Agent(name="ops", mcp_servers=[aidnode])
```

## 5. When to call which tool

| Situation | Tool |
| --- | --- |
| An HTTP/API call just failed and you're deciding whether to retry | `repair` |
| A multi-step workflow failed partway and you need a safe resume order | `recovery` |
| You need to know whether text/JSON changed, or digest an allowlisted public page | `verify` |
| You want a signed, checkable record that a JSON result met explicit rules | `witness` |
| You need a one-off up/down check of an allowlisted public HTTPS endpoint | `monitor` |

Exact arguments: [five-engine guide](engines-v2.md). Safe sample tests: [agent test playbook](agent-testing-playbook.md).

## 6. Tell us what happened

Honest results, including failures, help most: [structured feedback form](https://github.com/AIDNodeOfficial/aidnode/issues/new?template=agent-beta-report.yml). Feedback is never a purchase commitment, and no positive review is requested.
