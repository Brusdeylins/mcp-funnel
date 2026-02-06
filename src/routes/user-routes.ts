import { Router, Request, Response } from "express"
import { UserManager } from "../mcp-funnel-users"
import { renderUsersPage } from "../views/users-view"
import logger from "../mcp-funnel-log"

function createUserRoutes (userManager: UserManager): Router {
    const router = Router()

    // GET /users/manage
    router.get("/manage", (_req: Request, res: Response) => {
        res.send(renderUsersPage())
    })

    // GET /users/api/list
    router.get("/api/list", (_req: Request, res: Response) => {
        const users = userManager.listUsers()
        res.json(users)
    })

    // POST /users/api/create
    router.post("/api/create", async (req: Request, res: Response) => {
        try {
            const { username, password } = req.body as { username: string, password: string }
            const user = await userManager.createUser({ username, password })
            res.json(user)
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`User creation failed: ${msg}`)
            res.status(400).json({ error: msg })
        }
    })

    // PUT /users/api/:id
    router.put("/api/:id", async (req: Request, res: Response) => {
        try {
            const { password, enabled } = req.body as { password?: string, enabled?: boolean }
            const id = req.params["id"] as string
            const user = await userManager.updateUser(id, { password, enabled })
            res.json(user)
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`User update failed: ${msg}`)
            res.status(400).json({ error: msg })
        }
    })

    // DELETE /users/api/:id
    router.delete("/api/:id", (req: Request, res: Response) => {
        try {
            const id = req.params["id"] as string
            userManager.deleteUser(id)
            res.json({ success: true })
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            logger.error(`User deletion failed: ${msg}`)
            res.status(400).json({ error: msg })
        }
    })

    return router
}

export { createUserRoutes }
