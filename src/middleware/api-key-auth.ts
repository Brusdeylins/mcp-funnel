// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import { Request, Response, NextFunction } from "express"
import { AuthManager } from "../mcp-funnel-auth"
import logger from "../mcp-funnel-log"

function createApiKeyAuth (authManager: AuthManager) {
    function requireApiKey (req: Request, res: Response, next: NextFunction): void {
        if (req.method === "OPTIONS") {
            next()
            return
        }

        const authHeader = req.headers.authorization
        if (!authHeader) {
            logger.warn(`API request without Authorization header: ${req.method} ${req.path}`)
            res.status(401).json({
                error: "Missing Authorization header",
                message: "API key required. Format: Authorization: Bearer <your-api-key>"
            })
            return
        }

        if (!authHeader.startsWith("Bearer ")) {
            logger.warn(`Invalid Authorization format: ${req.method} ${req.path}`)
            res.status(401).json({
                error: "Invalid Authorization format",
                message: "Expected format: Authorization: Bearer <your-api-key>"
            })
            return
        }

        const token = authHeader.substring(7)

        const result = authManager.validateApiKey(token)
        if (!result) {
            logger.warn(`Invalid API key attempt: ${token.substring(0, 10)}...`)
            res.status(401).json({
                error: "Invalid API key",
                message: "The provided API key is not valid"
            })
            return
        }

        // Attach user info to request for downstream use
        // @ts-ignore -- extending req with custom property for downstream handlers
        req.apiKeyUser = result
        logger.debug(`Valid API key used by: ${result.username}`)
        next()
    }

    return { requireApiKey }
}

export { createApiKeyAuth }
