# AIDNode MCP Registry publishing guide

The AIDNode GitHub repository is **https://github.com/AIDNodeOfficial/aidnode**.

## Before publishing

1. Verify the public health endpoint in a browser: https://botstop-dev.botstop-dev-lab-2026.workers.dev/health . Expected result includes `"ok":true`, `"name":"AIDNode"`, and `"live_payments":false`.
2. Review [server.json](server.json) and confirm it uses `io.github.AIDNodeOfficial/aidnode`, with exactly the same capitalization as the GitHub owner.
3. Verify an MCP JSON-RPC `initialize` request succeeds against `https://botstop-dev.botstop-dev-lab-2026.workers.dev/mcp`.
4. Review the GitHub Actions job before invoking it. Publishing uses GitHub OIDC and does not require an API token or custom domain.

## Publish manually

- Go to https://github.com/AIDNodeOfficial/aidnode/actions/workflows/publish-mcp.yml
- Select **Run workflow** on the main branch.
- The workflow checks the external endpoint, validates `server.json`, authenticates, and attempts to publish. If any preflight step fails, it will not publish.
- Inspect the job results. Only after successful publication check:
  https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.AIDNodeOfficial%2Faidnode

## Free beta safety

There is no cost to use the GitHub repository or the Cloudflare workers.dev domain under the existing free setup. Beta billing stays **disabled** and enrollment stays capped at **100 accounts**, **500 successful calls each**. Do not put credentials or customer data into GitHub Actions logs or repository files.

Publishing is a **separate action** from uploading files to this repository.
