# Changelog

## 1.1.2 (2026-02-15)

### Bug Fix
- Extend `isSessionError()` to recognize HTTP transport failures (404, 502, ECONNREFUSED, ECONNRESET, ENOTFOUND, fetch errors) as reconnectable errors
- Previously, when a backend MCP server was restarted behind a reverse proxy, the funnel would not attempt reconnection because the HTTP error didn't match session-related patterns
- Tool calls now automatically trigger `reconnectServer()` on transport-level failures instead of propagating the raw error

## 1.1.1 (2026-02-14)

### Bug Fix
- Fix stale session recovery after mcp-funnel restart — ephemeral fallback for requests with expired session IDs

## 1.1.0 (2026-02-10)

### MCP Protocol
- Migrate inbound MCP handling from manual JSON-RPC to SDK `Server` + `StreamableHTTPServerTransport`
- Add `listChanged: true` — MCP clients are notified when servers are added, removed, or toggled via the web UI
- Add multi-session support with per-user SDK server instances and automatic stale session cleanup
- Add `resources/subscribe` and `resources/unsubscribe` support
- Add `completion/complete` support (forwarded to backend servers)
- Add `logging/setLevel` support with severity-based filtering (RFC 5424)
- Forward backend server notifications (resource updates, log messages) to connected MCP clients
- Introduce meta-tools (`mcp_discover_tools`, `mcp_get_tool_schema`, `mcp_call_tool`) — MCP clients discover and invoke backend tools through a search-based funnel instead of receiving the full tool list
- Add relevance scoring to `mcp_discover_tools` — results are ranked by match type (exact name, word boundary, substring, server name) instead of returned in insertion order
- Add fuzzy matching (Levenshtein distance) — typos like "serch" still find "search" tools
- Add dynamic tool count in `mcp_discover_tools` description so LLMs know how many tools are searchable
- MCP clients are notified of tool count changes via `listChanged` when servers or tools are toggled

### Features
- Add single-user mode (`--single-user` / `SINGLE_USER=true`) for local use without authentication

### UI
- Unify button styles across all pages to outline variants for visual consistency
- Change action buttons in MCP servers table to compact icon-only buttons with tooltips
- Display version number dynamically in sidebar from central `VERSION` constant

### Security
- Add rate limiting on `/login` and `/setup` POST endpoints via `express-rate-limit`
- Fix `escapeHtml` to escape single quotes (XSS hardening)
- Set file permissions `0o600` on `auth.json` and `session-secret.txt`

### Performance
- Add in-memory caching for `AuthManager` and `McpServerManager` to avoid disk reads on every request

### Code Quality
- Extract shared utilities: `getErrorMessage()`, `getSessionUserId()`, `toUserInfo()`, `getEnabledTools()`
- Add central `VERSION` constant in `utils.ts` — replaces 5 hardcoded version strings across the codebase
- Add unit tests for scoring, fuzzy matching, and meta-tools (`test/mcp-meta-tools.test.ts`)
- Standardize copyright headers to `/* */` block comments across all source files
- Add blank lines before inline comments for readability

## 1.0.0 (2026-02-06)

- Initial release
- Admin setup and login with bcrypt password hashing
- Multi-user support with per-user API keys
- Dashboard with API key display, copy, and regeneration
- User management (admin only): create, edit, enable/disable, delete
- Settings page with password change
- MCP server management placeholder
- Tabler UI with dark/light theme toggle
- File-based data storage (auth.json, session files)
- Docker support with multi-stage build
- CLI with --port and --data-dir options
- Session secret auto-generation and persistence
- Environment variable and CLI configuration
