declare module "session-file-store" {
    import session from "express-session"
    interface FileStoreOptions {
        path?: string
        ttl?: number
        retries?: number
        secret?: string
        reapInterval?: number
        logFn?: (...args: unknown[]) => void
    }
    function connectSessionFileStore (session: typeof import("express-session")): new(options?: FileStoreOptions) => session.Store
    export = connectSessionFileStore
}
