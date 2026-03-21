/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (agentic coding with Claude Code) */

import crypto from "crypto"
import logger from "../mcp-funnel-log.js"
import { getErrorMessage } from "../utils.js"

interface OAuthServerMetadata {
    issuer: string
    authorization_endpoint: string
    token_endpoint: string
    registration_endpoint?: string
    jwks_uri?: string
    grant_types_supported?: string[]
    code_challenge_methods_supported?: string[]
    scopes_supported?: string[]
}

/* Alias for BackendOAuthState (from mcp-server-manager) with typed metadata */
interface BackendOAuthConfig {
    serverUrl: string
    clientId?: string
    clientSecret?: string
    scope?: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    metadata?: OAuthServerMetadata
}

async function discoverOAuthMetadata (serverUrl: string): Promise<OAuthServerMetadata> {
    /* Try .well-known/oauth-authorization-server first */
    const baseUrl = serverUrl.replace(/\/+$/, "")
    const metadataUrls = [
        `${baseUrl}/.well-known/oauth-authorization-server`,
        `${baseUrl}/.well-known/openid-configuration`
    ]

    for (const url of metadataUrls) {
        try {
            const response = await fetch(url)
            if (response.ok) {
                const metadata = await response.json() as OAuthServerMetadata
                if (metadata.token_endpoint && metadata.authorization_endpoint) {
                    logger.info(`OAuth metadata discovered from ${url}`)
                    return metadata
                }
            }
        }
        catch {
            /* Try next URL */
        }
    }

    throw new Error(`No OAuth metadata found at ${baseUrl}`)
}

async function registerOAuthClient (metadata: OAuthServerMetadata, clientName: string, redirectUri: string): Promise<{ clientId: string; clientSecret?: string }> {
    if (!metadata.registration_endpoint) {
        throw new Error("Backend does not support dynamic client registration")
    }

    const response = await fetch(metadata.registration_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_name: clientName,
            redirect_uris: [redirectUri],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none"
        })
    })

    if (!response.ok) {
        const err = await response.text()
        throw new Error(`Client registration failed: ${err}`)
    }

    const data = await response.json() as { client_id: string; client_secret?: string }
    return { clientId: data.client_id, clientSecret: data.client_secret }
}

function generatePkceChallenge (): { verifier: string; challenge: string } {
    const verifier = crypto.randomBytes(32).toString("base64url")
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url")
    return { verifier, challenge }
}

function buildAuthorizationUrl (metadata: OAuthServerMetadata, clientId: string, redirectUri: string, scope: string, state: string, codeChallenge: string): string {
    const url = new URL(metadata.authorization_endpoint)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("client_id", clientId)
    url.searchParams.set("redirect_uri", redirectUri)
    url.searchParams.set("scope", scope)
    url.searchParams.set("state", state)
    url.searchParams.set("code_challenge", codeChallenge)
    url.searchParams.set("code_challenge_method", "S256")
    return url.toString()
}

/* Shared token endpoint request */
async function tokenRequest (tokenEndpoint: string, body: Record<string, string>, errorLabel: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number; scope?: string }> {
    const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString()
    })

    if (!response.ok) {
        const err = await response.text()
        throw new Error(`${errorLabel}: ${err}`)
    }

    const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number; scope?: string }
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        scope: data.scope
    }
}

async function exchangeCodeForToken (metadata: OAuthServerMetadata, clientId: string, code: string, redirectUri: string, codeVerifier: string, clientSecret?: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number; scope?: string }> {
    const body: Record<string, string> = {
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
    }
    if (clientSecret) body.client_secret = clientSecret
    return tokenRequest(metadata.token_endpoint, body, "Token exchange failed")
}

async function refreshAccessToken (metadata: OAuthServerMetadata, clientId: string, refreshToken: string, clientSecret?: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    const body: Record<string, string> = {
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: refreshToken
    }
    if (clientSecret) body.client_secret = clientSecret
    return tokenRequest(metadata.token_endpoint, body, "Token refresh failed")
}

async function ensureValidToken (oauth: BackendOAuthConfig, onUpdate: (oauth: BackendOAuthConfig) => void): Promise<string | undefined> {
    if (!oauth.accessToken) return undefined

    /* Token still valid (with 60s buffer) */
    if (oauth.expiresAt && Date.now() < (oauth.expiresAt - 60000)) {
        return oauth.accessToken
    }

    /* Try refresh */
    if (oauth.refreshToken && oauth.metadata && oauth.clientId) {
        try {
            logger.info("Refreshing backend OAuth token")
            const result = await refreshAccessToken(
                oauth.metadata, oauth.clientId, oauth.refreshToken, oauth.clientSecret
            )
            oauth.accessToken = result.accessToken
            if (result.refreshToken) oauth.refreshToken = result.refreshToken
            oauth.expiresAt = Date.now() + result.expiresIn * 1000
            onUpdate(oauth)
            return oauth.accessToken
        }
        catch (err) {
            logger.warn(`Failed to refresh backend OAuth token: ${getErrorMessage(err)}`)
        }
    }

    /* Token expired and can't refresh */
    return oauth.accessToken
}

export {
    discoverOAuthMetadata, registerOAuthClient,
    generatePkceChallenge, buildAuthorizationUrl,
    exchangeCodeForToken, refreshAccessToken, ensureValidToken
}
export type { OAuthServerMetadata, BackendOAuthConfig }
