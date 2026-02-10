<p align="center">
  <img src="gfx/mcp-w.svg" alt="MCP-Funnel" width="120" height="120" />
</p>

# MCP-Funnel

Multi-User MCP (Model Context Protocol) server management tool. Each user manages their own MCP server configurations and gets a personal API key. MCP-Funnel funnels multiple MCP servers into a single endpoint per user, reducing LLM context usage via 3 meta-tools (`mcp_discover_tools`, `mcp_get_tool_schema`, `mcp_call_tool`). 100% AI-generated code (vibe-coding with Claude).

![License](https://img.shields.io/badge/license-GPL--3.0--only-blue)

<img src="gfx/screenshot.png" alt="MCP-Funnel" width="1000"  />

## Features

**MCP Proxy**
- Funnels multiple backend MCP servers into a single endpoint per user
- 3 meta-tools for lazy tool discovery: `mcp_discover_tools`, `mcp_get_tool_schema`, `mcp_call_tool`
- Supports SSE and Streamable HTTP transports to backend servers
- Exposes both JSON-RPC (Streamable HTTP) and SSE transport for MCP clients
- Per-server tool enable/disable control
- Automatic reconnection with exponential backoff

**User Isolation**
- Per-user MCP server registrations (each user has their own server config file)
- Per-user API keys (Bearer token authentication)
- Complete isolation — users cannot see or access each other's MCP servers or tools

**Administration**
- Admin setup with secure password hashing (bcrypt)
- Multi-user support with per-user API keys
- Web dashboard with API key management and MCP server status
- User management (admin only)
- Dark/light theme toggle

**Infrastructure**
- File-based storage (no database required)
- Docker support
- CLI with configurable port and data directory
- Security headers via Helmet (HSTS, CSP, etc.)
- Request statistics tracking per user

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

Open `http://localhost:3000` and complete the initial setup.

### Auto-create admin via environment:

```bash
ADMIN_USER=admin ADMIN_PASS=your-password docker compose up --build
```

### Local (npm)

```bash
npm install
npm run build
npm start
```

Or with options:

```bash
node dst/mcp-funnel.js --port 8080 --data-dir ./my-data
```

## MCP Client Configuration

Configure your MCP client (e.g. Claude Code, Cursor) to connect to MCP-Funnel:

```json
{
  "mcpServers": {
    "mcp-funnel": {
      "type": "streamable-http",
      "url": "https://your-host/mcp",
      "headers": {
        "Authorization": "Bearer mcp_your-api-key-here"
      }
    }
  }
}
```

The API key can be found in the web dashboard under Settings.

## Configuration

| Setting | Env Var | Default | Description |
|---------|---------|---------|-------------|
| Port | `PORT` | `3000` | HTTP server port |
| Data dir | `DATA_DIR` | `./data` | Data storage directory |
| Session secret | `SESSION_SECRET` | (auto-generated) | Session cookie secret |
| Session max age | `SESSION_MAX_AGE` | `2592000000` (30d) | Session TTL in ms |
| Admin user | `ADMIN_USER` | (none) | Auto-create admin username |
| Admin pass | `ADMIN_PASS` | (none) | Auto-create admin password |
| Log level | `LOG_LEVEL` | `info` | Winston log level |

The session secret is auto-generated on first start and persisted in `{dataDir}/session-secret.txt` if `SESSION_SECRET` is not set.

## CLI

```
Usage: mcp-funnel [options]

Options:
  -p, --port <number>    HTTP port (default: 3000)
  -d, --data-dir <path>  Data directory (default: ./data)
  -h, --help             Show help
  -V, --version          Show version
```

## Data Storage

All data is stored as JSON files in the configured data directory:

- `auth.json` — Admin credentials, user accounts, API keys
- `sessions/` — File-based session store
- `session-secret.txt` — Auto-generated session secret
- `stats.json` — Per-user request statistics
- `servers/{userId}.json` — Per-user MCP server configurations

## Development

```bash
npm install
npm run dev     # Watch mode with auto-rebuild
npm run lint    # ESLint check
npm run lint:fix # ESLint auto-fix
```

## License

GPL-3.0-only
