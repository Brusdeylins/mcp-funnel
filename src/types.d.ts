import "express-session"

declare module "express-session" {
    interface SessionData {
        authenticated: boolean
        userId: string
        role: "admin" | "user"
        username: string
    }
}
