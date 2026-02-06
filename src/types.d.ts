// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import "express-session"

declare module "express-session" {
    interface SessionData {
        authenticated: boolean
        userId: string
        role: "admin" | "user"
        username: string
    }
}

declare global {
    namespace Express {
        interface Request {
            apiKeyUser?: { valid: boolean; userId: string; username: string }
        }
    }
}
