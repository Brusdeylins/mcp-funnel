// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import logger from "./mcp-funnel-log.js"
import { McpServerManager, McpServerEntry } from "./mcp-server-manager.js"
import { isMetaTool, getMetaTools, searchTools, META_TOOLS } from "./mcp-meta-tools.js"
import type { SearchWords, ToolWithServer } from "./mcp-meta-tools.js"

interface ServerConnection {
    client: Client
    transport: SSEClientTransport | StreamableHTTPClientTransport
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

interface JsonRpcRequest {
    jsonrpc: string
    id?: string | number | null
    method: string
    params?: Record<string, unknown>
}

interface JsonRpcResponse {
    jsonrpc: string
    id?: string | number | null
    result?: unknown
    error?: { code: number; message: string }
}

class McpProxyService {
    private connections: Map<string, ServerConnection>
    private reconnectState: Map<string, ReconnectState>
    private serverManager: McpServerManager
    private userId: string

    private readonly PING_INTERVAL = 30000
    private readonly MAX_RECONNECT_ATTEMPTS = 5
    private readonly INITIAL_BACKOFF_MS = 5000
    private readonly MAX_BACKOFF_MS = 300000
    private readonly COOLDOWN_MS = 600000

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
                const msg = error instanceof Error ? error.message : String(error)
                logger.error(`[${this.userId}] Failed to connect to MCP server ${server.name}: ${msg}`)
                this.serverManager.updateConnectionStatus(server.id, false, msg)
            }
        }
    }

    async shutdown (): Promise<void> {
        logger.info(`[${this.userId}] Shutting down MCP proxy`)
        for (const serverId of this.reconnectState.keys()) {
            this.cancelReconnect(serverId)
        }
        for (const serverId of [...this.connections.keys()]) {
            await this.closeConnection(serverId)
        }
    }

    async connectServer (server: McpServerEntry): Promise<void> {
        logger.info(`[${this.userId}] Connecting to MCP server: ${server.name} (${server.type})`)

        let transport: SSEClientTransport | StreamableHTTPClientTransport

        switch (server.type) {
            case "sse":
                transport = this.createSSETransport(server)
                break
            case "http":
                transport = this.createHTTPTransport(server)
                break
            default:
                throw new Error(`Unknown server type: ${server.type}`)
        }

        const client = new Client(
            { name: "mcp-funnel", version: "1.0.0" },
            { capabilities: {} }
        )

        transport.onerror = (error: Error) => {
            const msg = error.message || ""

            if (msg.includes("Failed to open SSE stream")
                || msg.includes("SSE stream disconnected")
                || msg.includes("SSE")
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
                tools = (toolsResult.tools || []).map(tool => ({
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
                        const msg = err instanceof Error ? err.message : String(err)
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
        }
        catch (error) {
            try {
                await transport.close()
            }
            catch {
                // Ignore close errors
            }
            throw error
        }
    }

    private createSSETransport (server: McpServerEntry): SSEClientTransport {
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
        const url = new URL(server.config.url)
        const headers = server.config.headers || {}

        const options: Record<string, unknown> = {}

        if (Object.keys(headers).length > 0) {
            options.requestInit = { headers }
        }

        return new StreamableHTTPClientTransport(url, options)
    }

    getAllToolsInternal (): ToolWithServer[] {
        const allTools: ToolWithServer[] = []
        for (const [serverId, conn] of this.connections.entries()) {
            const disabledTools = this.serverManager.getDisabledTools(serverId)
            const enabledTools = conn.tools.filter(t => !disabledTools.includes(t.name))
            allTools.push(...enabledTools)
        }
        return allTools
    }

    getAllTools (): typeof META_TOOLS {
        return getMetaTools()
    }

    private discoverTools (words: SearchWords, limit = 10) {
        const allTools = this.getAllToolsInternal()
        return searchTools(allTools, words, limit)
    }

    private getToolSchema (toolName: string) {
        const tool = this.getAllToolsInternal().find(t => t.name === toolName)
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
                    `Found ${tools.length} tools:\n${tools.map(t => `- ${t.name}: ${t.description}`).join("\n")}` :
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

        const disabledTools = this.serverManager.getDisabledTools(serverId)
        const tools = conn.tools.map(t => ({
            name: t.name,
            description: t.description,
            disabled: disabledTools.includes(t.name)
        }))

        return {
            tools,
            disabledTools,
            connected: true,
            serverInfo: conn.serverInfo
        }
    }

    private findToolServer (toolName: string): { serverId: string; tool: ToolWithServer; client: Client } | null {
        for (const [serverId, conn] of this.connections.entries()) {
            const tool = conn.tools.find(t => t.name === toolName)
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
                const msg = e instanceof Error ? e.message : String(e)
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
                const msg = e instanceof Error ? e.message : String(e)
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

        if (conn.pingInterval) {
            clearInterval(conn.pingInterval)
            conn.pingInterval = null
        }

        try {
            await conn.transport.close()
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            logger.debug(`[${this.userId}] Error closing transport for ${serverId}: ${msg}`)
        }

        if (conn.client && typeof conn.client.close === "function") {
            try {
                await conn.client.close()
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
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
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`[${this.userId}] Tool call failed (${toolName}): ${msg}`)

            if (retryOnSessionError && error instanceof Error && this.isSessionError(error)) {
                logger.info(`[${this.userId}] Session error detected, attempting reconnection for tool: ${toolName}`)
                try {
                    await this.reconnectServer(serverId)
                    return await this.callTool(toolName, args, false)
                }
                catch (reconnectError) {
                    const rmsg = reconnectError instanceof Error ? reconnectError.message : String(reconnectError)
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
                    const prompts = (result.prompts || []).map(p => ({
                        ...p,
                        _serverId: serverId,
                        _serverName: conn.serverInfo?.name
                    }))
                    allPrompts.push(...prompts)
                }
                catch (e) {
                    const msg = e instanceof Error ? e.message : String(e)
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
                    const resources = (result.resources || []).map(r => ({
                        ...r,
                        _serverId: serverId,
                        _serverName: conn.serverInfo?.name
                    }))
                    allResources.push(...resources)
                }
                catch (e) {
                    const msg = e instanceof Error ? e.message : String(e)
                    logger.warn(`[${this.userId}] Failed to list resources from ${conn.serverInfo?.name}: ${msg}`)
                }
            }
        }
        return allResources
    }

    async handleRequest (request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
        const { method, params, id } = request

        try {
            switch (method) {
                case "initialize":
                    return {
                        jsonrpc: "2.0",
                        id,
                        result: {
                            protocolVersion: "2024-11-05",
                            capabilities: {
                                tools: { listChanged: false },
                                prompts: { listChanged: false },
                                resources: { listChanged: false }
                            },
                            serverInfo: { name: "mcp-funnel", version: "1.0.0" }
                        }
                    }

                case "notifications/initialized":
                    return null

                case "tools/list":
                    return {
                        jsonrpc: "2.0",
                        id,
                        result: { tools: this.getAllTools() }
                    }

                case "tools/call": {
                    const p = params as { name: string; arguments?: Record<string, unknown> } | undefined
                    let toolResult
                    if (p && isMetaTool(p.name)) {
                        toolResult = await this.handleMetaToolCall(p.name, p.arguments || {})
                    }
                    else if (p) {
                        toolResult = await this.callTool(p.name, p.arguments || {})
                    }
                    else {
                        throw new Error("Missing tool name in params")
                    }
                    return {
                        jsonrpc: "2.0",
                        id,
                        result: toolResult
                    }
                }

                case "prompts/list": {
                    const prompts = await this.getAllPrompts()
                    return {
                        jsonrpc: "2.0",
                        id,
                        result: { prompts }
                    }
                }

                case "prompts/get": {
                    for (const conn of this.connections.values()) {
                        const caps = conn.capabilities as Record<string, unknown> | undefined
                        if (caps?.prompts) {
                            try {
                                const result = await conn.client.getPrompt(params as { name: string; arguments?: Record<string, string> })
                                return { jsonrpc: "2.0", id, result }
                            }
                            catch {
                            // Try next server
                            }
                        }
                    }
                    return {
                        jsonrpc: "2.0",
                        id,
                        error: { code: -32602, message: `Prompt not found: ${(params as { name?: string })?.name}` }
                    }
                }

                case "resources/list": {
                    const resources = await this.getAllResources()
                    return {
                        jsonrpc: "2.0",
                        id,
                        result: { resources }
                    }
                }

                case "resources/read": {
                    for (const conn of this.connections.values()) {
                        const caps = conn.capabilities as Record<string, unknown> | undefined
                        if (caps?.resources) {
                            try {
                                const result = await conn.client.readResource(params as { uri: string })
                                return { jsonrpc: "2.0", id, result }
                            }
                            catch {
                            // Try next server
                            }
                        }
                    }
                    return {
                        jsonrpc: "2.0",
                        id,
                        error: { code: -32602, message: `Resource not found: ${(params as { uri?: string })?.uri}` }
                    }
                }

                case "ping":
                    return {
                        jsonrpc: "2.0",
                        id,
                        result: {}
                    }

                default:
                    return {
                        jsonrpc: "2.0",
                        id,
                        error: { code: -32601, message: `Method not found: ${method}` }
                    }
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            return {
                jsonrpc: "2.0",
                id,
                error: { code: -32000, message: msg }
            }
        }
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
        return servers.map(server => {
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

    async testConnection (serverConfig: { type: string; config: { url: string; headers?: Record<string, string> } }): Promise<{ success: boolean; serverInfo?: { name?: string; version?: string }; toolCount?: number; error?: string }> {
        const { type, config } = serverConfig
        let transport: SSEClientTransport | StreamableHTTPClientTransport | undefined
        let client: Client | undefined

        try {
            const fakeServer = { type, config } as McpServerEntry
            switch (type) {
                case "sse":
                    transport = this.createSSETransport(fakeServer)
                    break
                case "http":
                    transport = this.createHTTPTransport(fakeServer)
                    break
                default:
                    return { success: false, error: `Unknown server type: ${type}` }
            }

            client = new Client(
                { name: "mcp-funnel-test", version: "1.0.0" },
                { capabilities: {} }
            )

            const connectPromise = client.connect(transport)
            const timeoutPromise = new Promise<never>((_resolve, reject) =>
                setTimeout(() => reject(new Error("Connection timeout (10s)")), 10000)
            )

            await Promise.race([connectPromise, timeoutPromise])

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
                // Ignore
            }
            try {
                await transport.close()
            }
            catch {
                // Ignore
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
                catch { /* Ignore */ }
            }
            if (transport) {
                try { await transport.close() }
                catch { /* Ignore */ }
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
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
            const disabledTools = this.serverManager.getDisabledTools(serverId)
            total += conn.tools.filter(t => !disabledTools.includes(t.name)).length
        }
        return total
    }
}

export { McpProxyService }
export type { JsonRpcRequest, JsonRpcResponse }
export type { META_TOOLS }
