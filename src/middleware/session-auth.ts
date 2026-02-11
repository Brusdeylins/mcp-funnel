/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { Request, Response, NextFunction } from "express"
import { AuthManager } from "../mcp-funnel-auth.js"
import logger from "../mcp-funnel-log.js"
import { getErrorMessage } from "../utils.js"

function createSessionAuth (authManager: AuthManager) {
    function requireAuth (req: Request, res: Response, next: NextFunction): void {
        if (req.session?.authenticated) {
            next()
            return
        }
        logger.warn(`Unauthorized access attempt to ${req.path}`)
        res.redirect("/login")
    }

    function requireAdmin (req: Request, res: Response, next: NextFunction): void {
        if (req.session?.authenticated && req.session.role === "admin") {
            next()
            return
        }
        logger.warn(`Admin access denied for ${req.path}`)
        res.status(403).send("Forbidden")
    }

    function checkSetup (req: Request, res: Response, next: NextFunction): void {
        const skipPaths = ["/setup", "/login", "/health", "/logout"]
        if (skipPaths.includes(req.path) || req.path.startsWith("/mcp")) {
            next()
            return
        }

        try {
            const setupRequired = authManager.isSetupRequired()
            if (setupRequired) {
                logger.info("Setup required, redirecting to /setup")
                res.redirect("/setup")
                return
            }
            next()
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`Setup check failed: ${msg}`)
            res.status(500).json({ error: "Server error" })
        }
    }

    return { requireAuth, requireAdmin, checkSetup }
}

export { createSessionAuth }
