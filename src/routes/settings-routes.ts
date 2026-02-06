// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import { Router, Request, Response } from "express"
import { AuthManager } from "../mcp-funnel-auth"
import { renderSettingsPage } from "../views/settings-view"
import logger from "../mcp-funnel-log"

function createSettingsRoutes (authManager: AuthManager): Router {
    const router = Router()

    // GET /settings
    router.get("/", (req: Request, res: Response) => {
        const role = req.session.role || "user"
        res.send(renderSettingsPage(role))
    })

    // POST /settings/api/change-password
    router.post("/api/change-password", async (req: Request, res: Response) => {
        try {
            const userId = req.session.userId || "admin"
            const { currentPassword, newPassword } = req.body as { currentPassword: string, newPassword: string }

            if (!currentPassword || !newPassword) {
                res.status(400).json({ error: "Current and new password required" })
                return
            }

            await authManager.updatePassword(userId, currentPassword, newPassword)
            logger.info(`Password changed for user: ${userId}`)
            res.json({ success: true, message: "Password changed" })
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`Password change failed: ${msg}`)
            res.status(400).json({ error: msg })
        }
    })

    return router
}

export { createSettingsRoutes }
