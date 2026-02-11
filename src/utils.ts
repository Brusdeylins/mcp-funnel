/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { Request } from "express"

const VERSION = "1.1.0"

/**
 * Extract a human-readable message from an unknown error value.
 */
function getErrorMessage (err: unknown): string {
    return err instanceof Error ? err.message : String(err)
}

/**
 * Extract userId from session, throwing if missing.
 * Use in routes where the auth middleware guarantees a session.
 */
function getSessionUserId (req: Request): string {
    if (!req.session.userId)
        throw new Error("Missing userId in session")
    return req.session.userId
}

export { VERSION, getErrorMessage, getSessionUserId }
