<p align="center">
  <img src="gfx/mcp-w.svg" alt="MCP-Funnel" width="120" height="120" />
</p>

# MCP-Funnel

Multi-user MCP proxy that funnels multiple backend MCP servers into a single endpoint per user. Instead of exposing hundreds of tools directly, MCP-Funnel provides 3 meta-tools for lazy, search-based tool discovery — keeping LLM context usage minimal. 100% AI-generated code (agentic coding with Claude Code).

![License](https://img.shields.io/badge/license-GPL--3.0--only-blue)

## Architecture

```mermaid
graph LR
    C1[MCP Client<br>Claude Code] -->|Streamable HTTP<br>+ Bearer Token| F[MCP-Funnel]
    C2[MCP Client<br>Cursor] -->|Streamable HTTP<br>+ OAuth JWT| F

    F -->|HTTP| B1[Backend MCP Server 1]
    F -->|SSE| B2[Backend MCP Server 2]
    F -->|Stdio| B3[Backend MCP Server 3]
    F -->|HTTP + OAuth| B4[Backend MCP Server 4]

    style F fill:#4a90d9,color:#fff
```

**How it works:**
- Clients connect to MCP-Funnel via a single endpoint (`/mcp`)
- Each user has their own set of backend MCP servers, configured via the web dashboard
- Tools are discovered lazily through `mcp_discover_tools` (search) → `mcp_get_tool_schema` (inspect) → `mcp_call_tool` (execute)
- All MCP spec features (resources, prompts, notifications, sampling, elicitation) are proxied transparently

<img src="gfx/screenshot.png" alt="MCP-Funnel" width="1000" />

## Features

### MCP Proxy
- 3 meta-tools for lazy discovery: `mcp_discover_tools`, `mcp_get_tool_schema`, `mcp_call_tool`
- Fuzzy matching with relevance scoring (Levenshtein distance) — typos still find tools
- Supports Streamable HTTP, SSE, and Stdio transports to backends
- Per-server tool enable/disable control
- Automatic reconnection with exponential backoff

### MCP Spec 2025-11-25
- Full proxy transparency — tool/resource/prompt metadata (title, icons, annotations, outputSchema) preserved
- Capability negotiation (sampling, elicitation, roots)
- Bidirectional notification forwarding (progress, cancellation, list changes)
- Sampling & elicitation passthrough (backend to client)
- Resource templates, pagination, completions
- Experimental tasks support

### Authentication
- **Inbound** (clients to funnel): Legacy API keys, OAuth 2.1 (Authorization Code + PKCE, Client Credentials), or both
- **Outbound** (funnel to backends): Static tokens, Basic Auth, API keys, OAuth 2.1 with automatic token refresh
- Per-user API key isolation
- MCP-Protocol-Version validation, origin validation, WWW-Authenticate headers

### Administration
- Web dashboard with MCP server management, tool control, and user management
- Single-user mode (`--single-user`) for local use without authentication
- File-based storage (no database required)
- Docker support

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
```

Open `http://localhost:3000`, complete the admin setup, then add your MCP servers via the dashboard.

### Auto-create admin via environment

```bash
ADMIN_USER=admin ADMIN_PASS=your-password docker compose up --build
```

### Local (npm)

```bash
npm install
npm run build
npm start -- --port 8080 --data-dir ./my-data
```

## MCP Client Configuration

### API Key (default)

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

The API key is shown in the web dashboard under Settings.

### OAuth 2.1

MCP clients that support OAuth 2.1 can authenticate via the standard flow. MCP-Funnel exposes the required discovery endpoints:

| Endpoint | Description |
|---|---|
| `/.well-known/oauth-protected-resource` | Protected resource metadata (RFC 9728) |
| `/.well-known/oauth-authorization-server` | Authorization server metadata (RFC 8414) |
| `/oauth/register` | Dynamic client registration (RFC 7591) |
| `/oauth/authorize` | Authorization endpoint |
| `/oauth/token` | Token endpoint |

**Supported grant types:** `authorization_code` (with PKCE S256), `refresh_token`, `client_credentials`

**`AUTH_MODE`** controls which authentication methods are accepted:

| Mode | API Keys | OAuth JWT |
|---|---|---|
| `both` (default) | Yes | Yes |
| `oauth` | No | Yes |
| `legacy` | Yes | No |

#### Client Credentials (Machine-to-Machine)

For automated systems that don't have a user context:

1. Register a client: `POST /oauth/register` with `grant_types: ["client_credentials"]`
2. Request a token: `POST /oauth/token` with `grant_type=client_credentials&client_id=...&client_secret=...`
3. Use the token: `Authorization: Bearer <jwt>`

## Backend Authentication

When adding backend MCP servers, MCP-Funnel supports several authentication methods:

| Method | Description |
|---|---|
| None | No authentication |
| Bearer Token | Static `Authorization: Bearer <token>` header |
| Basic Auth | `Authorization: Basic <base64>` header |
| API Key | Custom header (e.g., `X-API-Key`) |
| URL Parameter | Token appended to URL |
| Custom Header | Arbitrary header name and value |
| **OAuth 2.1** | Full OAuth client with automatic token refresh |

### Backend OAuth 2.1

For backends that require OAuth 2.1, MCP-Funnel acts as an OAuth client:

```mermaid
sequenceDiagram
    participant U as Admin (Browser)
    participant F as MCP-Funnel
    participant B as Backend IdP

    U->>F: Click OAuth button on server
    U->>F: Enter backend URL
    F->>B: GET /.well-known/oauth-authorization-server
    B-->>F: Metadata (endpoints, scopes)
    F->>B: POST /oauth/register (dynamic registration)
    B-->>F: client_id, client_secret
    U->>F: Click "Authorize"
    F-->>U: Redirect to backend login
    U->>B: Login + consent
    B-->>F: Authorization code (callback)
    F->>B: POST /oauth/token (code + PKCE)
    B-->>F: access_token, refresh_token
    Note over F: Token persisted, auto-refreshed
```

1. Open the MCP Servers page in the web dashboard
2. Click the OAuth button on the server entry
3. Enter the backend's base URL — MCP-Funnel discovers the OAuth metadata automatically
4. If Dynamic Client Registration is available, the client is registered automatically — otherwise enter credentials manually
5. Click "Authorize" to complete the login flow
6. Tokens are persisted and refreshed automatically before each reconnection

## Configuration

### Core

| Setting | Env Var | Default | Description |
|---|---|---|---|
| Port | `PORT` | `3000` | HTTP server port |
| Data directory | `DATA_DIR` | `./data` | Persistent data storage |
| Single-user mode | `SINGLE_USER` | `false` | Run without authentication |
| Log level | `LOG_LEVEL` | `info` | Winston log level |

### Session

| Setting | Env Var | Default | Description |
|---|---|---|---|
| Session secret | `SESSION_SECRET` | (auto-generated) | Session cookie secret |
| Session max age | `SESSION_MAX_AGE` | `2592000000` (30d) | Session TTL in ms |

### Admin Bootstrap

| Setting | Env Var | Default | Description |
|---|---|---|---|
| Admin user | `ADMIN_USER` | (none) | Auto-create admin on first start |
| Admin pass | `ADMIN_PASS` | (none) | Admin password (min 8 chars) |

### OAuth 2.1

| Setting | Env Var | Default | Description |
|---|---|---|---|
| Auth mode | `AUTH_MODE` | `both` | `both`, `oauth`, or `legacy` |
| Issuer URL | `OAUTH_ISSUER` | (auto from `BASE_URL`) | JWT issuer claim |
| Token lifetime | `OAUTH_TOKEN_LIFETIME` | `3600` | Access token TTL in seconds |
| Refresh lifetime | `OAUTH_REFRESH_TOKEN_LIFETIME` | `86400` | Refresh token TTL in seconds |
| Base URL | `BASE_URL` | `http://localhost:{PORT}` | Public URL for OAuth metadata |

### Protocol

| Setting | Env Var | Default | Description |
|---|---|---|---|
| Allowed origins | `ALLOWED_ORIGINS` | (none) | Comma-separated allowed origins |
| Protocol versions | `MCP_PROTOCOL_VERSIONS` | `2025-11-25,2025-03-26` | Accepted MCP versions |

## CLI

```
Usage: mcp-funnel [options]

Options:
  -p, --port <number>    HTTP port (default: 3000)
  -d, --data-dir <path>  Data directory (default: ./data)
  --single-user          Run in single-user mode (no auth)
  -h, --help             Show help
  -V, --version          Show version
```

## Data Storage

All data is stored as JSON files in the configured data directory:

```
{dataDir}/
  auth.json                  Admin credentials, user accounts, API keys
  session-secret.txt         Auto-generated session secret
  stats.json                 Per-user request statistics
  sessions/                  File-based session store
  servers/{userId}.json      Per-user MCP server configurations
  oauth/
    clients.json             Registered OAuth clients
    jwk-private.json         RSA key pair for JWT signing
```

## Development

```bash
npm install
npm run dev      # Watch mode with auto-rebuild
npm run lint     # ESLint check
npm run lint:fix # ESLint auto-fix
npm test         # Run tests (140 tests)
```

## License

GPL-3.0-only
