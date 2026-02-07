// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import { Router, Request, Response } from "express"
import { UserProxyManager } from "../user-proxy-manager.js"
import { AuthManager } from "../mcp-funnel-auth.js"
import { StatsManager } from "../mcp-funnel-stats.js"
import { createApiKeyAuth } from "../middleware/api-key-auth.js"
import logger from "../mcp-funnel-log.js"

function createMcpProxyRoutes (userProxyManager: UserProxyManager, authManager: AuthManager, statsManager: StatsManager): Router {
    const router = Router()
    const { requireApiKey } = createApiKeyAuth(authManager, statsManager)

    async function handleMcpMessage (req: Request, res: Response): Promise<void> {
        try {
            const request = req.body as { jsonrpc?: string; id?: string | number | null; method?: string; [key: string]: unknown }

            if (!request.jsonrpc || request.jsonrpc !== "2.0") {
                res.status(400).json({
                    jsonrpc: "2.0",
                    id: request.id || null,
                    error: { code: -32600, message: "Invalid Request: must be JSON-RPC 2.0" }
                })
                return
            }

            if (!request.method) {
                res.status(400).json({
                    jsonrpc: "2.0",
                    id: request.id || null,
                    error: { code: -32600, message: "Invalid Request: method is required" }
                })
                return
            }

            const userId = req.apiKeyUser?.userId
            if (!userId) {
                res.status(401).json({
                    jsonrpc: "2.0",
                    id: request.id || null,
                    error: { code: -32000, message: "Unauthorized" }
                })
                return
            }

            logger.debug(`MCP request from ${req.apiKeyUser?.username}: ${request.method}`)

            const proxy = await userProxyManager.getProxy(userId)
            const response = await proxy.handleRequest(request as { jsonrpc: string; id?: string | number | null; method: string; params?: Record<string, unknown> })

            if (response === null) {
                res.status(202).end()
                return
            }

            res.json(response)
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`MCP request error: ${msg}`)
            res.status(500).json({
                jsonrpc: "2.0",
                id: (req.body as { id?: unknown })?.id || null,
                error: { code: -32000, message: msg }
            })
        }
    }

    /* POST /mcp — JSON-RPC (Streamable HTTP) — primary */
    router.post("/", requireApiKey, handleMcpMessage)

    /* GET /mcp/sse — SSE transport fallback */
    router.get("/sse", requireApiKey, (req: Request, res: Response) => {
        const userId = req.apiKeyUser?.userId
        if (!userId) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        logger.info(`MCP SSE connection established for user: ${userId}`)

        res.status(200)
        res.setHeader("Content-Type", "text/event-stream")
        res.setHeader("Cache-Control", "no-cache")
        res.setHeader("Connection", "keep-alive")
        res.setHeader("X-Accel-Buffering", "no")

        res.flushHeaders()

        const messageEndpoint = `${req.protocol}://${req.get("host")}/mcp`
        res.write(`event: endpoint\ndata: ${messageEndpoint}\n\n`)
        if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
            (res as unknown as { flush: () => void }).flush()
        }

        const keepAlive = setInterval(() => {
            res.write(": keepalive\n\n")
            if (typeof (res as unknown as { flush?: () => void }).flush === "function") {
                (res as unknown as { flush: () => void }).flush()
            }
        }, 30000)

        req.on("close", () => {
            clearInterval(keepAlive)
            logger.info(`MCP SSE connection closed for user: ${userId}`)
        })
    })

    /* GET /mcp/tools — List tools (convenience) */
    router.get("/tools", requireApiKey, async (req: Request, res: Response) => {
        try {
            const userId = req.apiKeyUser?.userId
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" })
                return
            }

            const proxy = await userProxyManager.getProxy(userId)
            const tools = proxy.getAllTools()

            res.json({
                success: true,
                count: tools.length,
                tools: tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema
                }))
            })
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`Failed to list MCP tools: ${msg}`)
            res.status(500).json({ error: "Failed to list tools" })
        }
    })

    /* GET /mcp/status — Connection status */
    router.get("/status", requireApiKey, async (req: Request, res: Response) => {
        try {
            const userId = req.apiKeyUser?.userId
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" })
                return
            }

            const proxy = await userProxyManager.getProxy(userId)
            const status = proxy.getStatus()
            const tools = proxy.getAllTools()

            res.json({
                success: true,
                totalTools: tools.length,
                servers: status
            })
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`Failed to get MCP status: ${msg}`)
            res.status(500).json({ error: "Failed to get status" })
        }
    })

    /* POST /mcp/refresh — Force reconnect all */
    router.post("/refresh", requireApiKey, async (req: Request, res: Response) => {
        try {
            const userId = req.apiKeyUser?.userId
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" })
                return
            }

            logger.info(`Refreshing MCP connections for user: ${userId}`)
            const proxy = await userProxyManager.getProxy(userId)
            await proxy.refresh()
            userProxyManager.updateStats(userId)

            const status = proxy.getStatus()
            const tools = proxy.getAllTools()

            res.json({
                success: true,
                message: "MCP connections refreshed",
                totalTools: tools.length,
                servers: status
            })
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`Failed to refresh MCP connections: ${msg}`)
            res.status(500).json({ error: "Failed to refresh connections" })
        }
    })

    return router
}

export { createMcpProxyRoutes }
