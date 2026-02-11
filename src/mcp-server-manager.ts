/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import logger from "./mcp-funnel-log.js"
import { getErrorMessage } from "./utils.js"

type ServerType = "sse" | "http" | "stdio"

interface UrlServerConfig {
    url: string
    headers?: Record<string, string>
}

interface StdioServerConfig {
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
}

type ServerConfig = UrlServerConfig | StdioServerConfig

function isUrlConfig (config: ServerConfig): config is UrlServerConfig {
    return "url" in config
}

function isStdioConfig (config: ServerConfig): config is StdioServerConfig {
    return "command" in config
}

interface McpServerEntry {
    id: string
    name: string
    type: ServerType
    enabled: boolean
    config: ServerConfig
    disabledTools: string[]
    createdAt: string
    updatedAt: string | null
    lastConnected: string | null
    lastError: string | null
}

interface ServerData {
    servers: McpServerEntry[]
}

function trimConfigUrl<T extends { url?: string }> (config: T): T {
    if (config && "url" in config && config.url) {
        return { ...config, url: config.url.trim().replace(/\/+$/, "") }
    }
    return config
}

class McpServerManager {
    private filePath: string
    private cachedRaw: string | null = null

    constructor (dataDir: string, userId: string) {
        if (/[/\\]/.test(userId))
            throw new Error("Invalid userId")

        const serversDir = path.join(dataDir, "servers")
        if (!fs.existsSync(serversDir)) {
            fs.mkdirSync(serversDir, { recursive: true })
            logger.info(`Created servers directory: ${serversDir}`)
        }
        this.filePath = path.join(serversDir, `${userId}.json`)
        this.ensureFileExists()
    }

    private ensureFileExists (): void {
        if (!fs.existsSync(this.filePath)) {
            const emptyData: ServerData = { servers: [] }
            this.saveData(emptyData)
            logger.debug(`Created empty server config: ${this.filePath}`)
        }
    }

    private loadData (): ServerData {
        try {
            if (this.cachedRaw === null) {
                this.cachedRaw = fs.readFileSync(this.filePath, "utf-8")
            }
            const parsed = JSON.parse(this.cachedRaw) as ServerData

            if (parsed.servers && Array.isArray(parsed.servers)) {
                for (const server of parsed.servers) {
                    if (server.config && isUrlConfig(server.config)) {
                        server.config.url = server.config.url.trim().replace(/\/+$/, "")
                    }
                }
            }

            return parsed
        }
        catch (err) {
            logger.error(`Failed to load server config: ${getErrorMessage(err)}`)
            this.cachedRaw = null
            return { servers: [] }
        }
    }

    private saveData (data: ServerData): void {
        try {
            const raw = JSON.stringify(data, null, 2)
            fs.writeFileSync(this.filePath, raw, "utf-8")
            this.cachedRaw = raw
        }
        catch (err) {
            logger.error(`Failed to save server config: ${getErrorMessage(err)}`)
            throw err
        }
    }

    private trimConfigUrl (config: ServerConfig): ServerConfig {
        if (isUrlConfig(config)) {
            return trimConfigUrl(config)
        }
        return config
    }

    private validateConfig (type: ServerType, config: ServerConfig): void {
        if (type === "stdio") {
            if (!isStdioConfig(config) || !config.command) {
                throw new Error("Stdio type requires command in config")
            }
            return
        }
        if (!isUrlConfig(config) || !config.url) {
            throw new Error(`${type.toUpperCase()} type requires url in config`)
        }
        const parsed = URL.parse(config.url)
        if (!parsed) {
            throw new Error("Invalid URL format")
        }
    }

    getServers (): McpServerEntry[] {
        const data = this.loadData()
        return data.servers
    }

    getEnabledServers (): McpServerEntry[] {
        const data = this.loadData()
        return data.servers.filter((s) => s.enabled)
    }

    getServer (id: string): McpServerEntry | undefined {
        const data = this.loadData()
        return data.servers.find((s) => s.id === id)
    }

    addServer (serverConfig: { name: string; type: ServerType; config: ServerConfig }): McpServerEntry {
        const data = this.loadData()
        const { name, type, config } = serverConfig

        if (!name || !type || !config) {
            throw new Error("name, type, and config are required")
        }

        if (!["sse", "http", "stdio"].includes(type)) {
            throw new Error("type must be one of: sse, http, stdio")
        }

        const trimmedConfig = this.trimConfigUrl(config)
        this.validateConfig(type, trimmedConfig)

        const newServer: McpServerEntry = {
            id: uuidv4(),
            name,
            type,
            enabled: true,
            config: trimmedConfig,
            disabledTools: [],
            createdAt: new Date().toISOString(),
            updatedAt: null,
            lastConnected: null,
            lastError: null
        }

        data.servers.push(newServer)
        this.saveData(data)

        logger.info(`MCP server added: ${name} (${type})`)
        return newServer
    }

    updateServer (id: string, updates: { name?: string; enabled?: boolean; config?: ServerConfig }): McpServerEntry {
        const data = this.loadData()
        const index = data.servers.findIndex((s) => s.id === id)

        if (index === -1) {
            throw new Error("MCP server not found")
        }

        const server = data.servers[index]

        if (updates.name !== undefined) server.name = updates.name
        if (updates.enabled !== undefined) server.enabled = updates.enabled
        if (updates.config !== undefined) {
            const trimmedConfig = this.trimConfigUrl(updates.config)
            this.validateConfig(server.type, trimmedConfig)
            server.config = trimmedConfig
        }

        server.updatedAt = new Date().toISOString()

        data.servers[index] = server
        this.saveData(data)

        logger.info(`MCP server updated: ${server.name}`)
        return server
    }

    deleteServer (id: string): boolean {
        const data = this.loadData()
        const index = data.servers.findIndex((s) => s.id === id)

        if (index === -1) {
            throw new Error("MCP server not found")
        }

        const removed = data.servers.splice(index, 1)[0]
        this.saveData(data)

        logger.info(`MCP server deleted: ${removed.name}`)
        return true
    }

    toggleServer (id: string): McpServerEntry {
        const data = this.loadData()
        const server = data.servers.find((s) => s.id === id)

        if (!server) {
            throw new Error("MCP server not found")
        }

        server.enabled = !server.enabled
        server.updatedAt = new Date().toISOString()
        this.saveData(data)

        logger.info(`MCP server ${server.enabled ? "enabled" : "disabled"}: ${server.name}`)
        return server
    }

    updateConnectionStatus (id: string, success: boolean, error: string | null = null): void {
        const data = this.loadData()
        const server = data.servers.find((s) => s.id === id)

        if (!server) return

        if (success) {
            server.lastConnected = new Date().toISOString()
            server.lastError = null
        }
        else {
            server.lastError = error
        }

        this.saveData(data)
    }

    updateDisabledTools (id: string, disabledTools: string[]): McpServerEntry {
        const data = this.loadData()
        const server = data.servers.find((s) => s.id === id)

        if (!server) {
            throw new Error("MCP server not found")
        }

        server.disabledTools = disabledTools || []
        server.updatedAt = new Date().toISOString()
        this.saveData(data)

        logger.info(`Updated disabled tools for ${server.name}: ${disabledTools.length} tools disabled`)
        return server
    }

    getDisabledTools (id: string): string[] {
        const server = this.getServer(id)
        return server?.disabledTools || []
    }

    deleteConfigFile (): void {
        try {
            if (fs.existsSync(this.filePath)) {
                fs.unlinkSync(this.filePath)
                logger.info(`Deleted server config: ${this.filePath}`)
            }
        }
        catch (err) {
            logger.error(`Failed to delete server config: ${getErrorMessage(err)}`)
        }
    }
}

export { McpServerManager, trimConfigUrl, isUrlConfig, isStdioConfig }
export type { ServerType, ServerConfig, UrlServerConfig, StdioServerConfig, McpServerEntry }
