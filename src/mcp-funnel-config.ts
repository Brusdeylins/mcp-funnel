// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import fs from "fs"
import path from "path"
import crypto from "crypto"
import logger from "./mcp-funnel-log"

interface McpFunnelConfig {
    port: number
    dataDir: string
    sessionSecret: string
    sessionMaxAge: number
    adminUser: string
    adminPass: string
    logLevel: string
    nodeEnv: string
}

function resolveSessionSecret (dataDir: string): string {
    // 1. ENV var has highest priority
    const envSecret = process.env["SESSION_SECRET"]
    if (envSecret) {
        logger.debug("Using SESSION_SECRET from environment variable")
        return envSecret
    }

    // 2. Read from file if it exists
    const secretFile = path.join(dataDir, "session-secret.txt")
    if (fs.existsSync(secretFile)) {
        const fileSecret = fs.readFileSync(secretFile, "utf8").trim()
        if (fileSecret) {
            logger.debug("Using session secret from file")
            return fileSecret
        }
    }

    // 3. Generate new secret and persist it
    const generated = crypto.randomBytes(32).toString("hex")
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(secretFile, generated, "utf8")
    logger.info("Generated new session secret and saved to file")
    return generated
}

function loadConfig (cliPort?: number, cliDataDir?: string): McpFunnelConfig {
    const dataDir = cliDataDir
        || process.env["DATA_DIR"]
        || "./data"

    // Ensure data directory exists
    fs.mkdirSync(dataDir, { recursive: true })

    const sessionSecret = resolveSessionSecret(dataDir)

    const config: McpFunnelConfig = {
        port:           cliPort || parseInt(process.env["PORT"] || "3000", 10),
        dataDir,
        sessionSecret,
        sessionMaxAge:  parseInt(process.env["SESSION_MAX_AGE"] || "2592000000", 10),
        adminUser:      process.env["ADMIN_USER"] || "",
        adminPass:      process.env["ADMIN_PASS"] || "",
        logLevel:       process.env["LOG_LEVEL"] || "info",
        nodeEnv:        process.env["NODE_ENV"] || "production",
    }

    return config
}

export { McpFunnelConfig, loadConfig }
