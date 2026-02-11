/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import express from "express"
import session from "express-session"
import connectSessionFileStore from "session-file-store"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import path from "path"
import { McpFunnelConfig } from "./mcp-funnel-config.js"
import { AuthManager } from "./mcp-funnel-auth.js"
import { UserManager } from "./mcp-funnel-users.js"
import { createSessionAuth } from "./middleware/session-auth.js"
import { createSingleUserAuth } from "./middleware/single-user-auth.js"
import { StatsManager } from "./mcp-funnel-stats.js"
import { createAuthRoutes } from "./routes/auth-routes.js"
import { createDashboardRoutes } from "./routes/dashboard-routes.js"
import { createUserRoutes } from "./routes/user-routes.js"
import { createMcpRoutes } from "./routes/mcp-routes.js"
import { createSettingsRoutes } from "./routes/settings-routes.js"
import { UserProxyManager } from "./user-proxy-manager.js"
import { createMcpProxyRoutes } from "./routes/mcp-proxy-routes.js"
import logger from "./mcp-funnel-log.js"
import { getErrorMessage } from "./utils.js"

const FileStore = connectSessionFileStore(session)

function createApp (config: McpFunnelConfig): { app: express.Application, statsManager: StatsManager, userProxyManager: UserProxyManager } {
    const app = express()

    const authManager = new AuthManager(config.dataDir)
    const userManager = new UserManager(authManager)
    const statsManager = new StatsManager(config.dataDir)
    const userProxyManager = new UserProxyManager(config.dataDir, statsManager)

    /* Auto-create admin from env vars if needed */
    if (config.adminUser && config.adminPass && authManager.isSetupRequired()) {
        authManager.setupAdmin(config.adminUser, config.adminPass)
            .then(() => logger.info(`Admin auto-created from environment: ${config.adminUser}`))
            .catch((err) => logger.error(`Failed to auto-create admin: ${getErrorMessage(err)}`))
    }

    /* Trust proxy */
    app.set("trust proxy", 1)

    /* Security headers */
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "https://cdn.jsdelivr.net"],
                scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://rsms.me"],
                fontSrc: ["'self'", "https://cdn.jsdelivr.net", "https://rsms.me", "data:"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: []
            }
        },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        frameguard: { action: "deny" },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    }))

    /* Body parsing */
    app.use(express.json({ limit: "10mb" }))
    app.use(express.urlencoded({ extended: true }))
    app.use(cookieParser())

    /* Middleware factories — single-user bypasses all auth */
    let requireAuth: ReturnType<typeof createSessionAuth>["requireAuth"]
    let requireAdmin: ReturnType<typeof createSessionAuth>["requireAdmin"]
    let checkSetup: ReturnType<typeof createSessionAuth>["checkSetup"]

    if (config.singleUser) {
        /* Minimal session middleware for single-user (in-memory, no file store) */
        app.use(session({
            secret: config.sessionSecret,
            resave: false,
            saveUninitialized: false,
            cookie: { secure: false, httpOnly: true, sameSite: "strict" }
        }))

        const singleUserAuth = createSingleUserAuth()
        requireAuth = singleUserAuth.requireAuth
        requireAdmin = singleUserAuth.requireAdmin
        checkSetup = singleUserAuth.checkSetup
    }
    else {
        /* Session middleware with file store */
        const sessionsPath = path.join(config.dataDir, "sessions")
        app.use(session({
            store: new FileStore({
                path: sessionsPath,
                ttl: config.sessionMaxAge / 1000,
                retries: 0
            }),
            secret: config.sessionSecret,
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: config.nodeEnv === "production",
                httpOnly: true,
                sameSite: "strict",
                maxAge: config.sessionMaxAge
            }
        }))

        const sessionAuth = createSessionAuth(authManager)
        requireAuth = sessionAuth.requireAuth
        requireAdmin = sessionAuth.requireAdmin
        checkSetup = sessionAuth.checkSetup
    }

    /* Setup check — redirect to /setup if no admin exists (or to /dashboard in single-user) */
    app.use(checkSetup)

    /* Request logging */
    app.use((req, _res, next) => {
        logger.info(`${req.method} ${req.path}`)
        next()
    })

    /* Disable caching */
    app.use((_req, res, next) => {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, private")
        res.set("Pragma", "no-cache")
        res.set("Expires", "0")
        next()
    })

    /* Health check */
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString() })
    })

    /* Root redirect */
    app.get("/", (_req, res) => {
        res.redirect("/dashboard")
    })

    /* Mount routes */
    app.use("/", createAuthRoutes(authManager))
    app.use("/dashboard", requireAuth, createDashboardRoutes(authManager, statsManager))
    app.use("/users", requireAuth, requireAdmin, createUserRoutes(userManager, statsManager))
    app.use("/mcp-servers", requireAuth, createMcpRoutes(userProxyManager))
    app.use("/settings", requireAuth, createSettingsRoutes(authManager))

    /* MCP protocol endpoint (API key authenticated, or bypassed in single-user mode) */
    app.use("/mcp", createMcpProxyRoutes(userProxyManager, authManager, statsManager, config.singleUser))

    /* 404 */
    app.use((req, res) => {
        logger.warn(`404: ${req.method} ${req.path}`)
        res.status(404).json({ error: "Not Found", path: req.path })
    })

    return { app, statsManager, userProxyManager }
}

export { createApp }
