import express from "express"
import session from "express-session"
import connectSessionFileStore from "session-file-store"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import path from "path"
import { McpFunnelConfig } from "./mcp-funnel-config"
import { AuthManager } from "./mcp-funnel-auth"
import { UserManager } from "./mcp-funnel-users"
import { createSessionAuth } from "./middleware/session-auth"
import { createApiKeyAuth } from "./middleware/api-key-auth"
import { createAuthRoutes } from "./routes/auth-routes"
import { createDashboardRoutes } from "./routes/dashboard-routes"
import { createUserRoutes } from "./routes/user-routes"
import { createMcpRoutes } from "./routes/mcp-routes"
import { createSettingsRoutes } from "./routes/settings-routes"
import logger from "./mcp-funnel-log"

const FileStore = connectSessionFileStore(session)

function createApp (config: McpFunnelConfig): express.Application {
    const app = express()

    const authManager = new AuthManager(config.dataDir)
    const userManager = new UserManager(authManager)

    // Auto-create admin from env vars if needed
    if (config.adminUser && config.adminPass && authManager.isSetupRequired()) {
        authManager.setupAdmin(config.adminUser, config.adminPass)
            .then(() => logger.info(`Admin auto-created from environment: ${config.adminUser}`))
            .catch(err => logger.error(`Failed to auto-create admin: ${err instanceof Error ? err.message : String(err)}`))
    }

    // Trust proxy
    app.set("trust proxy", true)

    // Security headers
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

    // Body parsing
    app.use(express.json({ limit: "10mb" }))
    app.use(express.urlencoded({ extended: true }))
    app.use(cookieParser())

    // Session middleware
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
            secure: false,
            httpOnly: true,
            maxAge: config.sessionMaxAge
        }
    }))

    // Middleware factories
    const { requireAuth, requireAdmin, checkSetup } = createSessionAuth(authManager)
    const { requireApiKey } = createApiKeyAuth(authManager)

    // Setup check — redirect to /setup if no admin exists
    app.use(checkSetup)

    // Request logging
    app.use((req, _res, next) => {
        logger.info(`${req.method} ${req.path}`)
        next()
    })

    // Disable caching
    app.use((_req, res, next) => {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, private")
        res.set("Pragma", "no-cache")
        res.set("Expires", "0")
        next()
    })

    // Health check
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", timestamp: new Date().toISOString() })
    })

    // Root redirect
    app.get("/", (_req, res) => {
        res.redirect("/dashboard")
    })

    // Mount routes
    app.use("/", createAuthRoutes(authManager))
    app.use("/dashboard", requireAuth, createDashboardRoutes(authManager, config))
    app.use("/users", requireAuth, requireAdmin, createUserRoutes(userManager))
    app.use("/mcp-servers", requireAuth, createMcpRoutes())
    app.use("/settings", requireAuth, createSettingsRoutes(authManager))

    // API key auth for future MCP endpoints (placeholder)
    app.use("/api/mcp", requireApiKey, (_req, res) => {
        res.json({ message: "MCP API endpoint — coming soon" })
    })

    // 404
    app.use((req, res) => {
        logger.warn(`404: ${req.method} ${req.path}`)
        res.status(404).json({ error: "Not Found", path: req.path })
    })

    return app
}

export { createApp }
