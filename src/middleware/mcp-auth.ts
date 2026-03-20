/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { Request, Response, NextFunction } from "express"
import { AuthManager } from "../mcp-funnel-auth.js"
import { StatsManager } from "../mcp-funnel-stats.js"
import { verifyAccessToken } from "../oauth/oauth-token.js"
import { OAuthConfig } from "../oauth/oauth-config.js"
import logger from "../mcp-funnel-log.js"
import { getErrorMessage } from "../utils.js"

function createMcpAuth (authManager: AuthManager, statsManager: StatsManager, oauthConfig: OAuthConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (req.method === "OPTIONS") {
                next()
                return
            }

            const authHeader = req.headers.authorization
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                res.set("WWW-Authenticate", "Bearer")
                res.status(401).json({
                    error: "Missing or invalid Authorization header",
                    message: "Bearer token required"
                })
                return
            }

            const token = authHeader.substring(7)

            /* Legacy API key check (mcp_... prefix) */
            if (oauthConfig.authMode !== "oauth" && token.startsWith("mcp_")) {
                const result = authManager.validateApiKey(token)
                if (result) {
                    req.apiKeyUser = result
                    statsManager.incrementRequests(result.userId)
                    logger.debug(`Valid API key used by: ${result.username}`)
                    next()
                    return
                }
            }

            /* OAuth JWT check */
            if (oauthConfig.authMode !== "legacy") {
                const payload = await verifyAccessToken(
                    oauthConfig.dataDir, token, oauthConfig.issuer, oauthConfig.issuer
                )
                if (payload) {
                    req.apiKeyUser = { valid: true, userId: payload.sub, username: `oauth:${payload.sub}` }
                    statsManager.incrementRequests(payload.sub)
                    logger.debug(`Valid OAuth token for: ${payload.sub}`)
                    next()
                    return
                }
            }

            logger.warn(`Invalid token: ${req.method} ${req.path}`)
            res.set("WWW-Authenticate", "Bearer")
            res.status(401).json({ error: "Invalid token" })
        }
        catch (error) {
            logger.error(`Auth middleware error: ${getErrorMessage(error)}`)
            if (!res.headersSent) {
                res.status(500).json({ error: "Internal authentication error" })
            }
        }
    }
}

export { createMcpAuth }
