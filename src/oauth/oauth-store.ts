/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import fs from "fs"
import path from "path"
import crypto from "crypto"

interface OAuthClient {
    clientId: string
    clientSecret?: string
    clientName: string
    redirectUris: string[]
    grantTypes: string[]
    responseTypes: string[]
    scope: string
    createdAt: number
}

interface AuthorizationCode {
    code: string
    clientId: string
    userId: string
    redirectUri: string
    scope: string
    codeChallenge: string
    codeChallengeMethod: string
    expiresAt: number
}

interface RefreshToken {
    token: string
    clientId: string
    userId: string
    scope: string
    expiresAt: number
}

class OAuthStore {
    private dataDir: string
    private clients = new Map<string, OAuthClient>()
    private codes = new Map<string, AuthorizationCode>()
    private refreshTokens = new Map<string, RefreshToken>()

    constructor (dataDir: string) {
        this.dataDir = path.join(dataDir, "oauth")
        fs.mkdirSync(this.dataDir, { recursive: true })
        this.loadClients()
    }

    private clientsFile (): string {
        return path.join(this.dataDir, "clients.json")
    }

    private loadClients (): void {
        try {
            if (fs.existsSync(this.clientsFile())) {
                const data = JSON.parse(fs.readFileSync(this.clientsFile(), "utf8"))
                for (const c of data) {
                    this.clients.set(c.clientId, c)
                }
            }
        }
        catch { /* ignore */ }
    }

    private saveClients (): void {
        fs.writeFileSync(this.clientsFile(), JSON.stringify([...this.clients.values()], null, 2))
    }

    registerClient (params: { clientName: string; redirectUris: string[]; grantTypes?: string[]; responseTypes?: string[]; scope?: string }): OAuthClient {
        const clientId = crypto.randomUUID()
        const clientSecret = crypto.randomBytes(32).toString("hex")
        const client: OAuthClient = {
            clientId,
            clientSecret,
            clientName: params.clientName,
            redirectUris: params.redirectUris,
            grantTypes: params.grantTypes || ["authorization_code", "refresh_token"],
            responseTypes: params.responseTypes || ["code"],
            scope: params.scope || "mcp:full",
            createdAt: Date.now()
        }
        this.clients.set(clientId, client)
        this.saveClients()
        return client
    }

    getClient (clientId: string): OAuthClient | undefined {
        return this.clients.get(clientId)
    }

    createAuthorizationCode (clientId: string, userId: string, redirectUri: string, scope: string, codeChallenge: string, codeChallengeMethod: string): string {
        const code = crypto.randomBytes(32).toString("hex")
        this.codes.set(code, {
            code,
            clientId,
            userId,
            redirectUri,
            scope,
            codeChallenge,
            codeChallengeMethod,
            expiresAt: Date.now() + 600000
        })
        return code
    }

    consumeAuthorizationCode (code: string): AuthorizationCode | undefined {
        const entry = this.codes.get(code)
        if (!entry) return undefined
        this.codes.delete(code)
        if (Date.now() > entry.expiresAt) return undefined
        return entry
    }

    createRefreshToken (clientId: string, userId: string, scope: string, lifetime: number): string {
        const token = crypto.randomBytes(32).toString("hex")
        this.refreshTokens.set(token, {
            token,
            clientId,
            userId,
            scope,
            expiresAt: Date.now() + lifetime * 1000
        })
        return token
    }

    consumeRefreshToken (token: string): RefreshToken | undefined {
        const entry = this.refreshTokens.get(token)
        if (!entry) return undefined
        this.refreshTokens.delete(token)
        if (Date.now() > entry.expiresAt) return undefined
        return entry
    }
}

export { OAuthStore, OAuthClient, AuthorizationCode, RefreshToken }
