/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (agentic coding with Claude Code) */

import crypto from "crypto"
import { Router, Request, Response } from "express"
import { OAuthStore } from "./oauth-store.js"
import { OAuthConfig } from "./oauth-config.js"
import { createAccessToken, getJwks } from "./oauth-token.js"
import { verifyPkceS256 } from "./pkce.js"
import { AuthManager } from "../mcp-funnel-auth.js"

function timingSafeEqual (a: string, b: string): boolean {
    const ha = crypto.createHash("sha256").update(a).digest()
    const hb = crypto.createHash("sha256").update(b).digest()
    return crypto.timingSafeEqual(ha, hb)
}

function escapeHtml (str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function createOAuthRoutes (config: OAuthConfig, store: OAuthStore, authManager: AuthManager): Router {
    const router = Router()

    /* RFC 9728 — Protected Resource Metadata */
    router.get("/.well-known/oauth-protected-resource", (_req: Request, res: Response) => {
        res.json({
            resource: config.issuer,
            authorization_servers: [config.issuer],
            bearer_methods_supported: ["header"],
            scopes_supported: ["mcp:full"]
        })
    })

    /* RFC 8414 — Authorization Server Metadata */
    router.get("/.well-known/oauth-authorization-server", (_req: Request, res: Response) => {
        res.json({
            issuer: config.issuer,
            authorization_endpoint: `${config.issuer}/oauth/authorize`,
            token_endpoint: `${config.issuer}/oauth/token`,
            registration_endpoint: `${config.issuer}/oauth/register`,
            jwks_uri: `${config.issuer}/.well-known/jwks.json`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
            token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
            code_challenge_methods_supported: ["S256"],
            scopes_supported: ["mcp:full"]
        })
    })

    /* JWK Set */
    router.get("/.well-known/jwks.json", async (_req: Request, res: Response) => {
        try {
            const jwks = await getJwks(config.dataDir)
            res.json(jwks)
        }
        catch {
            res.status(500).json({ error: "Failed to generate JWKS" })
        }
    })

    /* Dynamic Client Registration (RFC 7591) */
    router.post("/oauth/register", (req: Request, res: Response) => {
        const body = req.body || {}
        const clientName = body.client_name as string | undefined
        const redirectUris = body.redirect_uris as string[] | undefined
        const grantTypes = body.grant_types as string[] | undefined
        const responseTypes = body.response_types as string[] | undefined
        const scope = body.scope as string | undefined

        if (!clientName || !redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
            res.status(400).json({ error: "invalid_client_metadata", error_description: "client_name and redirect_uris required" })
            return
        }

        const client = store.registerClient({
            clientName,
            redirectUris,
            grantTypes,
            responseTypes,
            scope
        })

        res.status(201).json({
            client_id: client.clientId,
            client_secret: client.clientSecret,
            client_name: client.clientName,
            redirect_uris: client.redirectUris,
            grant_types: client.grantTypes,
            response_types: client.responseTypes,
            scope: client.scope
        })
    })

    /* Authorization Endpoint */
    router.get("/oauth/authorize", (req: Request, res: Response) => {
        const q = req.query as Record<string, string>
        const clientId = q.client_id
        const redirectUri = q.redirect_uri
        const responseType = q.response_type
        const scope = q.scope
        const state = q.state
        const codeChallenge = q.code_challenge
        const codeChallengeMethod = q.code_challenge_method

        if (responseType !== "code") {
            res.status(400).json({ error: "unsupported_response_type" })
            return
        }

        const client = store.getClient(clientId)
        if (!client) {
            res.status(400).json({ error: "invalid_client", error_description: "Unknown client_id" })
            return
        }

        if (!client.redirectUris.includes(redirectUri)) {
            res.status(400).json({ error: "invalid_request", error_description: "Invalid redirect_uri" })
            return
        }

        if (codeChallengeMethod !== "S256") {
            res.status(400).json({ error: "invalid_request", error_description: "code_challenge_method must be S256" })
            return
        }

        /* Render consent page */
        res.send(`<!DOCTYPE html>
<html>
<head><title>MCP-Funnel Authorization</title>
<style>body{font-family:system-ui;max-width:480px;margin:40px auto;padding:20px}
.btn{padding:10px 24px;border:none;border-radius:6px;cursor:pointer;font-size:14px}
.approve{background:#2563eb;color:white}.deny{background:#dc2626;color:white}
form{margin-top:20px}label{display:block;margin:8px 0}input{width:100%;padding:8px;box-sizing:border-box}</style>
</head>
<body>
<h2>Authorize ${escapeHtml(client.clientName)}</h2>
<p>This application is requesting access to your MCP-Funnel account.</p>
<p><strong>Scope:</strong> ${escapeHtml(scope || client.scope)}</p>
<form method="POST" action="/oauth/authorize">
<input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
<input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
<input type="hidden" name="scope" value="${escapeHtml(scope || client.scope)}">
<input type="hidden" name="state" value="${escapeHtml(state || "")}">
<input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
<input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}">
<label>Username<input type="text" name="username" required></label>
<label>Password<input type="password" name="password" required></label>
<br>
<button type="submit" name="action" value="approve" class="btn approve">Approve</button>
<button type="submit" name="action" value="deny" class="btn deny">Deny</button>
</form>
</body></html>`)
    })

    router.post("/oauth/authorize", async (req: Request, res: Response) => {
        try {
            const body = req.body
            const clientId = body.client_id as string
            const redirectUri = body.redirect_uri as string
            const scope = body.scope as string
            const state = body.state as string
            const codeChallenge = body.code_challenge as string
            const codeChallengeMethod = body.code_challenge_method as string
            const username = body.username as string
            const password = body.password as string
            const action = body.action as string

            if (action === "deny") {
                const redirectUrl = new URL(redirectUri)
                redirectUrl.searchParams.set("error", "access_denied")
                if (state) redirectUrl.searchParams.set("state", state)
                res.redirect(redirectUrl.toString())
                return
            }

            /* Authenticate user */
            const authResult = await authManager.validateCredentials(username, password)
            if (!authResult || !authResult.valid) {
                res.status(401).send("Invalid credentials. <a href=\"javascript:history.back()\">Try again</a>")
                return
            }

            const code = store.createAuthorizationCode(clientId, authResult.userId, redirectUri, scope || "mcp:full", codeChallenge, codeChallengeMethod)

            const redirectUrl = new URL(redirectUri)
            redirectUrl.searchParams.set("code", code)
            if (state) redirectUrl.searchParams.set("state", state)
            res.redirect(redirectUrl.toString())
        }
        catch {
            if (!res.headersSent) res.status(500).json({ error: "server_error" })
        }
    })

    /* Token Endpoint */
    router.post("/oauth/token", async (req: Request, res: Response) => {
        try {
            const body = req.body
            const grantType = body.grant_type as string
            const code = body.code as string
            const redirectUri = body.redirect_uri as string
            const clientId = body.client_id as string
            const clientSecret = body.client_secret as string | undefined
            const codeVerifier = body.code_verifier as string | undefined
            const refreshToken = body.refresh_token as string | undefined

            if (grantType === "authorization_code") {
                const authCode = store.consumeAuthorizationCode(code)
                if (!authCode) {
                    res.status(400).json({ error: "invalid_grant", error_description: "Invalid or expired authorization code" })
                    return
                }

                if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
                    res.status(400).json({ error: "invalid_grant", error_description: "Client/redirect mismatch" })
                    return
                }

                /* Verify PKCE */
                if (!codeVerifier || !verifyPkceS256(codeVerifier, authCode.codeChallenge)) {
                    res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" })
                    return
                }

                /* Optionally verify client_secret */
                const client = store.getClient(clientId)
                if (client?.clientSecret && clientSecret && !timingSafeEqual(client.clientSecret, clientSecret)) {
                    res.status(401).json({ error: "invalid_client" })
                    return
                }

                const accessToken = await createAccessToken(
                    config.dataDir, config.issuer, authCode.userId,
                    config.issuer, authCode.scope, config.tokenLifetime
                )
                const newRefreshToken = store.createRefreshToken(clientId, authCode.userId, authCode.scope, config.refreshTokenLifetime)

                res.json({
                    access_token: accessToken,
                    token_type: "Bearer",
                    expires_in: config.tokenLifetime,
                    refresh_token: newRefreshToken,
                    scope: authCode.scope
                })
            }
            else if (grantType === "client_credentials") {
                if (!clientId || !clientSecret) {
                    res.status(400).json({ error: "invalid_request", error_description: "client_id and client_secret required for client_credentials" })
                    return
                }

                const client = store.getClient(clientId)
                if (!client || !client.clientSecret || !timingSafeEqual(client.clientSecret, clientSecret)) {
                    res.status(401).json({ error: "invalid_client" })
                    return
                }

                if (!client.grantTypes.includes("client_credentials")) {
                    res.status(400).json({ error: "unauthorized_client", error_description: "Client not authorized for client_credentials grant" })
                    return
                }

                /* Map client to its owner userId — look up via authManager */
                const userId = store.getClientOwner(clientId) || `client:${clientId}`

                const scope = body.scope as string || client.scope
                const accessToken = await createAccessToken(
                    config.dataDir, config.issuer, userId,
                    config.issuer, scope, config.tokenLifetime
                )

                res.json({
                    access_token: accessToken,
                    token_type: "Bearer",
                    expires_in: config.tokenLifetime,
                    scope
                })
            }
            else if (grantType === "refresh_token") {
                const rt = store.consumeRefreshToken(refreshToken || "")
                if (!rt) {
                    res.status(400).json({ error: "invalid_grant", error_description: "Invalid or expired refresh token" })
                    return
                }

                if (rt.clientId !== clientId) {
                    res.status(400).json({ error: "invalid_grant", error_description: "Client mismatch" })
                    return
                }

                const accessToken = await createAccessToken(
                    config.dataDir, config.issuer, rt.userId,
                    config.issuer, rt.scope, config.tokenLifetime
                )
                const newRefreshToken = store.createRefreshToken(clientId, rt.userId, rt.scope, config.refreshTokenLifetime)

                res.json({
                    access_token: accessToken,
                    token_type: "Bearer",
                    expires_in: config.tokenLifetime,
                    refresh_token: newRefreshToken,
                    scope: rt.scope
                })
            }
            else {
                res.status(400).json({ error: "unsupported_grant_type" })
            }
        }
        catch {
            if (!res.headersSent) res.status(500).json({ error: "server_error" })
        }
    })

    return router
}

export { createOAuthRoutes }
