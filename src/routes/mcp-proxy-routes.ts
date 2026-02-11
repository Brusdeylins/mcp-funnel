/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { Router, Request, Response, NextFunction } from "express"
import type { IncomingMessage, ServerResponse } from "node:http"
import { UserProxyManager } from "../user-proxy-manager.js"
import { AuthManager } from "../mcp-funnel-auth.js"
import { StatsManager } from "../mcp-funnel-stats.js"
import { createApiKeyAuth } from "../middleware/api-key-auth.js"
import logger from "../mcp-funnel-log.js"
import { getErrorMessage } from "../utils.js"

function createMcpProxyRoutes (userProxyManager: UserProxyManager, authManager: AuthManager, statsManager: StatsManager, singleUser = false): Router {
    const router = Router()
    const { requireApiKey } = createApiKeyAuth(authManager, statsManager)

    function singleUserBypass (req: Request, _res: Response, next: NextFunction): void {
        req.apiKeyUser = { valid: true, userId: "local", username: "local" }
        next()
    }

    const authMiddleware = singleUser ? singleUserBypass : requireApiKey

    /* Delegate all MCP protocol requests to the SDK transport */
    async function handleMcpRequest (req: Request, res: Response): Promise<void> {
        try {
            const userId = req.apiKeyUser?.userId
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" })
                return
            }

            logger.debug(`MCP ${req.method} request from ${req.apiKeyUser?.username}`)

            const proxy = await userProxyManager.getProxy(userId)
            await proxy.handleInboundRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse)
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`MCP request error: ${msg}`)
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: "2.0",
                    id: null,
                    error: { code: -32000, message: "Internal server error" }
                })
            }
        }
    }

    /* POST /mcp — JSON-RPC (Streamable HTTP) — primary */
    router.post("/", authMiddleware, handleMcpRequest)

    /* GET /mcp — SSE stream for notifications (Streamable HTTP) */
    router.get("/", authMiddleware, handleMcpRequest)

    /* DELETE /mcp — session cleanup (Streamable HTTP) */
    router.delete("/", authMiddleware, handleMcpRequest)

    /* GET /mcp/tools — List tools (convenience) */
    router.get("/tools", authMiddleware, async (req: Request, res: Response) => {
        try {
            const userId = req.apiKeyUser?.userId
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" })
                return
            }

            const proxy = await userProxyManager.getProxy(userId)
            const tools = proxy.getExposedTools()

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
            const msg = getErrorMessage(error)
            logger.error(`Failed to list MCP tools: ${msg}`)
            res.status(500).json({ error: "Failed to list tools" })
        }
    })

    /* GET /mcp/status — Connection status */
    router.get("/status", authMiddleware, async (req: Request, res: Response) => {
        try {
            const userId = req.apiKeyUser?.userId
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" })
                return
            }

            const proxy = await userProxyManager.getProxy(userId)
            const status = proxy.getStatus()
            const tools = proxy.getExposedTools()

            res.json({
                success: true,
                totalTools: tools.length,
                servers: status
            })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`Failed to get MCP status: ${msg}`)
            res.status(500).json({ error: "Failed to get status" })
        }
    })

    /* POST /mcp/refresh — Force reconnect all */
    router.post("/refresh", authMiddleware, async (req: Request, res: Response) => {
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
            const tools = proxy.getExposedTools()

            res.json({
                success: true,
                message: "MCP connections refreshed",
                totalTools: tools.length,
                servers: status
            })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`Failed to refresh MCP connections: ${msg}`)
            res.status(500).json({ error: "Failed to refresh connections" })
        }
    })

    return router
}

export { createMcpProxyRoutes }
