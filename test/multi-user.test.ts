// Integration tests for multi-user mode (default auth-required mode)

import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import fs from "fs"
import path from "path"
import os from "os"

import { createApp } from "../src/mcp-funnel-server.js"
import { AuthManager } from "../src/mcp-funnel-auth.js"
import type { McpFunnelConfig } from "../src/mcp-funnel-config.js"

/* ── helpers ────────────────────────────────────────── */

function makeTmpDir (): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mcp-funnel-mu-"))
}

function request (url: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url)
        const payload = opts.body ? JSON.stringify(opts.body) : undefined
        const reqHeaders: Record<string, string> = { ...opts.headers }
        if (payload) {
            reqHeaders["Content-Type"] = "application/json"
            reqHeaders["Content-Length"] = Buffer.byteLength(payload).toString()
        }
        const req = http.request({
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname + parsed.search,
            method: opts.method || "GET",
            headers: reqHeaders
        }, (res) => {
            let data = ""
            res.on("data", (chunk) => { data += chunk })
            res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body: data }))
        })
        req.on("error", reject)
        if (payload) req.write(payload)
        req.end()
    })
}

/* helper: extract set-cookie header value */
function extractCookie (res: { headers: http.IncomingHttpHeaders }): string {
    const cookies = res.headers["set-cookie"]
    if (!cookies) return ""
    const first = Array.isArray(cookies) ? cookies[0] : cookies
    return first.split(";")[0]
}

/* MCP Accept header required by Streamable HTTP transport */
const MCP_ACCEPT = "application/json, text/event-stream"

/* ── multi-user mode: before setup ──────────────────── */

describe("multi-user mode — before admin setup", () => {
    let tmpDir: string
    let server: http.Server
    let baseUrl: string
    let statsManager: ReturnType<typeof createApp>["statsManager"]
    let userProxyManager: ReturnType<typeof createApp>["userProxyManager"]

    before(async () => {
        tmpDir = makeTmpDir()
        const config: McpFunnelConfig = {
            port: 0,
            dataDir: tmpDir,
            sessionSecret: "test-secret-multi-user-pre",
            sessionMaxAge: 86400000,
            adminUser: "",
            adminPass: "",

            nodeEnv: "test",
            singleUser: false
        }
        const result = createApp(config)
        statsManager = result.statsManager
        userProxyManager = result.userProxyManager

        await new Promise<void>((resolve) => {
            server = result.app.listen(0, "127.0.0.1", () => {
                const addr = server.address() as { port: number }
                baseUrl = `http://127.0.0.1:${addr.port}`
                resolve()
            })
        })
    })

    after(async () => {
        statsManager.flush()
        await userProxyManager.shutdown()
        await new Promise<void>((resolve) => {
            server.close(() => resolve())
        })
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it("health endpoint works without auth", async () => {
        const res = await request(`${baseUrl}/health`)
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.status, "ok")
    })

    it("/dashboard redirects to /setup when no admin exists", async () => {
        const res = await request(`${baseUrl}/dashboard`)
        assert.equal(res.status, 302)
        assert.ok(res.headers.location?.includes("/setup"))
    })

    it("/ redirects to /setup when no admin exists", async () => {
        const res = await request(`${baseUrl}/`)
        assert.equal(res.status, 302)
        /* checkSetup middleware intercepts and redirects to /setup */
        assert.ok(res.headers.location?.includes("/setup"))
    })

    it("/setup returns the setup page", async () => {
        const res = await request(`${baseUrl}/setup`)
        assert.equal(res.status, 200)
        assert.ok(res.body.includes("Setup") || res.body.includes("setup"))
    })

    it("POST /setup creates admin account", async () => {
        const res = await request(`${baseUrl}/setup`, {
            method: "POST",
            body: { username: "admin", password: "testpass1234" }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.success, true)
    })

    it("POST /setup rejects after admin already created", async () => {
        const res = await request(`${baseUrl}/setup`, {
            method: "POST",
            body: { username: "admin2", password: "testpass1234" }
        })
        assert.equal(res.status, 400)
        const data = JSON.parse(res.body)
        assert.ok(data.error?.includes("already"))
    })
})

/* ── multi-user mode: with admin set up ─────────────── */

describe("multi-user mode — auth required", () => {
    let tmpDir: string
    let server: http.Server
    let baseUrl: string
    let apiKey: string
    let statsManager: ReturnType<typeof createApp>["statsManager"]
    let userProxyManager: ReturnType<typeof createApp>["userProxyManager"]

    before(async () => {
        tmpDir = makeTmpDir()

        /* Pre-create admin so tests can exercise the login & API key flow */
        const authManager = new AuthManager(tmpDir)
        await authManager.setupAdmin("testadmin", "testpass1234")
        apiKey = authManager.getApiKeyForUser("admin")

        const config: McpFunnelConfig = {
            port: 0,
            dataDir: tmpDir,
            sessionSecret: "test-secret-multi-user",
            sessionMaxAge: 86400000,
            adminUser: "",
            adminPass: "",

            nodeEnv: "test",
            singleUser: false
        }
        const result = createApp(config)
        statsManager = result.statsManager
        userProxyManager = result.userProxyManager

        await new Promise<void>((resolve) => {
            server = result.app.listen(0, "127.0.0.1", () => {
                const addr = server.address() as { port: number }
                baseUrl = `http://127.0.0.1:${addr.port}`
                resolve()
            })
        })
    })

    after(async () => {
        statsManager.flush()
        await userProxyManager.shutdown()
        await new Promise<void>((resolve) => {
            server.close(() => resolve())
        })
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    /* -- unauthenticated access is denied ------------------------- */

    it("/dashboard redirects to /login when not authenticated", async () => {
        const res = await request(`${baseUrl}/dashboard`)
        assert.equal(res.status, 302)
        assert.ok(res.headers.location?.includes("/login"))
    })

    it("/mcp-servers/manage redirects to /login", async () => {
        const res = await request(`${baseUrl}/mcp-servers/manage`)
        assert.equal(res.status, 302)
        assert.ok(res.headers.location?.includes("/login"))
    })

    it("/settings redirects to /login", async () => {
        const res = await request(`${baseUrl}/settings`)
        assert.equal(res.status, 302)
        assert.ok(res.headers.location?.includes("/login"))
    })

    /* -- MCP endpoint requires API key ----------------------------- */

    it("POST /mcp rejects without Authorization header", async () => {
        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "ping" },
            headers: { Accept: MCP_ACCEPT }
        })
        assert.equal(res.status, 401)
        const data = JSON.parse(res.body)
        assert.ok(data.error?.includes("Authorization") || data.message?.includes("Authorization"))
    })

    it("POST /mcp rejects with invalid API key", async () => {
        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "ping" },
            headers: { Authorization: "Bearer mcp_invalidkey000000000000000000000000000000000000", Accept: MCP_ACCEPT }
        })
        assert.equal(res.status, 401)
    })

    it("POST /mcp works with valid API key (initialize)", async () => {
        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Authorization: `Bearer ${apiKey}`, Accept: MCP_ACCEPT }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.jsonrpc, "2.0")
        assert.ok(data.result)
        assert.equal(data.result.serverInfo.name, "mcp-funnel")
    })

    it("POST /mcp ping works with valid API key", async () => {
        /* Initialize first */
        const initRes = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Authorization: `Bearer ${apiKey}`, Accept: MCP_ACCEPT }
        })
        const sessionId = initRes.headers["mcp-session-id"] as string

        await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", method: "notifications/initialized" },
            headers: { Authorization: `Bearer ${apiKey}`, Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })

        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 2, method: "ping" },
            headers: { Authorization: `Bearer ${apiKey}`, Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.id, 2)
    })

    it("POST /mcp tools/list works with valid API key", async () => {
        /* Initialize first */
        const initRes = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Authorization: `Bearer ${apiKey}`, Accept: MCP_ACCEPT }
        })
        const sessionId = initRes.headers["mcp-session-id"] as string

        await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", method: "notifications/initialized" },
            headers: { Authorization: `Bearer ${apiKey}`, Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })

        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 3, method: "tools/list" },
            headers: { Authorization: `Bearer ${apiKey}`, Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.ok(data.result)
        assert.ok(Array.isArray(data.result.tools))
        const toolNames = data.result.tools.map((t: { name: string }) => t.name)
        assert.ok(toolNames.includes("mcp_discover_tools"))
    })

    it("GET /mcp/tools rejects without API key", async () => {
        const res = await request(`${baseUrl}/mcp/tools`)
        assert.equal(res.status, 401)
    })

    it("GET /mcp/tools works with API key", async () => {
        const res = await request(`${baseUrl}/mcp/tools`, {
            headers: { Authorization: `Bearer ${apiKey}` }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.success, true)
    })

    it("GET /mcp/status rejects without API key", async () => {
        const res = await request(`${baseUrl}/mcp/status`)
        assert.equal(res.status, 401)
    })

    it("GET /mcp/status works with API key", async () => {
        const res = await request(`${baseUrl}/mcp/status`, {
            headers: { Authorization: `Bearer ${apiKey}` }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.success, true)
    })

    /* -- login flow ----------------------------------------------- */

    it("POST /login rejects invalid credentials", async () => {
        const res = await request(`${baseUrl}/login`, {
            method: "POST",
            body: { username: "testadmin", password: "wrongpassword" }
        })
        assert.equal(res.status, 401)
    })

    it("POST /login accepts valid credentials", async () => {
        const res = await request(`${baseUrl}/login`, {
            method: "POST",
            body: { username: "testadmin", password: "testpass1234" }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.success, true)
    })

    it("authenticated session can access /dashboard", async () => {
        /* Login first */
        const loginRes = await request(`${baseUrl}/login`, {
            method: "POST",
            body: { username: "testadmin", password: "testpass1234" }
        })
        assert.equal(loginRes.status, 200)

        const cookie = extractCookie(loginRes)
        assert.ok(cookie, "should receive session cookie")

        /* Access dashboard with cookie */
        const dashRes = await request(`${baseUrl}/dashboard`, {
            headers: { Cookie: cookie }
        })
        assert.equal(dashRes.status, 200)
        assert.ok(dashRes.body.includes("Dashboard") || dashRes.body.includes("dashboard"))
    })

    it("authenticated session can access /mcp-servers/manage", async () => {
        const loginRes = await request(`${baseUrl}/login`, {
            method: "POST",
            body: { username: "testadmin", password: "testpass1234" }
        })
        const cookie = extractCookie(loginRes)

        const res = await request(`${baseUrl}/mcp-servers/manage`, {
            headers: { Cookie: cookie }
        })
        assert.equal(res.status, 200)
    })

    it("authenticated session can list MCP servers", async () => {
        const loginRes = await request(`${baseUrl}/login`, {
            method: "POST",
            body: { username: "testadmin", password: "testpass1234" }
        })
        const cookie = extractCookie(loginRes)

        const res = await request(`${baseUrl}/mcp-servers/api/list`, {
            headers: { Cookie: cookie }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.success, true)
        assert.ok(Array.isArray(data.servers))
    })

    /* -- /setup is not accessible after admin created -------------- */

    it("/setup redirects to /login when admin already exists", async () => {
        const res = await request(`${baseUrl}/setup`)
        assert.equal(res.status, 302)
        assert.ok(res.headers.location?.includes("/login"))
    })

    /* -- Authorization format validation -------------------------- */

    it("POST /mcp rejects non-Bearer auth format", async () => {
        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "ping" },
            headers: { Authorization: `Basic ${Buffer.from("user:pass").toString("base64")}`, Accept: MCP_ACCEPT }
        })
        assert.equal(res.status, 401)
        const data = JSON.parse(res.body)
        assert.ok(data.error?.includes("Bearer") || data.message?.includes("Bearer"))
    })
})
