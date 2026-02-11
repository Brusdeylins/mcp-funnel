/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { randomUUID } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import {
    ListToolsRequestSchema, CallToolRequestSchema,
    ListPromptsRequestSchema, GetPromptRequestSchema,
    ListResourcesRequestSchema, ReadResourceRequestSchema,
    SubscribeRequestSchema, UnsubscribeRequestSchema,
    CompleteRequestSchema, SetLevelRequestSchema,
    ResourceUpdatedNotificationSchema, LoggingMessageNotificationSchema
} from "@modelcontextprotocol/sdk/types.js"
import logger from "./mcp-funnel-log.js"
import { VERSION, getErrorMessage } from "./utils.js"
import { McpServerManager, McpServerEntry, isUrlConfig, isStdioConfig } from "./mcp-server-manager.js"

import { isMetaTool, getMetaTools, searchTools } from "./mcp-meta-tools.js"
import type { SearchWords, ToolWithServer, MetaTool } from "./mcp-meta-tools.js"

interface ServerConnection {
    client: Client
    transport: SSEClientTransport | StreamableHTTPClientTransport | StdioClientTransport
    tools: ToolWithServer[]
    serverInfo: { name?: string; version?: string } | undefined
    capabilities: Record<string, unknown> | undefined
    pingInterval: ReturnType<typeof setInterval> | null
}

interface ReconnectState {
    attempts: number
    lastAttempt: number
    backoffMs: number
    timeoutId: ReturnType<typeof setTimeout> | null
}

/* MCP logging levels in ascending severity (RFC 5424) */
const LOG_LEVEL_SEVERITY: Record<string, number> = {
    debug: 0,
    info: 1,
    notice: 2,
    warning: 3,
    error: 4,
    critical: 5,
    alert: 6,
    emergency: 7
}

class McpProxyService {
    private connections: Map<string, ServerConnection>
    private reconnectState: Map<string, ReconnectState>
    private serverManager: McpServerManager
    private userId: string

    /* Inbound SDK Server + transport (multi-session) */
    private inboundSessions = new Map<string, { server: Server; transport: StreamableHTTPServerTransport; createdAt: number; lastActivity: number }>()
    private subscribedResources = new Set<string>()

    /* uri → serverId */
    private resourceOwners = new Map<string, string>()
    private logLevel = "warning"
    private sessionCleanupTimer: ReturnType<typeof setInterval> | null = null

    private readonly PING_INTERVAL = 30000
    private readonly MAX_RECONNECT_ATTEMPTS = 5
    private readonly INITIAL_BACKOFF_MS = 5000
    private readonly MAX_BACKOFF_MS = 300000
    private readonly COOLDOWN_MS = 600000

    /* 30 minutes */
    private readonly SESSION_IDLE_TTL = 30 * 60 * 1000

    /* 5 minutes */
    private readonly SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000

    constructor (serverManager: McpServerManager, userId: string) {
        this.connections = new Map()
        this.reconnectState = new Map()
        this.serverManager = serverManager
        this.userId = userId
    }

    async initialize (): Promise<void> {
        const servers = this.serverManager.getEnabledServers()
        logger.info(`[${this.userId}] Initializing MCP proxy with ${servers.length} enabled servers`)

        for (const server of servers) {
            try {
                await this.connectServer(server)
            }
            catch (error) {
                const msg = getErrorMessage(error)
                logger.error(`[${this.userId}] Failed to connect to MCP server ${server.name}: ${msg}`)
                this.serverManager.updateConnectionStatus(server.id, false, msg)
            }
        }

        this.sessionCleanupTimer = setInterval(() => this.cleanupStaleSessions(), this.SESSION_CLEANUP_INTERVAL)
        logger.info(`[${this.userId}] Inbound SDK Server ready for sessions`)
    }

    private cleanupStaleSessions (): void {
        const now = Date.now()
        for (const [sessionId, session] of this.inboundSessions.entries()) {
            if (now - session.lastActivity > this.SESSION_IDLE_TTL) {
                logger.info(`[${this.userId}] Closing stale inbound session: ${sessionId}`)
                session.transport.close().catch(() => {})
                session.server.close().catch(() => {})
                this.inboundSessions.delete(sessionId)
            }
        }
    }

    private async createInboundSession (): Promise<{ server: Server; transport: StreamableHTTPServerTransport }> {
        const server = new Server(
            { name: "mcp-funnel", version: VERSION },
            {
                capabilities: {
                    tools: { listChanged: true },
                    prompts: { listChanged: true },
                    resources: { subscribe: true, listChanged: true },
                    logging: {},
                    completions: {}
                }
            }
        )

        this.registerInboundHandlers(server)

        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableJsonResponse: true,
            onsessioninitialized: (sessionId: string) => {
                const now = Date.now()
                this.inboundSessions.set(sessionId, { server, transport, createdAt: now, lastActivity: now })
                logger.debug(`[${this.userId}] New inbound session: ${sessionId}`)
            }
        })

        transport.onclose = () => {
            const sessionId = transport.sessionId
            if (sessionId) {
                this.inboundSessions.delete(sessionId)
                logger.debug(`[${this.userId}] Inbound session closed: ${sessionId}`)
            }

            /* Clear stale subscriptions when no sessions remain */
            if (this.inboundSessions.size === 0)
                this.subscribedResources.clear()
        }

        await server.connect(transport)
        return { server, transport }
    }

    private registerInboundHandlers (server: Server): void {
        /* tools/list */
        server.setRequestHandler(ListToolsRequestSchema, async () => {
            return { tools: this.getExposedTools() }
        })

        /* tools/call */
        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params
            if (isMetaTool(name)) {
                return await this.handleMetaToolCall(name, args || {}) as { content: Array<{ type: string; text?: string }> }
            }
            return await this.callTool(name, args || {}) as { content: Array<{ type: string; text?: string }> }
        })

        /* prompts/list */
        server.setRequestHandler(ListPromptsRequestSchema, async () => {
            const prompts = await this.getAllPrompts()
            return { prompts: prompts as Array<{ name: string; description?: string; arguments?: Array<{ name: string; description?: string; required?: boolean }> }> }
        })

        /* prompts/get */
        server.setRequestHandler(GetPromptRequestSchema, async (request) => {
            const { name, arguments: promptArgs } = request.params
            for (const conn of this.connections.values()) {
                const caps = conn.capabilities as Record<string, unknown> | undefined
                if (caps?.prompts) {
                    try {
                        return await conn.client.getPrompt({ name, arguments: promptArgs })
                    }
                    catch {
                        /* Try next server */
                    }
                }
            }
            throw new Error(`Prompt not found: ${name}`)
        })

        /* resources/list */
        server.setRequestHandler(ListResourcesRequestSchema, async () => {
            const resources = await this.getAllResources()
            return { resources: resources as Array<{ uri: string; name: string; description?: string; mimeType?: string }> }
        })

        /* resources/read */
        server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const { uri } = request.params
            for (const conn of this.connections.values()) {
                const caps = conn.capabilities as Record<string, unknown> | undefined
                if (caps?.resources) {
                    try {
                        return await conn.client.readResource({ uri })
                    }
                    catch {
                        /* Try next server */
                    }
                }
            }
            throw new Error(`Resource not found: ${uri}`)
        })

        /* resources/subscribe */
        server.setRequestHandler(SubscribeRequestSchema, async (request) => {
            const { uri } = request.params
            this.subscribedResources.add(uri)

            /* Forward subscription to the backend that owns this resource */
            const ownerId = this.resourceOwners.get(uri)
            const ownerConn = ownerId ? this.connections.get(ownerId) : undefined
            if (ownerConn) {
                try {
                    await ownerConn.client.subscribeResource({ uri })
                }
                catch {
                    /* Backend may not support subscribe — ignore */
                }
            }
            else {
                /* Owner unknown — try all resource-capable backends */
                for (const conn of this.connections.values()) {
                    const caps = conn.capabilities as Record<string, unknown> | undefined
                    if (caps?.resources) {
                        try { await conn.client.subscribeResource({ uri }) }
                        catch { /* ignore */ }
                    }
                }
            }
            return {}
        })

        /* resources/unsubscribe */
        server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
            const { uri } = request.params
            this.subscribedResources.delete(uri)

            const ownerId = this.resourceOwners.get(uri)
            const ownerConn = ownerId ? this.connections.get(ownerId) : undefined
            if (ownerConn) {
                try {
                    await ownerConn.client.unsubscribeResource({ uri })
                }
                catch {
                    /* Ignore */
                }
            }
            else {
                /* Owner unknown — try all resource-capable backends */
                for (const conn of this.connections.values()) {
                    const caps = conn.capabilities as Record<string, unknown> | undefined
                    if (caps?.resources) {
                        try { await conn.client.unsubscribeResource({ uri }) }
                        catch { /* ignore */ }
                    }
                }
            }
            return {}
        })

        /* completion/complete */
        server.setRequestHandler(CompleteRequestSchema, async (request) => {
            const { ref, argument } = request.params

            /* Find the backend server that owns the prompt/resource referenced */
            for (const conn of this.connections.values()) {
                const caps = conn.capabilities as Record<string, unknown> | undefined
                const refType = ref.type

                if (refType === "ref/prompt" && caps?.prompts) {
                    try {
                        return await conn.client.complete({ ref, argument })
                    }
                    catch {
                        /* Try next server */
                    }
                }
                else if (refType === "ref/resource" && caps?.resources) {
                    try {
                        return await conn.client.complete({ ref, argument })
                    }
                    catch {
                        /* Try next server */
                    }
                }
            }

            /* No backend supports completions or ref not found */
            return { completion: { values: [] } }
        })

        /* logging/setLevel */
        server.setRequestHandler(SetLevelRequestSchema, async (request) => {
            this.logLevel = request.params.level
            logger.info(`[${this.userId}] MCP log level set to: ${this.logLevel}`)
            return {}
        })
    }

    async handleInboundRequest (req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
        const body = req.body

        /* Check if this is an initialize request (needs new session) */
        if (req.method === "POST" && this.isInitializeRequest(body)) {
            const { transport } = await this.createInboundSession()
            await transport.handleRequest(req, res, body)
            return
        }

        /* For non-initialize requests, look up transport by session ID */
        const sessionId = req.headers["mcp-session-id"] as string | undefined
        if (sessionId) {
            const session = this.inboundSessions.get(sessionId)
            if (session) {
                session.lastActivity = Date.now()
                await session.transport.handleRequest(req, res, body)
                return
            }
        }

        /* No valid session */
        res.writeHead(400, { "Content-Type": "application/json" })
        res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request: Server not initialized" },
            id: null
        }))
    }

    private isInitializeRequest (body: unknown): boolean {
        if (!body || typeof body !== "object") return false
        const msg = body as { method?: string }
        if (msg.method === "initialize") return true
        /* Batch request — check if any message is initialize */
        if (Array.isArray(body)) {
            return body.some((m) => m && typeof m === "object" && m.method === "initialize")
        }
        return false
    }

    private async notifyInboundSessions (action: (server: Server) => Promise<void>, label: string): Promise<void> {
        for (const { server } of this.inboundSessions.values()) {
            try {
                await action(server)
            }
            catch (e) {
                const msg = getErrorMessage(e)
                logger.debug(`[${this.userId}] Failed to send ${label} notification: ${msg}`)
            }
        }
    }

    async notifyToolListChanged (): Promise<void> {
        await this.notifyInboundSessions((s) => s.sendToolListChanged(), "tool list changed")
    }

    async notifyResourceListChanged (): Promise<void> {
        await this.notifyInboundSessions((s) => s.sendResourceListChanged(), "resource list changed")
    }

    async notifyPromptListChanged (): Promise<void> {
        await this.notifyInboundSessions((s) => s.sendPromptListChanged(), "prompt list changed")
    }

    async shutdown (): Promise<void> {
        logger.info(`[${this.userId}] Shutting down MCP proxy`)
        if (this.sessionCleanupTimer) {
            clearInterval(this.sessionCleanupTimer)
            this.sessionCleanupTimer = null
        }
        for (const serverId of this.reconnectState.keys()) {
            this.cancelReconnect(serverId)
        }
        for (const serverId of [...this.connections.keys()]) {
            await this.closeConnection(serverId)
        }

        /* Close all inbound sessions */
        for (const [sessionId, { server, transport }] of this.inboundSessions.entries()) {
            try {
                await transport.close()
            }
            catch (e) {
                const msg = getErrorMessage(e)
                logger.debug(`[${this.userId}] Error closing inbound transport ${sessionId}: ${msg}`)
            }
            try {
                await server.close()
            }
            catch (e) {
                const msg = getErrorMessage(e)
                logger.debug(`[${this.userId}] Error closing inbound server ${sessionId}: ${msg}`)
            }
        }
        this.inboundSessions.clear()
    }

    async connectServer (server: McpServerEntry): Promise<void> {
        logger.info(`[${this.userId}] Connecting to MCP server: ${server.name} (${server.type})`)

        let transport: SSEClientTransport | StreamableHTTPClientTransport | StdioClientTransport

        switch (server.type) {
            case "sse":
                transport = this.createSSETransport(server)
                break
            case "http":
                transport = this.createHTTPTransport(server)
                break
            case "stdio":
                transport = this.createStdioTransport(server)
                break
            default:
                throw new Error(`Unknown server type: ${server.type}`)
        }

        const client = new Client(
            { name: "mcp-funnel", version: VERSION },
            { capabilities: {} }
        )

        transport.onerror = (error: Error) => {
            const msg = error.message || ""

            if (msg.includes("Failed to open SSE stream")
                || msg.includes("SSE stream disconnected")
                || msg.includes("AbortError")) {
                logger.debug(`[${this.userId}] MCP SSE event for ${server.name}: ${msg} (non-critical)`)
                return
            }

            logger.error(`[${this.userId}] MCP transport error for ${server.name}: ${msg}`)
            this.serverManager.updateConnectionStatus(server.id, false, msg)

            if (this.isSessionError(error)) {
                this.scheduleReconnect(server.id)
            }
        }

        transport.onclose = () => {
            logger.info(`[${this.userId}] MCP connection closed: ${server.name}`)
            const conn = this.connections.get(server.id)
            if (conn?.pingInterval) {
                clearInterval(conn.pingInterval)
                conn.pingInterval = null
            }
            this.connections.delete(server.id)
        }

        try {
            await client.connect(transport)

            const serverInfo = client.getServerVersion()
            const capabilities = client.getServerCapabilities()

            logger.info(`[${this.userId}] Connected to ${server.name}: ${serverInfo?.name || "unknown"} v${serverInfo?.version || "?"}`)

            let tools: ToolWithServer[] = []
            if (capabilities?.tools) {
                const toolsResult = await client.listTools()
                tools = (toolsResult.tools || []).map((tool) => ({
                    ...tool,
                    description: tool.description || "",
                    _serverId: server.id,
                    _serverName: server.name
                }))
                logger.info(`[${this.userId}] ${server.name}: ${tools.length} tools available`)
            }

            let pingInterval: ReturnType<typeof setInterval> | null = null
            if (server.type === "sse") {
                pingInterval = setInterval(async () => {
                    try {
                        await client.request({ method: "ping" }, { _meta: {} } as never)
                        logger.debug(`[${this.userId}] Keep-alive ping sent to ${server.name}`)
                    }
                    catch (err) {
                        const msg = getErrorMessage(err)
                        logger.warn(`[${this.userId}] Keep-alive ping failed for ${server.name}: ${msg}`)
                    }
                }, this.PING_INTERVAL)
            }

            this.connections.set(server.id, {
                client,
                transport,
                tools,
                serverInfo: serverInfo as { name?: string; version?: string } | undefined,
                capabilities: capabilities as Record<string, unknown> | undefined,
                pingInterval
            })

            this.serverManager.updateConnectionStatus(server.id, true)

            /* Forward notifications from backend clients to inbound MCP clients */
            this.registerBackendNotifications(client)
        }
        catch (error) {
            try {
                await transport.close()
            }
            catch {
                /* Ignore close errors */
            }
            throw error
        }
    }

    private registerBackendNotifications (client: Client): void {
        /* Forward resource updated notifications to all active inbound sessions */
        client.setNotificationHandler(ResourceUpdatedNotificationSchema, async (notification) => {
            if (this.subscribedResources.has(notification.params.uri)) {
                for (const { server } of this.inboundSessions.values()) {
                    try {
                        await server.sendResourceUpdated({ uri: notification.params.uri })
                    }
                    catch (e) {
                        const msg = getErrorMessage(e)
                        logger.debug(`[${this.userId}] Failed to forward resource updated notification: ${msg}`)
                    }
                }
            }
        })

        /* Forward logging messages to all active inbound sessions (filtered by logLevel) */
        client.setNotificationHandler(LoggingMessageNotificationSchema, async (notification) => {
            const msgSeverity = LOG_LEVEL_SEVERITY[notification.params.level] ?? 0
            const threshold = LOG_LEVEL_SEVERITY[this.logLevel] ?? 3
            if (msgSeverity < threshold) return

            for (const { server } of this.inboundSessions.values()) {
                try {
                    await server.sendLoggingMessage(notification.params)
                }
                catch (e) {
                    const msg = getErrorMessage(e)
                    logger.debug(`[${this.userId}] Failed to forward logging message: ${msg}`)
                }
            }
        })
    }

    private createSSETransport (server: McpServerEntry): SSEClientTransport {
        if (!isUrlConfig(server.config)) throw new Error("SSE transport requires URL config")
        const url = new URL(server.config.url)
        const headers = server.config.headers || {}

        const options: Record<string, unknown> = {}

        if (Object.keys(headers).length > 0) {
            options.eventSourceInit = { headers }
            options.requestInit = { headers }
        }

        return new SSEClientTransport(url, options)
    }

    private createHTTPTransport (server: McpServerEntry): StreamableHTTPClientTransport {
        if (!isUrlConfig(server.config)) throw new Error("HTTP transport requires URL config")
        const url = new URL(server.config.url)
        const headers = server.config.headers || {}

        const options: Record<string, unknown> = {}

        if (Object.keys(headers).length > 0) {
            options.requestInit = { headers }
        }

        return new StreamableHTTPClientTransport(url, options)
    }

    private createStdioTransport (server: McpServerEntry): StdioClientTransport {
        if (!isStdioConfig(server.config)) throw new Error("Stdio transport requires command config")
        const config = server.config
        return new StdioClientTransport({
            command: config.command,
            args: config.args,
            env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
            cwd: config.cwd,
            stderr: "pipe"
        })
    }

    private getEnabledTools (serverId: string, tools: ToolWithServer[]): ToolWithServer[] {
        const disabled = new Set(this.serverManager.getDisabledTools(serverId))
        return tools.filter((t) => !disabled.has(t.name))
    }

    getAllToolsInternal (): ToolWithServer[] {
        const allTools: ToolWithServer[] = []
        for (const [serverId, conn] of this.connections.entries()) {
            allTools.push(...this.getEnabledTools(serverId, conn.tools))
        }
        return allTools
    }

    /* Returns the tools exposed to MCP clients (meta-tools only). */
    getExposedTools (): MetaTool[] {
        return getMetaTools(this.getAllToolsInternal().length)
    }

    private discoverTools (words: SearchWords, limit = 10) {
        const allTools = this.getAllToolsInternal()
        return searchTools(allTools, words, limit)
    }

    private getToolSchema (toolName: string) {
        const tool = this.getAllToolsInternal().find((t) => t.name === toolName)
        if (!tool) {
            return { error: `Tool not found: ${toolName}` }
        }
        return {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            server: tool._serverName
        }
    }

    async handleMetaToolCall (name: string, args: Record<string, unknown>): Promise<unknown> {
        switch (name) {
            case "mcp_discover_tools": {
                const tools = this.discoverTools(args.words as SearchWords, (args.limit as number) || 10)
                const resultText = tools.length > 0 ?
                    `Found ${tools.length} tools:\n${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}` :
                    "No tools found matching keywords. Try different or fewer keywords."
                return { content: [{ type: "text", text: resultText }] }
            }
            case "mcp_get_tool_schema":
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(this.getToolSchema(args.tool_name as string), null, 2)
                    }]
                }
            case "mcp_call_tool":
                return await this.callTool(args.tool_name as string, (args.arguments || {}) as Record<string, unknown>)
            default:
                throw new Error(`Unknown meta-tool: ${name}`)
        }
    }

    getServerTools (serverId: string): { tools: Array<{ name: string; description: string; disabled: boolean }>; disabledTools: string[]; connected: boolean; serverInfo?: unknown } {
        const conn = this.connections.get(serverId)
        if (!conn) {
            return { tools: [], disabledTools: [], connected: false }
        }

        const disabledToolsList = this.serverManager.getDisabledTools(serverId)
        const disabledToolsSet = new Set(disabledToolsList)
        const tools = conn.tools.map((t) => ({
            name: t.name,
            description: t.description,
            disabled: disabledToolsSet.has(t.name)
        }))

        return {
            tools,
            disabledTools: disabledToolsList,
            connected: true,
            serverInfo: conn.serverInfo
        }
    }

    private findToolServer (toolName: string): { serverId: string; tool: ToolWithServer; client: Client } | null {
        for (const [serverId, conn] of this.connections.entries()) {
            const tool = conn.tools.find((t) => t.name === toolName)
            if (tool) {
                return { serverId, tool, client: conn.client }
            }
        }
        return null
    }

    private async tryReconnectForTool (toolName: string): Promise<{ serverId: string; tool: ToolWithServer; client: Client } | null> {
        const servers = this.serverManager.getEnabledServers()

        for (const server of servers) {
            if (this.connections.has(server.id)) continue

            const state = this.reconnectState.get(server.id)
            if (state && state.attempts >= this.MAX_RECONNECT_ATTEMPTS) {
                const timeSinceLastAttempt = Date.now() - state.lastAttempt
                if (timeSinceLastAttempt < this.COOLDOWN_MS) {
                    continue
                }
            }

            logger.info(`[${this.userId}] Attempting on-demand reconnect to ${server.name} for tool: ${toolName}`)
            try {
                await this.reconnectServer(server.id)
                const found = this.findToolServer(toolName)
                if (found) {
                    logger.info(`[${this.userId}] Found tool ${toolName} after reconnecting ${server.name}`)
                    return found
                }
            }
            catch (e) {
                const msg = getErrorMessage(e)
                logger.debug(`[${this.userId}] On-demand reconnect failed for ${server.name}: ${msg}`)
            }
        }
        return null
    }

    private isSessionError (error: Error): boolean {
        const msg = (error.message || "").toLowerCase()
        return msg.includes("session")
               || msg.includes("no valid session")
               || msg.includes("session expired")
               || msg.includes("session not found")
               || msg.includes("connection closed")
               || msg.includes("stream disconnected")
               || msg.includes("terminated")
    }

    private scheduleReconnect (serverId: string): void {
        const server = this.serverManager.getServer(serverId)
        if (!server || !server.enabled) return

        let state = this.reconnectState.get(serverId)
        if (!state) {
            state = { attempts: 0, lastAttempt: 0, backoffMs: this.INITIAL_BACKOFF_MS, timeoutId: null }
            this.reconnectState.set(serverId, state)
        }

        if (state.attempts >= this.MAX_RECONNECT_ATTEMPTS) {
            const timeSinceLastAttempt = Date.now() - state.lastAttempt
            if (timeSinceLastAttempt < this.COOLDOWN_MS) {
                logger.debug(`[${this.userId}] MCP server ${server.name}: in cooldown, ${Math.round((this.COOLDOWN_MS - timeSinceLastAttempt) / 1000)}s remaining`)
                return
            }
            logger.info(`[${this.userId}] MCP server ${server.name}: cooldown expired, resetting reconnect attempts`)
            state.attempts = 0
            state.backoffMs = this.INITIAL_BACKOFF_MS
        }

        if (state.timeoutId) {
            logger.debug(`[${this.userId}] MCP server ${server.name}: reconnect already scheduled`)
            return
        }

        const backoff = Math.min(state.backoffMs, this.MAX_BACKOFF_MS)
        logger.info(`[${this.userId}] MCP server ${server.name}: scheduling reconnect in ${backoff / 1000}s (attempt ${state.attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`)

        state.timeoutId = setTimeout(async () => {
            state!.timeoutId = null
            state!.attempts++
            state!.lastAttempt = Date.now()
            state!.backoffMs = Math.min(state!.backoffMs * 2, this.MAX_BACKOFF_MS)

            try {
                await this.reconnectServer(serverId)
                this.reconnectState.delete(serverId)
                logger.info(`[${this.userId}] MCP server ${server.name}: reconnected successfully`)
            }
            catch (e) {
                const msg = getErrorMessage(e)
                logger.error(`[${this.userId}] MCP server ${server.name}: reconnect failed: ${msg}`)
                this.scheduleReconnect(serverId)
            }
        }, backoff)
    }

    private cancelReconnect (serverId: string): void {
        const state = this.reconnectState.get(serverId)
        if (state?.timeoutId) {
            clearTimeout(state.timeoutId)
            state.timeoutId = null
        }
        this.reconnectState.delete(serverId)
    }

    private async closeConnection (serverId: string): Promise<void> {
        const conn = this.connections.get(serverId)
        if (!conn) return

        /* Clean up resource ownership entries for this server */
        for (const [uri, owner] of this.resourceOwners.entries()) {
            if (owner === serverId)
                this.resourceOwners.delete(uri)
        }

        if (conn.pingInterval) {
            clearInterval(conn.pingInterval)
            conn.pingInterval = null
        }

        try {
            await conn.transport.close()
        }
        catch (e) {
            const msg = getErrorMessage(e)
            logger.debug(`[${this.userId}] Error closing transport for ${serverId}: ${msg}`)
        }

        if (conn.client && typeof conn.client.close === "function") {
            try {
                await conn.client.close()
            }
            catch (e) {
                const msg = getErrorMessage(e)
                logger.debug(`[${this.userId}] Error closing client for ${serverId}: ${msg}`)
            }
        }

        this.connections.delete(serverId)
    }

    async reconnectServer (serverId: string): Promise<void> {
        const server = this.serverManager.getServer(serverId)
        if (!server) {
            throw new Error(`Server not found: ${serverId}`)
        }

        logger.info(`[${this.userId}] Reconnecting MCP server: ${server.name}`)

        this.cancelReconnect(serverId)
        await this.closeConnection(serverId)
        await this.connectServer(server)
    }

    async disconnectServer (serverId: string): Promise<void> {
        this.cancelReconnect(serverId)
        await this.closeConnection(serverId)
    }

    async callTool (toolName: string, args: Record<string, unknown>, retryOnSessionError = true): Promise<unknown> {
        let found = this.findToolServer(toolName)

        if (!found) {
            found = await this.tryReconnectForTool(toolName)
            if (!found) {
                throw new Error(`Tool not found: ${toolName}`)
            }
        }

        const { client, serverId } = found

        try {
            const result = await client.callTool({
                name: toolName,
                arguments: args
            })
            return result as { content: Array<{ type: string; text?: string; [key: string]: unknown }> }
        }
        catch (error) {
            const msg = getErrorMessage(error)
            logger.error(`[${this.userId}] Tool call failed (${toolName}): ${msg}`)

            if (retryOnSessionError && error instanceof Error && this.isSessionError(error)) {
                logger.info(`[${this.userId}] Session error detected, attempting reconnection for tool: ${toolName}`)
                try {
                    await this.reconnectServer(serverId)
                    return await this.callTool(toolName, args, false)
                }
                catch (reconnectError) {
                    const rmsg = getErrorMessage(reconnectError)
                    logger.error(`[${this.userId}] Reconnection failed: ${rmsg}`)
                    throw error
                }
            }

            throw error
        }
    }

    private async getAllPrompts (): Promise<unknown[]> {
        const allPrompts: unknown[] = []
        for (const [serverId, conn] of this.connections.entries()) {
            const caps = conn.capabilities as Record<string, unknown> | undefined
            if (caps?.prompts) {
                try {
                    const result = await conn.client.listPrompts()
                    const prompts = (result.prompts || []).map((p) => ({
                        ...p,
                        _serverId: serverId,
                        _serverName: conn.serverInfo?.name
                    }))
                    allPrompts.push(...prompts)
                }
                catch (e) {
                    const msg = getErrorMessage(e)
                    logger.warn(`[${this.userId}] Failed to list prompts from ${conn.serverInfo?.name}: ${msg}`)
                }
            }
        }
        return allPrompts
    }

    private async getAllResources (): Promise<unknown[]> {
        const allResources: unknown[] = []
        for (const [serverId, conn] of this.connections.entries()) {
            const caps = conn.capabilities as Record<string, unknown> | undefined
            if (caps?.resources) {
                try {
                    const result = await conn.client.listResources()
                    const resources = (result.resources || []).map((r) => ({
                        ...r,
                        _serverId: serverId,
                        _serverName: conn.serverInfo?.name
                    }))
                    for (const r of resources) {
                        this.resourceOwners.set(r.uri, serverId)
                    }
                    allResources.push(...resources)
                }
                catch (e) {
                    const msg = getErrorMessage(e)
                    logger.warn(`[${this.userId}] Failed to list resources from ${conn.serverInfo?.name}: ${msg}`)
                }
            }
        }
        return allResources
    }

    async refresh (): Promise<void> {
        for (const serverId of this.reconnectState.keys()) {
            this.cancelReconnect(serverId)
        }
        for (const serverId of [...this.connections.keys()]) {
            await this.closeConnection(serverId)
        }
        await this.initialize()
    }

    getConnectionState (serverId: string, isConnected: boolean, isEnabled: boolean): "connected" | "reconnecting" | "failed" | "offline" {
        if (!isEnabled) return "offline"
        if (isConnected) return "connected"

        const state = this.reconnectState.get(serverId)
        if (!state) return "offline"

        if (state.timeoutId) return "reconnecting"

        if (state.attempts >= this.MAX_RECONNECT_ATTEMPTS) {
            const timeSinceLastAttempt = Date.now() - state.lastAttempt
            if (timeSinceLastAttempt < this.COOLDOWN_MS) {
                return "failed"
            }
            return "reconnecting"
        }

        if (state.attempts > 0) return "reconnecting"

        return "offline"
    }

    getStatus (): Array<{
        id: string; name: string; type: string; enabled: boolean; connected: boolean
        connectionState: string; reconnectAttempts: number; maxReconnectAttempts: number
        toolCount: number; serverInfo: unknown; lastConnected: string | null; lastError: string | null
    }> {
        const servers = this.serverManager.getServers()
        return servers.map((server) => {
            const conn = this.connections.get(server.id)
            const isConnected = !!conn
            const state = this.reconnectState.get(server.id)
            const connectionState = this.getConnectionState(server.id, isConnected, server.enabled)

            return {
                id: server.id,
                name: server.name,
                type: server.type,
                enabled: server.enabled,
                connected: isConnected,
                connectionState,
                reconnectAttempts: state?.attempts || 0,
                maxReconnectAttempts: this.MAX_RECONNECT_ATTEMPTS,
                toolCount: conn?.tools?.length || 0,
                serverInfo: conn?.serverInfo || null,
                lastConnected: server.lastConnected,
                lastError: server.lastError
            }
        })
    }

    isConnected (serverId: string): boolean {
        return this.connections.has(serverId)
    }

    async testConnection (serverConfig: { type: string; config: Record<string, unknown> }): Promise<{ success: boolean; serverInfo?: { name?: string; version?: string }; toolCount?: number; error?: string }> {
        const { type, config } = serverConfig
        let transport: SSEClientTransport | StreamableHTTPClientTransport | StdioClientTransport | undefined
        let client: Client | undefined

        try {
            const fakeServer = { type, config } as unknown as McpServerEntry
            switch (type) {
                case "sse":
                    transport = this.createSSETransport(fakeServer)
                    break
                case "http":
                    transport = this.createHTTPTransport(fakeServer)
                    break
                case "stdio":
                    transport = this.createStdioTransport(fakeServer)
                    break
                default:
                    return { success: false, error: `Unknown server type: ${type}` }
            }

            client = new Client(
                { name: "mcp-funnel-test", version: VERSION },
                { capabilities: {} }
            )

            const connectPromise = client.connect(transport)
            let timeoutHandle: ReturnType<typeof setTimeout>
            const timeoutPromise = new Promise<never>((_resolve, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error("Connection timeout (10s)")), 10000)
            })

            await Promise.race([connectPromise, timeoutPromise])
            clearTimeout(timeoutHandle!)

            const serverInfo = client.getServerVersion() as { name?: string; version?: string } | undefined
            const capabilities = client.getServerCapabilities() as Record<string, unknown> | undefined

            let toolCount = 0
            if (capabilities?.tools) {
                const toolsResult = await client.listTools()
                toolCount = toolsResult.tools?.length || 0
            }

            try {
                if (client && typeof client.close === "function") {
                    await client.close()
                }
            }
            catch {
                /* Ignore */
            }
            try {
                await transport.close()
            }
            catch {
                /* Ignore */
            }

            return {
                success: true,
                serverInfo: serverInfo || { name: "unknown", version: "?" },
                toolCount
            }
        }
        catch (error) {
            if (client && typeof client.close === "function") {
                try { await client.close() }
                catch { /* ignore */ }
            }
            if (transport) {
                try { await transport.close() }
                catch { /* ignore */ }
            }
            return {
                success: false,
                error: getErrorMessage(error)
            }
        }
    }

    getConnectedServerCount (): number {
        return this.connections.size
    }

    getTotalToolCount (): number {
        let total = 0
        for (const conn of this.connections.values()) {
            total += conn.tools.length
        }
        return total
    }

    getActiveToolCount (): number {
        let total = 0
        for (const [serverId, conn] of this.connections.entries()) {
            total += this.getEnabledTools(serverId, conn.tools).length
        }
        return total
    }
}

export { McpProxyService }
