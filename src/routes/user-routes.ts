/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { Router, Request, Response } from "express"
import { UserManager } from "../mcp-funnel-users.js"
import { StatsManager } from "../mcp-funnel-stats.js"
import { renderUsersPage } from "../views/users-view.js"
import logger from "../mcp-funnel-log.js"
import { getErrorMessage } from "../utils.js"

function createUserRoutes (userManager: UserManager, statsManager: StatsManager): Router {
    const router = Router()

    /* GET /users/manage */
    router.get("/manage", (req: Request, res: Response) => {
        const username = req.session.username || ""
        res.send(renderUsersPage(username))
    })

    /* GET /users/api/list */
    router.get("/api/list", (_req: Request, res: Response) => {
        const users = userManager.listUsers()
        const counts = statsManager.getAllRequestCounts()
        const enriched = users.map((u) => ({
            ...u,
            requestCount: counts[u.id] || 0
        }))
        res.json(enriched)
    })

    /* POST /users/api/create */
    router.post("/api/create", async (req: Request, res: Response) => {
        try {
            const { username, password } = req.body as { username: string, password: string }
            const user = await userManager.createUser({ username, password })
            res.json(user)
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`User creation failed: ${msg}`)
            res.status(400).json({ error: msg })
        }
    })

    /* PUT /users/api/:id */
    router.put("/api/:id", async (req: Request, res: Response) => {
        try {
            const { password, enabled } = req.body as { password?: string, enabled?: boolean }
            const id = req.params["id"] as string
            const user = await userManager.updateUser(id, { password, enabled })
            res.json(user)
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`User update failed: ${msg}`)
            res.status(400).json({ error: msg })
        }
    })

    /* DELETE /users/api/:id */
    router.delete("/api/:id", (req: Request, res: Response) => {
        try {
            const id = req.params["id"] as string
            userManager.deleteUser(id)
            res.json({ success: true })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`User deletion failed: ${msg}`)
            res.status(400).json({ error: msg })
        }
    })

    return router
}

export { createUserRoutes }
