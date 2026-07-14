# env-secrets MCP Server

The `env-secrets` MCP (Model Context Protocol) server lets AI agents discover and manage secrets in AWS Secrets Manager during an agentic session — without the agent needing to know vault credentials or SDK specifics.

Secret **values are never returned to the agent**. The available tools only expose metadata and CLI commands. To read or write a secret value, the agent uses `get_command` to produce a ready-to-run CLI command that the user executes directly in their terminal.

Transport: **stdio only**. The server is launched as a subprocess by the MCP host; no running daemon or open port is required.

---

## Installation

```bash
npm install -g env-secrets
```

Or use with `npx` (no global install needed):

```json
{
  "command": "npx",
  "args": ["-y", "env-secrets", "mcp"]
}
```

---

## Available Tools

### `list_secrets`

List available secret names, with optional prefix filter.

| Parameter | Required | Description                   |
| --------- | -------- | ----------------------------- |
| `prefix`  |          | Filter secrets by name prefix |
| `region`  |          | AWS region                    |
| `profile` |          | AWS profile name              |

**Example response:**

```json
[
  {
    "name": "my-app/prod",
    "description": "Production secrets",
    "lastChangedDate": "2024-01-15T..."
  },
  {
    "name": "my-app/staging",
    "description": null,
    "lastChangedDate": "2024-01-10T..."
  }
]
```

---

### `describe_secret`

Return metadata about a secret. **Never returns the secret value.**

| Parameter     | Required | Description      |
| ------------- | -------- | ---------------- |
| `secret_name` | ✅       | Secret name      |
| `region`      |          | AWS region       |
| `profile`     |          | AWS profile name |

**Example response:**

```json
{
  "name": "my-app/prod",
  "arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:my-app/prod",
  "description": "Production secrets",
  "createdDate": "2024-01-01T00:00:00.000Z",
  "lastChangedDate": "2024-01-15T00:00:00.000Z"
}
```

---

### `get_command`

Returns a ready-to-run `env-secrets` CLI command string for the requested action. **No secret values are ever included.** The user runs the returned command in their terminal — secret values are handled entirely outside the agent.

| Parameter     | Required | Description                                                                    |
| ------------- | -------- | ------------------------------------------------------------------------------ |
| `action`      | ✅       | One of `get`, `set`, `list`, `describe`                                        |
| `secret_name` |          | Secret name (required for `get`, `set`, `describe`; used as prefix for `list`) |
| `key`         |          | Key name (used for `set` action)                                               |
| `region`      |          | AWS region flag value                                                          |
| `profile`     |          | AWS profile flag value                                                         |

**Example responses:**

```
# get — injects secrets as env vars into a subprocess; values never touch the agent
env-secrets aws -s 'my-app/prod' --region 'us-east-1' -- <your-program>

# set — replace 'your-value' with the actual value, or use read -rs to keep it out of shell history:
# read -rs VALUE && printf '%s' "$VALUE" | env-secrets aws secret append -n 'my-app/prod' --key 'DATABASE_URL' --value-stdin
printf 'your-value' | env-secrets aws secret append -n 'my-app/prod' --key 'DATABASE_URL' --value-stdin

# list
env-secrets aws secret list --prefix 'my-app/'

# describe
env-secrets aws secret get -n 'my-app/prod'
```

---

## Per-Agent Configuration

### Claude Code

Add to `~/.claude/settings.json` (global) or `.claude/settings.json` (project):

```json
{
  "mcpServers": {
    "env-secrets": {
      "command": "npx",
      "args": ["-y", "env-secrets", "mcp"],
      "env": {
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

With a global install (`npm install -g env-secrets`):

```json
{
  "mcpServers": {
    "env-secrets": {
      "command": "env-secrets-mcp"
    }
  }
}
```

Restart Claude Code after changing the config. The tools `list_secrets`, `describe_secret`, and `get_command` will be available in the session.

---

### OpenAI Codex

Add to `~/.codex/config.toml` or project `codex.toml`:

```toml
[[mcp_servers]]
name = "env-secrets"
command = ["npx", "-y", "env-secrets", "mcp"]

[mcp_servers.env]
AWS_REGION = "us-east-1"
```

With a global install:

```toml
[[mcp_servers]]
name = "env-secrets"
command = ["env-secrets-mcp"]
```

---

### Gemini CLI

Add to `~/.gemini/settings.json` or project `.gemini/settings.json`:

```json
{
  "mcpServers": {
    "env-secrets": {
      "command": "npx",
      "args": ["-y", "env-secrets", "mcp"],
      "env": {
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

---

## AWS Credentials

The MCP server respects the standard AWS credential chain — environment variables, `~/.aws/credentials`, IAM roles, etc. No new auth configuration is needed beyond what you already use for `env-secrets`.

Set `AWS_REGION` in the `env` block of your MCP server config, or pass `region` on each tool call.

---

## Security Notes

- **Secret values never enter the agent context.** The MCP server exposes only metadata (`list_secrets`, `describe_secret`) and CLI command strings (`get_command`). Actual secret values are handled entirely by the user in their terminal.
- To read secrets into a process, use the `get` command returned by `get_command`: it injects secrets as environment variables into a subprocess without exposing them to the agent.
- To write a secret, use the `set` command returned by `get_command`: it uses `--value-stdin` so the value is piped in by the user and never enters the agent stream. Use `read -rs VALUE && printf '%s' "$VALUE" | ...` instead of `printf 'your-value'` to also keep the value out of shell history.
- No HTTP or SSE transport is available — stdio only, so the server is not exposed as a network service.
- The server exits cleanly when stdin closes (host process terminated).
