// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

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
