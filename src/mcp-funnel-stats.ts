// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import fs from "fs"
import path from "path"
import logger from "./mcp-funnel-log.js"

interface UserStats {
    requests: number
    mcpServers: number
    registeredTools: number
    activeTools: number
}

interface StatsData {
    users: Record<string, UserStats>
}

function emptyUserStats (): UserStats {
    return { requests: 0, mcpServers: 0, registeredTools: 0, activeTools: 0 }
}

class StatsManager {
    private filePath: string
    private data: StatsData
    private dirty: boolean
    private flushInterval: ReturnType<typeof setInterval> | null

    constructor (dataDir: string) {
        this.filePath = path.join(dataDir, "stats.json")
        this.data = { users: {} }
        this.dirty = false
        this.flushInterval = null
        this.load()
        this.startAutoFlush()
    }

    private load (): void {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, "utf-8")
                this.data = JSON.parse(raw) as StatsData
                logger.debug(`Stats loaded: ${Object.keys(this.data.users).length} users tracked`)
            }
        }
        catch (err) {
            logger.error(`Failed to load stats: ${err instanceof Error ? err.message : String(err)}`)
            this.data = { users: {} }
        }
    }

    private save (): void {
        if (!this.dirty) return
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8")
            this.dirty = false
        }
        catch (err) {
            logger.error(`Failed to save stats: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    private startAutoFlush (): void {
        this.flushInterval = setInterval(() => this.save(), 30000)
    }

    private ensureUser (userId: string): UserStats {
        if (!this.data.users[userId]) {
            this.data.users[userId] = emptyUserStats()
        }
        return this.data.users[userId]
    }

    incrementRequests (userId: string): void {
        this.ensureUser(userId).requests++
        this.dirty = true
    }

    setMcpServers (userId: string, count: number): void {
        this.ensureUser(userId).mcpServers = count
        this.dirty = true
    }

    setRegisteredTools (userId: string, count: number): void {
        this.ensureUser(userId).registeredTools = count
        this.dirty = true
    }

    setActiveTools (userId: string, count: number): void {
        this.ensureUser(userId).activeTools = count
        this.dirty = true
    }

    getUserStats (userId: string): UserStats {
        return { ...emptyUserStats(), ...this.data.users[userId] }
    }

    getAllRequestCounts (): Record<string, number> {
        const counts: Record<string, number> = {}
        for (const [userId, stats] of Object.entries(this.data.users)) {
            counts[userId] = stats.requests
        }
        return counts
    }

    getTotals (): UserStats {
        const totals = emptyUserStats()
        for (const stats of Object.values(this.data.users)) {
            totals.requests += stats.requests
            totals.mcpServers += stats.mcpServers
            totals.registeredTools += stats.registeredTools
            totals.activeTools += stats.activeTools
        }
        return totals
    }

    flush (): void {
        this.save()
        if (this.flushInterval) {
            clearInterval(this.flushInterval)
            this.flushInterval = null
        }
    }
}

export { StatsManager, UserStats }
