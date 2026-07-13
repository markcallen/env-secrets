# env-secrets MCP Server

The `env-secrets` MCP (Model Context Protocol) server lets AI agents retrieve and set secrets from AWS Secrets Manager during an agentic session — without the agent needing to know vault credentials or SDK specifics.

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

### `get_secret`

Retrieve all key/value pairs from a secret.

| Parameter     | Required | Description                 |
| ------------- | -------- | --------------------------- |
| `secret_name` | ✅       | Secret name or ARN          |
| `region`      |          | AWS region                  |
| `profile`     |          | AWS profile name            |
| `vault`       |          | Vault type (`aws`, default) |

**Example response:**

```json
{
  "DB_URL": "postgres://...",
  "API_KEY": "sk-..."
}
```

---

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

| Parameter     | Required | Description        |
| ------------- | -------- | ------------------ |
| `secret_name` | ✅       | Secret name or ARN |
| `region`      |          | AWS region         |
| `profile`     |          | AWS profile name   |

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

### `set_secret`

Set a key within a JSON secret. **The value is never passed as a tool argument.** Instead, when called, the MCP server opens `/dev/tty` directly to prompt you on your terminal. The value is entered by the user and goes straight to AWS — it never passes through the MCP stdio protocol stream and never appears in the agent's context.

| Parameter     | Required | Description                                               |
| ------------- | -------- | --------------------------------------------------------- |
| `secret_name` | ✅       | Secret name or ARN                                        |
| `key`         | ✅       | Key to set within the JSON secret                         |
| `description` |          | Secret description (used only when creating a new secret) |
| `region`      |          | AWS region                                                |
| `profile`     |          | AWS profile name                                          |

**Why no `value` parameter?**

If the agent supplied a `value` parameter, the secret would need to appear in the agent's context in order to construct the tool call. Accepting only `secret_name` and `key` means the agent can trigger the operation without ever seeing the value. The MCP server then reads the value directly from the user's terminal.

**TTY prompting flow:**

```
AI calls:  set_secret(secret_name="my-app/prod", key="DATABASE_URL")
MCP server opens /dev/tty → user types value in terminal (echo disabled)
MCP server stores the value in AWS Secrets Manager
MCP server returns: { "success": true, "secret_name": "my-app/prod", "key": "DATABASE_URL" }
```

The agent sees the tool call parameters (`secret_name`, `key`) and the result (`success`, `arn`) — never the value.

**Example response:**

```json
{
  "success": true,
  "name": "my-app/prod",
  "arn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:my-app/prod",
  "key": "DATABASE_URL"
}
```

**Non-interactive environments:** If `/dev/tty` is unavailable (CI, containers without a controlling terminal), the tool returns a clear error rather than hanging. Use `get_command` instead in those cases.

---

### `get_command`

Returns a ready-to-run `env-secrets` CLI command string for the requested action. **No secrets or values are ever included.** This is the recommended approach when you do not want the agent to handle secret values directly.

| Parameter     | Required | Description                                                                    |
| ------------- | -------- | ------------------------------------------------------------------------------ |
| `action`      | ✅       | One of `get`, `set`, `list`, `describe`                                        |
| `secret_name` |          | Secret name (required for `get`, `set`, `describe`; used as prefix for `list`) |
| `key`         |          | Key name (used for `set` action)                                               |
| `region`      |          | AWS region flag value                                                          |
| `profile`     |          | AWS profile flag value                                                         |

**Example responses:**

```
# get
env-secrets aws -s my-app/prod --region us-east-1 -- <your-program>

# set (always uses --value-stdin so the value never appears in shell history)
printf 'your-value' | env-secrets aws secret append -n my-app/prod --key DATABASE_URL --value-stdin

# list
env-secrets aws secret list --prefix my-app/

# describe
env-secrets aws secret get -n my-app/prod
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

Restart Claude Code after changing the config. The tools `get_secret`, `list_secrets`, `describe_secret`, `set_secret`, and `get_command` will be available in the session.

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

- The server is **read-only except for `set_secret`**, which uses TTY prompting to accept values without them passing through the agent.
- `get_secret` returns secret values to the agent's context. Use `describe_secret` or `get_command` when you want the agent to stay uninformed of values.
- No HTTP or SSE transport is available — stdio only, so the server is not exposed as a network service.
- The server exits cleanly when stdin closes (host process terminated).
