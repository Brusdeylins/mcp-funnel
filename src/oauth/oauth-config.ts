/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (agentic coding with Claude Code) */

interface OAuthConfig {
    issuer: string
    tokenLifetime: number
    refreshTokenLifetime: number
    authMode: "both" | "oauth" | "legacy"
    dataDir: string
}

function loadOAuthConfig (dataDir: string, baseUrl: string): OAuthConfig {
    return {
        issuer: process.env["OAUTH_ISSUER"] || baseUrl,
        tokenLifetime: parseInt(process.env["OAUTH_TOKEN_LIFETIME"] || "3600", 10),
        refreshTokenLifetime: parseInt(process.env["OAUTH_REFRESH_TOKEN_LIFETIME"] || "86400", 10),
        authMode: (process.env["AUTH_MODE"] as OAuthConfig["authMode"]) || "both",
        dataDir
    }
}

export { OAuthConfig, loadOAuthConfig }
