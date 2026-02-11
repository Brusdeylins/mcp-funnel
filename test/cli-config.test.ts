// Tests for CLI config, McpServerManager types, and stdio validation

import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import fs from "fs"
import path from "path"
import os from "os"

import { loadConfig } from "../src/mcp-funnel-config.js"
import { McpServerManager, trimConfigUrl, isUrlConfig, isStdioConfig } from "../src/mcp-server-manager.js"
import type { UrlServerConfig, StdioServerConfig, ServerConfig } from "../src/mcp-server-manager.js"

/* ── helpers ────────────────────────────────────────── */

function makeTmpDir (): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "mcp-funnel-test-"))
}

function cleanDir (dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true })
}

/* ── loadConfig ─────────────────────────────────────── */

describe("loadConfig", () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = makeTmpDir()
        /* Clear env vars that loadConfig reads */
        delete process.env["PORT"]
        delete process.env["DATA_DIR"]
        delete process.env["SINGLE_USER"]
        delete process.env["SESSION_SECRET"]
        delete process.env["ADMIN_USER"]
        delete process.env["ADMIN_PASS"]
    })

    afterEach(() => {
        cleanDir(tmpDir)
    })

    it("returns singleUser=false by default", () => {
        const config = loadConfig(undefined, tmpDir)
        assert.equal(config.singleUser, false)
    })

    it("returns singleUser=true from CLI flag", () => {
        const config = loadConfig(undefined, tmpDir, true)
        assert.equal(config.singleUser, true)
    })

    it("returns singleUser=true from SINGLE_USER env var", () => {
        process.env["SINGLE_USER"] = "true"
        const config = loadConfig(undefined, tmpDir)
        assert.equal(config.singleUser, true)
    })

    it("SINGLE_USER=false keeps singleUser false", () => {
        process.env["SINGLE_USER"] = "false"
        const config = loadConfig(undefined, tmpDir)
        assert.equal(config.singleUser, false)
    })

    it("CLI flag takes precedence for singleUser", () => {
        process.env["SINGLE_USER"] = "false"
        const config = loadConfig(undefined, tmpDir, true)
        assert.equal(config.singleUser, true)
    })

    it("uses CLI port over default", () => {
        const config = loadConfig(4567, tmpDir)
        assert.equal(config.port, 4567)
    })

    it("uses PORT env var when no CLI port", () => {
        process.env["PORT"] = "9999"
        const config = loadConfig(undefined, tmpDir)
        assert.equal(config.port, 9999)
    })

    it("generates a session secret file", () => {
        const config = loadConfig(undefined, tmpDir)
        assert.ok(config.sessionSecret)
        const secretFile = path.join(tmpDir, "session-secret.txt")
        assert.ok(fs.existsSync(secretFile))
        const stored = fs.readFileSync(secretFile, "utf8").trim()
        assert.equal(stored, config.sessionSecret)
    })

    it("reuses existing session secret file", () => {
        fs.writeFileSync(path.join(tmpDir, "session-secret.txt"), "my-fixed-secret", "utf8")
        const config = loadConfig(undefined, tmpDir)
        assert.equal(config.sessionSecret, "my-fixed-secret")
    })
})

/* ── type guards ────────────────────────────────────── */

describe("type guards", () => {
    it("isUrlConfig returns true for UrlServerConfig", () => {
        const config: ServerConfig = { url: "http://localhost:3000" }
        assert.equal(isUrlConfig(config), true)
        assert.equal(isStdioConfig(config), false)
    })

    it("isStdioConfig returns true for StdioServerConfig", () => {
        const config: ServerConfig = { command: "npx", args: ["-y", "some-mcp"] }
        assert.equal(isStdioConfig(config), true)
        assert.equal(isUrlConfig(config), false)
    })
})

/* ── trimConfigUrl ──────────────────────────────────── */

describe("trimConfigUrl", () => {
    it("trims trailing slashes from url", () => {
        const result = trimConfigUrl({ url: "http://example.com/mcp///" })
        assert.equal(result.url, "http://example.com/mcp")
    })

    it("trims whitespace from url", () => {
        const result = trimConfigUrl({ url: "  http://example.com  " })
        assert.equal(result.url, "http://example.com")
    })

    it("returns config unchanged if no url property", () => {
        const config = { command: "npx" } as { command: string; url?: string }
        const result = trimConfigUrl(config)
        assert.deepEqual(result, config)
    })
})

/* ── McpServerManager ───────────────────────────────── */

describe("McpServerManager", () => {
    let tmpDir: string
    let mgr: McpServerManager

    beforeEach(() => {
        tmpDir = makeTmpDir()
        mgr = new McpServerManager(tmpDir, "test-user")
    })

    afterEach(() => {
        cleanDir(tmpDir)
    })

    /* -- basic CRUD ------------------------------------------------ */

    it("starts with no servers", () => {
        assert.deepEqual(mgr.getServers(), [])
    })

    it("adds an HTTP server", () => {
        const s = mgr.addServer({
            name: "test-http",
            type: "http",
            config: { url: "http://localhost:8080/mcp" }
        })
        assert.equal(s.name, "test-http")
        assert.equal(s.type, "http")
        assert.equal(s.enabled, true)
        assert.equal((s.config as UrlServerConfig).url, "http://localhost:8080/mcp")
    })

    it("adds an SSE server", () => {
        const s = mgr.addServer({
            name: "test-sse",
            type: "sse",
            config: { url: "http://localhost:9090/sse" }
        })
        assert.equal(s.type, "sse")
    })

    /* -- stdio servers -------------------------------------------- */

    it("adds a stdio server", () => {
        const s = mgr.addServer({
            name: "local-mcp",
            type: "stdio",
            config: { command: "npx", args: ["-y", "@anthropic-ai/mcp-server-memory"] }
        })
        assert.equal(s.name, "local-mcp")
        assert.equal(s.type, "stdio")
        assert.equal(s.enabled, true)
        const cfg = s.config as StdioServerConfig
        assert.equal(cfg.command, "npx")
        assert.deepEqual(cfg.args, ["-y", "@anthropic-ai/mcp-server-memory"])
    })

    it("adds a stdio server with env and cwd", () => {
        const s = mgr.addServer({
            name: "env-mcp",
            type: "stdio",
            config: { command: "/usr/bin/my-mcp", env: { FOO: "bar" }, cwd: "/tmp" }
        })
        const cfg = s.config as StdioServerConfig
        assert.deepEqual(cfg.env, { FOO: "bar" })
        assert.equal(cfg.cwd, "/tmp")
    })

    it("rejects stdio without command", () => {
        assert.throws(() => {
            mgr.addServer({
                name: "bad-stdio",
                type: "stdio",
                config: { command: "" }
            })
        }, /command/i)
    })

    /* -- url-based validation ------------------------------------- */

    it("rejects http without url", () => {
        assert.throws(() => {
            mgr.addServer({
                name: "bad-http",
                type: "http",
                /* Force empty url via cast to test validation */
                config: { url: "" } as UrlServerConfig
            })
        }, /url/i)
    })

    it("rejects invalid type", () => {
        assert.throws(() => {
            mgr.addServer({
                name: "bad-type",
                type: "websocket" as "http",
                config: { url: "http://localhost" }
            })
        }, /type must be one of/)
    })

    /* -- URL trimming for url-based, not for stdio ---------------- */

    it("trims trailing slashes on http server url", () => {
        const s = mgr.addServer({
            name: "trim-test",
            type: "http",
            config: { url: "http://localhost:8080/mcp///" }
        })
        assert.equal((s.config as UrlServerConfig).url, "http://localhost:8080/mcp")
    })

    it("does NOT mutate stdio config", () => {
        const s = mgr.addServer({
            name: "stdio-no-trim",
            type: "stdio",
            config: { command: "npx", args: ["-y", "test"] }
        })
        const cfg = s.config as StdioServerConfig
        assert.equal(cfg.command, "npx")
        assert.deepEqual(cfg.args, ["-y", "test"])
    })

    /* -- toggle, update, delete ----------------------------------- */

    it("toggles server enabled state", () => {
        const s = mgr.addServer({ name: "toggle-me", type: "stdio", config: { command: "echo" } })
        assert.equal(s.enabled, true)
        const toggled = mgr.toggleServer(s.id)
        assert.equal(toggled.enabled, false)
        const toggled2 = mgr.toggleServer(s.id)
        assert.equal(toggled2.enabled, true)
    })

    it("updates server name", () => {
        const s = mgr.addServer({ name: "old-name", type: "stdio", config: { command: "echo" } })
        const updated = mgr.updateServer(s.id, { name: "new-name" })
        assert.equal(updated.name, "new-name")
    })

    it("deletes a server", () => {
        const s = mgr.addServer({ name: "delete-me", type: "stdio", config: { command: "echo" } })
        assert.equal(mgr.getServers().length, 1)
        mgr.deleteServer(s.id)
        assert.equal(mgr.getServers().length, 0)
    })

    it("persists servers across instances", () => {
        mgr.addServer({ name: "persist-test", type: "stdio", config: { command: "node" } })
        const mgr2 = new McpServerManager(tmpDir, "test-user")
        assert.equal(mgr2.getServers().length, 1)
        assert.equal(mgr2.getServers()[0].name, "persist-test")
    })

    /* -- disabled tools ------------------------------------------- */

    it("manages disabled tools", () => {
        const s = mgr.addServer({ name: "tools-test", type: "stdio", config: { command: "echo" } })
        assert.deepEqual(mgr.getDisabledTools(s.id), [])
        mgr.updateDisabledTools(s.id, ["tool_a", "tool_b"])
        assert.deepEqual(mgr.getDisabledTools(s.id), ["tool_a", "tool_b"])
    })

    /* -- connection status ---------------------------------------- */

    it("tracks connection status", () => {
        const s = mgr.addServer({ name: "status-test", type: "stdio", config: { command: "echo" } })
        mgr.updateConnectionStatus(s.id, true)
        const server = mgr.getServer(s.id)!
        assert.ok(server.lastConnected)
        assert.equal(server.lastError, null)

        mgr.updateConnectionStatus(s.id, false, "timeout")
        const server2 = mgr.getServer(s.id)!
        assert.equal(server2.lastError, "timeout")
    })
})
