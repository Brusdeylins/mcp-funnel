import { Router, Request, Response } from "express"
import { renderMcpServersPage } from "../views/mcp-servers-view"

function createMcpRoutes (): Router {
    const router = Router()

    // GET /mcp-servers/manage
    router.get("/manage", (req: Request, res: Response) => {
        const role = req.session.role || "user"
        res.send(renderMcpServersPage(role))
    })

    return router
}

export { createMcpRoutes }
