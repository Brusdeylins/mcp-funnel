/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { Router, Request, Response } from "express"
import { UserProxyManager } from "../user-proxy-manager.js"
import { renderMcpServersPage } from "../views/mcp-servers-view.js"
import { trimConfigUrl } from "../mcp-server-manager.js"
import type { ServerConfig, UrlServerConfig, StdioServerConfig } from "../mcp-server-manager.js"
import logger from "../mcp-funnel-log.js"
import { getErrorMessage, getSessionUserId } from "../utils.js"

function createMcpRoutes (userProxyManager: UserProxyManager): Router {
    const router = Router()

    /* GET /mcp-servers/manage */
    router.get("/manage", (req: Request, res: Response) => {
        const role = req.session.role || "user"
        const username = req.session.username || ""
        res.send(renderMcpServersPage(role, username))
    })

    /* GET /mcp-servers/api/list */
    router.get("/api/list", async (req: Request, res: Response) => {
        try {
            const userId = getSessionUserId(req)
            const serverManager = userProxyManager.getServerManager(userId)
            const servers = serverManager.getServers()

            const statusMap = new Map<string, unknown>()
            if (servers.length > 0) {
                const proxy = await userProxyManager.getProxy(userId)
                const status = proxy.getStatus()
                for (const s of status) {
                    statusMap.set(s.id, s)
                }
            }

            const enriched = servers.map((server) => {
                const st = statusMap.get(server.id) as Record<string, unknown> | undefined
                return {
                    ...server,
                    connected: st?.connected || false,
                    connectionState: st?.connectionState || "offline",
                    reconnectAttempts: st?.reconnectAttempts || 0,
                    maxReconnectAttempts: st?.maxReconnectAttempts || 5,
                    toolCount: st?.toolCount || 0
                }
            })

            res.json({ success: true, servers: enriched })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`Failed to list MCP servers: ${msg}`)
            res.status(500).json({ error: "Failed to retrieve MCP servers" })
        }
    })

    /* POST /mcp-servers/api/test */
    router.post("/api/test", async (req: Request, res: Response) => {
        try {
            const { type } = req.body as { type: string }

            if (!type || !req.body.config) {
                res.status(400).json({ error: "type and config are required" })
                return
            }

            let config: ServerConfig
            if (type === "stdio") {
                config = req.body.config as StdioServerConfig
            }
            else {
                config = trimConfigUrl(req.body.config as UrlServerConfig)
            }

            const userId = getSessionUserId(req)
            const proxy = await userProxyManager.getProxy(userId)

            logger.info(`[${userId}] Testing MCP connection: ${type}`)
            const result = await proxy.testConnection({ type, config: config as unknown as Record<string, unknown> })

            if (result.success) {
                res.json({
                    success: true,
                    message: "Connection successful",
                    serverInfo: result.serverInfo,
                    toolCount: result.toolCount
                })
            }
            else {
                res.json({ success: false, error: result.error })
            }
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`MCP connection test failed: ${msg}`)
            res.status(500).json({ success: false, error: msg })
        }
    })

    /* POST /mcp-servers/api/create */
    router.post("/api/create", async (req: Request, res: Response) => {
        try {
            const { name, type } = req.body as { name: string; type: string }

            if (!name || !type || !req.body.config) {
                res.status(400).json({ error: "name, type, and config are required" })
                return
            }

            /* Restrict stdio to admin — it allows arbitrary command execution */
            if (type === "stdio" && req.session.role !== "admin") {
                res.status(403).json({ error: "Only admins can add stdio servers" })
                return
            }

            let config: ServerConfig
            if (type === "stdio") {
                config = req.body.config as StdioServerConfig
            }
            else {
                config = trimConfigUrl(req.body.config as UrlServerConfig)
            }

            const userId = getSessionUserId(req)
            const proxy = await userProxyManager.getProxy(userId)
            const serverManager = userProxyManager.getServerManager(userId)

            /* Test connection first */
            logger.info(`[${userId}] Testing MCP connection before adding: ${name} (${type})`)
            const testResult = await proxy.testConnection({ type, config: config as unknown as Record<string, unknown> })

            if (!testResult.success) {
                logger.warn(`[${userId}] MCP connection test failed for ${name}: ${testResult.error}`)
                res.status(400).json({ error: `Connection failed: ${testResult.error}`, connectionTest: false })
                return
            }

            /* Save the server */
            const newServer = serverManager.addServer({ name, type: type as "sse" | "http" | "stdio", config })
            serverManager.updateConnectionStatus(newServer.id, true)

            /* Connect in proxy */
            try {
                await proxy.connectServer(newServer)
                logger.info(`[${userId}] MCP server added and connected: ${name} (${type}) - ${testResult.toolCount} tools`)
            }
            catch (connectError) {
                const cmsg = getErrorMessage(connectError)
                logger.warn(`[${userId}] MCP server added but proxy connection failed: ${cmsg}`)
            }

            userProxyManager.updateStats(userId)
            await proxy.notifyToolListChanged()

            res.json({
                success: true,
                message: `MCP server added successfully (${testResult.toolCount} tools available)`,
                server: newServer,
                serverInfo: testResult.serverInfo,
                toolCount: testResult.toolCount
            })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`Failed to add MCP server: ${msg}`)
            res.status(400).json({ error: msg })
        }
    })

    /* PUT /mcp-servers/api/:id */
    router.put("/api/:id", (req: Request, res: Response) => {
        try {
            const userId = getSessionUserId(req)
            const serverManager = userProxyManager.getServerManager(userId)
            const id = req.params["id"] as string

            const { name, enabled } = req.body as { name?: string; enabled?: boolean }

            let config: ServerConfig | undefined
            if (req.body.config !== undefined) {
                const existingServer = serverManager.getServer(id)
                if (existingServer && existingServer.type === "stdio") {
                    config = req.body.config as StdioServerConfig
                }
                else {
                    config = trimConfigUrl(req.body.config as UrlServerConfig)
                }
            }

            const updates: { name?: string; enabled?: boolean; config?: ServerConfig } = {}
            if (name !== undefined) updates.name = name
            if (enabled !== undefined) updates.enabled = enabled
            if (config !== undefined) updates.config = config

            const server = serverManager.updateServer(id, updates)

            res.json({ success: true, message: "MCP server updated successfully", server })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            if (msg === "MCP server not found") {
                res.status(404).json({ error: msg })
                return
            }
            logger.error(`Failed to update MCP server: ${msg}`)
            res.status(400).json({ error: msg })
        }
    })

    /* POST /mcp-servers/api/:id/toggle */
    router.post("/api/:id/toggle", async (req: Request, res: Response) => {
        try {
            const userId = getSessionUserId(req)
            const serverManager = userProxyManager.getServerManager(userId)
            const id = req.params["id"] as string

            const server = serverManager.toggleServer(id)

            /* If proxy is initialized, connect/disconnect accordingly */
            if (userProxyManager.isInitialized(userId)) {
                const proxy = await userProxyManager.getProxy(userId)
                if (server.enabled) {
                    try {
                        await proxy.connectServer(server)
                    }
                    catch (err) {
                        const emsg = getErrorMessage(err)
                        logger.warn(`[${userId}] Failed to connect toggled server: ${emsg}`)
                    }
                }
                else {
                    await proxy.disconnectServer(id)
                }
                userProxyManager.updateStats(userId)
                await proxy.notifyToolListChanged()
            }

            res.json({ success: true, message: `MCP server ${server.enabled ? "enabled" : "disabled"}`, server })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            if (msg === "MCP server not found") {
                res.status(404).json({ error: msg })
                return
            }
            logger.error(`Failed to toggle MCP server: ${msg}`)
            res.status(500).json({ error: msg })
        }
    })

    /* DELETE /mcp-servers/api/:id */
    router.delete("/api/:id", async (req: Request, res: Response) => {
        try {
            const userId = getSessionUserId(req)
            const serverManager = userProxyManager.getServerManager(userId)
            const id = req.params["id"] as string

            /* Disconnect if proxy is running */
            if (userProxyManager.isInitialized(userId)) {
                const proxy = await userProxyManager.getProxy(userId)
                await proxy.disconnectServer(id)
            }

            serverManager.deleteServer(id)
            userProxyManager.updateStats(userId)

            if (userProxyManager.isInitialized(userId)) {
                const proxyForNotify = await userProxyManager.getProxy(userId)
                await proxyForNotify.notifyToolListChanged()
            }

            res.json({ success: true, message: "MCP server deleted successfully" })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            if (msg === "MCP server not found") {
                res.status(404).json({ error: msg })
                return
            }
            logger.error(`Failed to delete MCP server: ${msg}`)
            res.status(500).json({ error: "Failed to delete MCP server" })
        }
    })

    /* GET /mcp-servers/api/:id/tools */
    router.get("/api/:id/tools", async (req: Request, res: Response) => {
        try {
            const userId = getSessionUserId(req)
            const serverManager = userProxyManager.getServerManager(userId)
            const id = req.params["id"] as string

            const server = serverManager.getServer(id)
            if (!server) {
                res.status(404).json({ error: "MCP server not found" })
                return
            }

            if (!userProxyManager.isInitialized(userId)) {
                res.json({
                    success: true,
                    server: { id: server.id, name: server.name, type: server.type },
                    tools: [],
                    disabledTools: server.disabledTools || [],
                    connected: false
                })
                return
            }

            const proxy = await userProxyManager.getProxy(userId)
            const toolsData = proxy.getServerTools(id)

            res.json({
                success: true,
                server: { id: server.id, name: server.name, type: server.type },
                ...toolsData
            })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`Failed to get server tools: ${msg}`)
            res.status(500).json({ error: "Failed to get server tools" })
        }
    })

    /* PUT /mcp-servers/api/:id/tools */
    router.put("/api/:id/tools", async (req: Request, res: Response) => {
        try {
            const userId = getSessionUserId(req)
            const serverManager = userProxyManager.getServerManager(userId)
            const id = req.params["id"] as string
            const { disabledTools } = req.body as { disabledTools: string[] }

            if (!Array.isArray(disabledTools)) {
                res.status(400).json({ error: "disabledTools must be an array" })
                return
            }

            const server = serverManager.updateDisabledTools(id, disabledTools)
            userProxyManager.updateStats(userId)

            if (userProxyManager.isInitialized(userId)) {
                const proxy = await userProxyManager.getProxy(userId)
                await proxy.notifyToolListChanged()
            }

            res.json({
                success: true,
                message: `Updated tool settings for ${server.name}`,
                disabledTools: server.disabledTools
            })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            if (msg === "MCP server not found") {
                res.status(404).json({ error: msg })
                return
            }
            logger.error(`Failed to update disabled tools: ${msg}`)
            res.status(500).json({ error: "Failed to update disabled tools" })
        }
    })

    /* POST /mcp-servers/api/refresh */
    router.post("/api/refresh", async (req: Request, res: Response) => {
        try {
            const userId = getSessionUserId(req)
            logger.info(`[${userId}] Refreshing all MCP server connections`)

            const proxy = await userProxyManager.getProxy(userId)
            await proxy.refresh()
            userProxyManager.updateStats(userId)
            await proxy.notifyToolListChanged()

            const serverManager = userProxyManager.getServerManager(userId)
            const servers = serverManager.getServers()
            const enriched = servers.map((server) => ({
                ...server,
                connected: proxy.isConnected(server.id)
            }))

            res.json({ success: true, message: "All MCP connections refreshed", servers: enriched })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`Failed to refresh MCP connections: ${msg}`)
            res.status(500).json({ error: "Failed to refresh connections" })
        }
    })

    /* POST /mcp-servers/api/:id/refresh */
    router.post("/api/:id/refresh", async (req: Request, res: Response) => {
        try {
            const userId = getSessionUserId(req)
            const serverManager = userProxyManager.getServerManager(userId)
            const id = req.params["id"] as string

            const server = serverManager.getServer(id)
            if (!server) {
                res.status(404).json({ error: "MCP server not found" })
                return
            }

            logger.info(`[${userId}] Refreshing MCP server connection: ${server.name}`)
            const proxy = await userProxyManager.getProxy(userId)

            await proxy.disconnectServer(id)

            if (server.enabled) {
                await proxy.connectServer(server)
                serverManager.updateConnectionStatus(server.id, true)
            }

            userProxyManager.updateStats(userId)
            await proxy.notifyToolListChanged()

            res.json({
                success: true,
                message: `MCP server "${server.name}" refreshed`,
                connected: proxy.isConnected(server.id)
            })
        }
        catch (error) {
            const msg = getErrorMessage(error)
            try {
                const id = req.params["id"] as string
                const serverManager = userProxyManager.getServerManager(getSessionUserId(req))
                serverManager.updateConnectionStatus(id, false, msg)
            }
            catch {
                /* ignore status update failure */
            }
            logger.error(`Failed to refresh MCP server: ${msg}`)
            res.status(500).json({ error: "Failed to refresh server: " + msg })
        }
    })

    return router
}

export { createMcpRoutes }
