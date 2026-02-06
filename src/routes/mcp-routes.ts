// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import { Router, Request, Response } from "express"
import { renderMcpServersPage } from "../views/mcp-servers-view"

function createMcpRoutes (): Router {
    const router = Router()

    // GET /mcp-servers/manage
    router.get("/manage", (req: Request, res: Response) => {
        const role = req.session.role || "user"
        res.send(renderMcpServersPage(role))
    })

    return router
}

export { createMcpRoutes }
