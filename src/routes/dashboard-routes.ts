// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import { Router, Request, Response } from "express"
import { AuthManager } from "../mcp-funnel-auth"
import { McpFunnelConfig } from "../mcp-funnel-config"
import { renderDashboardPage } from "../views/dashboard-view"
import logger from "../mcp-funnel-log"

function createDashboardRoutes (authManager: AuthManager, _config: McpFunnelConfig): Router {
    const router = Router()

    // GET /dashboard
    router.get("/", (req: Request, res: Response) => {
        const userId = req.session.userId || "admin"
        const role = req.session.role || "admin"
        const username = req.session.username || "admin"

        const apiKey = authManager.getApiKeyForUser(userId)
        const mcpEndpoint = `${req.protocol}://${req.get("host") || "localhost"}/api/mcp`

        res.send(renderDashboardPage({ apiKey, role, username, mcpEndpoint }))
    })

    // POST /dashboard/api/regenerate-key
    router.post("/api/regenerate-key", (req: Request, res: Response) => {
        try {
            const userId = req.session.userId || "admin"

            const newKey = authManager.regenerateApiKey(userId)
            logger.info(`API key regenerated for user: ${userId}`)
            res.json({ success: true, apiKey: newKey })
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`API key regeneration failed: ${msg}`)
            res.status(500).json({ error: msg })
        }
    })

    return router
}

export { createDashboardRoutes }
