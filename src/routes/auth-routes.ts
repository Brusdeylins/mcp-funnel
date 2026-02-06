import { Router, Request, Response } from "express"
import { AuthManager } from "../mcp-funnel-auth"
import { renderSetupPage } from "../views/setup-view"
import { renderLoginPage } from "../views/login-view"
import logger from "../mcp-funnel-log"

function createAuthRoutes (authManager: AuthManager): Router {
    const router = Router()

    // GET /setup
    router.get("/setup", (_req: Request, res: Response) => {
        if (!authManager.isSetupRequired()) {
            res.redirect("/login")
            return
        }
        res.send(renderSetupPage())
    })

    // POST /setup
    router.post("/setup", async (req: Request, res: Response) => {
        try {
            if (!authManager.isSetupRequired()) {
                res.status(400).json({ error: "Setup already completed" })
                return
            }

            const { username, password } = req.body as { username: string, password: string }
            if (!username || !password) {
                res.status(400).json({ error: "Username and password required" })
                return
            }

            await authManager.setupAdmin(username, password)
            logger.info("Initial setup completed successfully")
            res.json({ success: true, message: "Setup completed" })
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`Setup failed: ${msg}`)
            res.status(400).json({ error: msg })
        }
    })

    // GET /login
    router.get("/login", (req: Request, res: Response) => {
        if (authManager.isSetupRequired()) {
            res.redirect("/setup")
            return
        }
        const setupSuccess = req.query["setup"] === "success"
        res.send(renderLoginPage(setupSuccess))
    })

    // POST /login
    router.post("/login", async (req: Request, res: Response) => {
        try {
            const { username, password } = req.body as { username: string, password: string }
            if (!username || !password) {
                res.status(400).json({ error: "Username and password required" })
                return
            }

            const result = await authManager.validateCredentials(username, password)
            if (!result) {
                logger.warn(`Failed login attempt for user: ${username}`)
                res.status(401).json({ error: "Invalid credentials" })
                return
            }

            req.session.authenticated = true
            req.session.userId = result.userId
            req.session.role = result.role
            req.session.username = username

            logger.info(`User logged in: ${username} (${result.role})`)
            res.json({ success: true, message: "Login successful" })
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`Login failed: ${msg}`)
            res.status(500).json({ error: "Login failed" })
        }
    })

    // GET /logout
    router.get("/logout", (req: Request, res: Response) => {
        req.session.destroy((err) => {
            if (err) {
                logger.error(`Logout error: ${err.message}`)
            }
            res.redirect("/login")
        })
    })

    return router
}

export { createAuthRoutes }
