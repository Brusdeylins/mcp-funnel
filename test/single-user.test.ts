// Integration tests for single-user mode

import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import fs from "fs"
import path from "path"
import os from "os"

import { createApp } from "../src/mcp-funnel-server.js"
import type { McpFunnelConfig } from "../src/mcp-funnel-config.js"

/* ── helpers ────────────────────────────────────────── */

function makeTmpDir (): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mcp-funnel-su-"))
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

/* MCP Accept header required by Streamable HTTP transport */
const MCP_ACCEPT = "application/json, text/event-stream"

/* ── single-user mode tests ─────────────────────────── */

describe("single-user mode", () => {
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
            sessionSecret: "test-secret-single-user",
            sessionMaxAge: 86400000,
            adminUser: "",
            adminPass: "",

            nodeEnv: "test",
            singleUser: true
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

    /* -- health check always works -------------------------------- */

    it("health endpoint returns ok", async () => {
        const res = await request(`${baseUrl}/health`)
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.status, "ok")
    })

    /* -- auth is bypassed ----------------------------------------- */

    it("/setup redirects to /dashboard", async () => {
        const res = await request(`${baseUrl}/setup`)
        assert.equal(res.status, 302)
        assert.ok(res.headers.location?.includes("/dashboard"))
    })

    it("/login redirects to /dashboard", async () => {
        const res = await request(`${baseUrl}/login`)
        assert.equal(res.status, 302)
        assert.ok(res.headers.location?.includes("/dashboard"))
    })

    it("/dashboard returns 200 without session cookie", async () => {
        const res = await request(`${baseUrl}/dashboard`)
        /* In single-user mode, requireAuth auto-sets the session, so we should get 200 */
        assert.equal(res.status, 200)
        assert.ok(res.body.includes("Dashboard") || res.body.includes("dashboard"))
    })

    it("/mcp-servers/manage returns 200 without login", async () => {
        const res = await request(`${baseUrl}/mcp-servers/manage`)
        assert.equal(res.status, 200)
        assert.ok(res.body.includes("MCP Servers") || res.body.includes("mcp"))
    })

    it("/users/manage is accessible (admin auto-granted)", async () => {
        const res = await request(`${baseUrl}/users/manage`)
        assert.equal(res.status, 200)
    })

    /* -- MCP endpoint works without Bearer token (via SDK transport) -- */

    it("POST /mcp works without Authorization header (initialize)", async () => {
        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Accept: MCP_ACCEPT }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.jsonrpc, "2.0")
        assert.equal(data.id, 1)
        assert.ok(data.result)
        assert.equal(data.result.serverInfo.name, "mcp-funnel")
    })

    it("POST /mcp ping works without auth", async () => {
        /* Initialize first to get session */
        const initRes = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Accept: MCP_ACCEPT }
        })
        assert.equal(initRes.status, 200)
        const sessionId = initRes.headers["mcp-session-id"] as string
        assert.ok(sessionId, "should return session ID")

        /* Send initialized notification */
        await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", method: "notifications/initialized" },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })

        /* Now ping */
        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 2, method: "ping" },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.id, 2)
        assert.ok(data.result !== undefined)
    })

    it("POST /mcp tools/list returns meta-tools without auth", async () => {
        /* Initialize first */
        const initRes = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Accept: MCP_ACCEPT }
        })
        const sessionId = initRes.headers["mcp-session-id"] as string

        await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", method: "notifications/initialized" },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })

        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 3, method: "tools/list" },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.ok(data.result)
        assert.ok(Array.isArray(data.result.tools))
        const toolNames = data.result.tools.map((t: { name: string }) => t.name)
        assert.ok(toolNames.includes("mcp_discover_tools"))
        assert.ok(toolNames.includes("mcp_get_tool_schema"))
        assert.ok(toolNames.includes("mcp_call_tool"))
    })

    it("GET /mcp/tools works without auth", async () => {
        const res = await request(`${baseUrl}/mcp/tools`)
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.success, true)
        assert.ok(data.count >= 3) /* meta-tools */
    })

    it("GET /mcp/status works without auth", async () => {
        const res = await request(`${baseUrl}/mcp/status`)
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.success, true)
    })

    /* -- MCP server list API works -------------------------------- */

    it("GET /mcp-servers/api/list returns empty list", async () => {
        /* Need a session cookie for this route — make a request through /dashboard first to establish session */
        const dashRes = await request(`${baseUrl}/dashboard`)
        const cookies = dashRes.headers["set-cookie"]
        const cookie = cookies ? (Array.isArray(cookies) ? cookies[0] : cookies).split(";")[0] : ""

        const res = await request(`${baseUrl}/mcp-servers/api/list`, {
            headers: cookie ? { Cookie: cookie } : {}
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.success, true)
        assert.ok(Array.isArray(data.servers))
    })

    /* -- SDK transport validation --------------------------------- */

    it("rejects requests without Accept header", async () => {
        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } }
            /* No Accept header */
        })
        assert.equal(res.status, 406)
    })

    it("notifications return 202", async () => {
        /* Initialize first */
        const initRes = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Accept: MCP_ACCEPT }
        })
        const sessionId = initRes.headers["mcp-session-id"] as string

        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", method: "notifications/initialized" },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })
        assert.equal(res.status, 202)
    })

    /* -- New capability tests ------------------------------------- */

    it("resources/subscribe returns success", async () => {
        const initRes = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Accept: MCP_ACCEPT }
        })
        const sessionId = initRes.headers["mcp-session-id"] as string

        await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", method: "notifications/initialized" },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })

        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 10, method: "resources/subscribe", params: { uri: "file:///test" } },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.jsonrpc, "2.0")
        assert.equal(data.id, 10)
        assert.ok(data.result !== undefined)
    })

    it("completion/complete returns empty completions when no backends", async () => {
        const initRes = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Accept: MCP_ACCEPT }
        })
        const sessionId = initRes.headers["mcp-session-id"] as string

        await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", method: "notifications/initialized" },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })

        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 11, method: "completion/complete", params: { ref: { type: "ref/prompt", name: "nonexistent" }, argument: { name: "arg", value: "val" } } },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.jsonrpc, "2.0")
        assert.equal(data.id, 11)
        assert.ok(data.result)
        assert.deepEqual(data.result.completion.values, [])
    })

    it("logging/setLevel accepts and returns success", async () => {
        const initRes = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Accept: MCP_ACCEPT }
        })
        const sessionId = initRes.headers["mcp-session-id"] as string

        await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", method: "notifications/initialized" },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })

        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 12, method: "logging/setLevel", params: { level: "debug" } },
            headers: { Accept: MCP_ACCEPT, "Mcp-Session-Id": sessionId }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.equal(data.jsonrpc, "2.0")
        assert.equal(data.id, 12)
        assert.ok(data.result !== undefined)
    })

    it("initialize reports listChanged: true", async () => {
        const res = await request(`${baseUrl}/mcp`, {
            method: "POST",
            body: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } },
            headers: { Accept: MCP_ACCEPT }
        })
        assert.equal(res.status, 200)
        const data = JSON.parse(res.body)
        assert.ok(data.result.capabilities.tools.listChanged === true)
        assert.ok(data.result.capabilities.prompts.listChanged === true)
        assert.ok(data.result.capabilities.resources.listChanged === true)
    })
})
