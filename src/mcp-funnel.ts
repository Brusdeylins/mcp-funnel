#!/usr/bin/env node

// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import { Command } from "commander"
import { loadConfig } from "./mcp-funnel-config.js"
import { createApp } from "./mcp-funnel-server.js"
import logger from "./mcp-funnel-log.js"

const pkg = { version: "1.0.0", description: "MCP-Funnel - Multi-user MCP server management" }

const program = new Command()
program
    .name("mcp-funnel")
    .description(pkg.description)
    .version(pkg.version)
    .option("-p, --port <number>", "HTTP port", parseInt)
    .option("-d, --data-dir <path>", "Data directory")
    .parse(process.argv)

const opts = program.opts<{ port?: number, dataDir?: string }>()
const config = loadConfig(opts.port, opts.dataDir)

const { app, statsManager, userProxyManager } = createApp(config)

const server = app.listen(config.port, "0.0.0.0", () => {
    logger.info("═══════════════════════════════════════")
    logger.info(`MCP-Funnel started on port ${config.port}`)
    logger.info("═══════════════════════════════════════")
    logger.info(`Data directory: ${config.dataDir}`)
    logger.info(`Environment:   ${config.nodeEnv}`)
    logger.info(`Dashboard:     http://localhost:${config.port}/dashboard`)
    logger.info(`Health:        http://localhost:${config.port}/health`)
    logger.info("═══════════════════════════════════════")
})

process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down...")
    userProxyManager.shutdown()
        .catch((err) => logger.error(`Proxy shutdown error: ${err instanceof Error ? err.message : String(err)}`))
        .finally(() => {
            statsManager.flush()
            server.close(() => {
                logger.info("Server closed")
                process.exit(0)
            })
            setTimeout(() => { process.exit(1) }, 10000)
        })
})

process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down...")
    userProxyManager.shutdown()
        .catch((err) => logger.error(`Proxy shutdown error: ${err instanceof Error ? err.message : String(err)}`))
        .finally(() => {
            statsManager.flush()
            server.close(() => {
                logger.info("Server closed")
                process.exit(0)
            })
            setTimeout(() => { process.exit(1) }, 10000)
        })
})

process.on("uncaughtException", (error) => {
    logger.error(`Uncaught exception: ${error.message}`)
    process.exit(1)
})

process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled rejection: ${reason}`)
    process.exit(1)
})
