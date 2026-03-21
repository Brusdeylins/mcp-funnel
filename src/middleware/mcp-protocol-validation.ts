/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (agentic coding with Claude Code) */

import { Request, Response, NextFunction } from "express"

const DEFAULT_SUPPORTED_VERSIONS = ["2025-11-25", "2025-03-26"]

function createProtocolValidation (supportedVersions = DEFAULT_SUPPORTED_VERSIONS) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const version = req.headers["mcp-protocol-version"] as string | undefined
        if (version && !supportedVersions.includes(version)) {
            res.status(400).json({
                jsonrpc: "2.0",
                error: { code: -32600, message: `Unsupported protocol version: ${version}. Supported: ${supportedVersions.join(", ")}` },
                id: null
            })
            return
        }
        next()
    }
}

/* Pre-parse allowed origins into hostname+protocol pairs for safe matching */
function parseOrigin (origin: string): { protocol: string; hostname: string; port: string } | null {
    try {
        const url = new URL(origin)
        return { protocol: url.protocol, hostname: url.hostname, port: url.port }
    }
    catch {
        return null
    }
}

function createOriginValidation (allowedOrigins?: string[]) {
    const defaults = ["http://localhost", "http://127.0.0.1", "https://localhost", "https://127.0.0.1"]
    const allowed = (allowedOrigins || defaults).map(parseOrigin).filter(Boolean)

    return (req: Request, res: Response, next: NextFunction): void => {
        const origin = req.headers.origin as string | undefined
        if (origin) {
            const parsed = parseOrigin(origin)
            const match = parsed && allowed.some((a) =>
                a!.protocol === parsed.protocol
                && a!.hostname === parsed.hostname
                && (a!.port === "" || a!.port === parsed.port)
            )
            if (!match) {
                res.status(403).json({
                    jsonrpc: "2.0",
                    error: { code: -32600, message: "Forbidden: invalid origin" },
                    id: null
                })
                return
            }
        }
        next()
    }
}

export { createProtocolValidation, createOriginValidation }
