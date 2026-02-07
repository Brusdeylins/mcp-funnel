// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import fs from "fs"
import path from "path"
import logger from "./mcp-funnel-log.js"
import { McpServerManager } from "./mcp-server-manager.js"
import { McpProxyService } from "./mcp-proxy-service.js"
import { StatsManager } from "./mcp-funnel-stats.js"

interface UserEntry {
    proxy: McpProxyService
    serverManager: McpServerManager
    lastAccess: number
}

const IDLE_CHECK_INTERVAL = 5 * 60 * 1000    /* 5 minutes  */
const IDLE_TIMEOUT        = 30 * 60 * 1000   /* 30 minutes */

class UserProxyManager {
    private users: Map<string, UserEntry>
    private initPromises: Map<string, Promise<McpProxyService>>
    private dataDir: string
    private statsManager: StatsManager
    private idleCheckTimer: ReturnType<typeof setInterval> | null

    constructor (dataDir: string, statsManager: StatsManager) {
        this.users = new Map()
        this.initPromises = new Map()
        this.dataDir = dataDir
        this.statsManager = statsManager
        this.idleCheckTimer = setInterval(() => this.cleanupIdle(), IDLE_CHECK_INTERVAL)
    }

    async getProxy (userId: string): Promise<McpProxyService> {
        const existing = this.users.get(userId)
        if (existing) {
            existing.lastAccess = Date.now()
            return existing.proxy
        }

        /* Promise coalescing: prevent duplicate concurrent init */
        const pending = this.initPromises.get(userId)
        if (pending) {
            return pending
        }

        const initPromise = this.initializeUser(userId)
        this.initPromises.set(userId, initPromise)

        try {
            const proxy = await initPromise
            return proxy
        }
        finally {
            this.initPromises.delete(userId)
        }
    }

    private async initializeUser (userId: string): Promise<McpProxyService> {
        logger.info(`Initializing MCP proxy for user: ${userId}`)

        const serverManager = new McpServerManager(this.dataDir, userId)
        const proxy = new McpProxyService(serverManager, userId)

        await proxy.initialize()

        this.users.set(userId, {
            proxy,
            serverManager,
            lastAccess: Date.now()
        })

        this.updateStats(userId, proxy, serverManager)

        return proxy
    }

    getServerManager (userId: string): McpServerManager {
        const existing = this.users.get(userId)
        if (existing) {
            existing.lastAccess = Date.now()
            return existing.serverManager
        }
        /* Return a new manager even if proxy not initialized yet */
        return new McpServerManager(this.dataDir, userId)
    }

    updateStats (userId: string, proxy?: McpProxyService, serverManager?: McpServerManager): void {
        const entry = this.users.get(userId)
        const p = proxy || entry?.proxy
        const sm = serverManager || entry?.serverManager
        if (!p || !sm) return

        const servers = sm.getServers()
        this.statsManager.setMcpServers(userId, servers.length)
        this.statsManager.setRegisteredTools(userId, p.getTotalToolCount())
        this.statsManager.setActiveTools(userId, p.getActiveToolCount())
    }

    async removeUser (userId: string): Promise<void> {
        logger.info(`Removing MCP proxy for user: ${userId}`)

        const entry = this.users.get(userId)
        if (entry) {
            await entry.proxy.shutdown()
            this.users.delete(userId)
        }

        /* Delete server config file */
        const filePath = path.join(this.dataDir, "servers", `${userId}.json`)
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
                logger.info(`Deleted server config for user: ${userId}`)
            }
        }
        catch (err) {
            logger.error(`Failed to delete server config for ${userId}: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    async shutdown (): Promise<void> {
        logger.info("Shutting down all MCP proxies")
        if (this.idleCheckTimer) {
            clearInterval(this.idleCheckTimer)
            this.idleCheckTimer = null
        }
        for (const [userId, entry] of this.users.entries()) {
            try {
                await entry.proxy.shutdown()
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                logger.error(`Error shutting down proxy for ${userId}: ${msg}`)
            }
        }
        this.users.clear()
    }

    private cleanupIdle (): void {
        const now = Date.now()
        for (const [userId, entry] of this.users.entries()) {
            if (now - entry.lastAccess > IDLE_TIMEOUT) {
                logger.info(`Shutting down idle MCP proxy for user: ${userId}`)
                entry.proxy.shutdown().catch((err) => {
                    const msg = err instanceof Error ? err.message : String(err)
                    logger.error(`Error shutting down idle proxy for ${userId}: ${msg}`)
                })
                this.users.delete(userId)
            }
        }
    }

    isInitialized (userId: string): boolean {
        return this.users.has(userId)
    }
}

export { UserProxyManager }
