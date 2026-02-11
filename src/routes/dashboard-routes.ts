/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { Router, Request, Response } from "express"
import { AuthManager } from "../mcp-funnel-auth.js"
import { StatsManager } from "../mcp-funnel-stats.js"
import { renderDashboardPage } from "../views/dashboard-view.js"
import logger from "../mcp-funnel-log.js"
import { getErrorMessage, getSessionUserId } from "../utils.js"

function createDashboardRoutes (authManager: AuthManager, statsManager: StatsManager): Router {
    const router = Router()

    /* GET /dashboard */
    router.get("/", (req: Request, res: Response) => {
        const userId = req.session.userId
        if (!userId) {
            res.redirect("/login")
            return
        }
        const role = req.session.role || "user"
        const username = req.session.username || ""

        const apiKey = authManager.getApiKeyForUser(userId)
        const mcpEndpoint = `${req.protocol}://${req.get("host") || "localhost"}/mcp`
        const stats = statsManager.getUserStats(userId)

        res.send(renderDashboardPage({ apiKey, role, username, mcpEndpoint, stats }))
    })

    /* POST /dashboard/api/regenerate-key */
    router.post("/api/regenerate-key", (req: Request, res: Response) => {
        try {
            const userId = getSessionUserId(req)

            const newKey = authManager.regenerateApiKey(userId)
            logger.info(`API key regenerated for user: ${userId}`)
            res.json({ success: true, apiKey: newKey })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`API key regeneration failed: ${msg}`)
            res.status(500).json({ error: msg })
        }
    })

    return router
}

export { createDashboardRoutes }
