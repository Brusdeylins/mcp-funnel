/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { Request, Response, NextFunction } from "express"

function createSingleUserAuth () {
    function requireAuth (req: Request, _res: Response, next: NextFunction): void {
        req.session.authenticated = true
        req.session.userId = "local"
        req.session.username = "local"
        req.session.role = "admin"
        next()
    }

    function requireAdmin (_req: Request, _res: Response, next: NextFunction): void {
        next()
    }

    function checkSetup (req: Request, res: Response, next: NextFunction): void {
        if (req.path === "/setup" || req.path === "/login") {
            res.redirect("/dashboard")
            return
        }
        next()
    }

    return { requireAuth, requireAdmin, checkSetup }
}

export { createSingleUserAuth }
