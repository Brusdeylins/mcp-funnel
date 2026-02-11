/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import fs from "fs"
import path from "path"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import logger from "./mcp-funnel-log.js"

interface AdminData {
    username: string
    passwordHash: string
    apiKey: string
    createdAt: string | null
    updatedAt: string | null
}

interface UserData {
    id: string
    username: string
    passwordHash: string
    apiKey: string
    enabled: boolean
    createdAt: string
    updatedAt: string
    lastLogin: string | null
}

interface AuthData {
    admin: AdminData
    users: UserData[]
}

function generateApiKey (): string {
    const randomChars = crypto.randomBytes(24).toString("hex")
    return `mcp_${randomChars}`
}

class AuthManager {
    private authFilePath: string
    private cachedRaw: string | null = null

    constructor (dataDir: string) {
        this.authFilePath = path.join(dataDir, "auth.json")
        this.ensureAuthFileExists()
    }

    private ensureAuthFileExists (): void {
        const dir = path.dirname(this.authFilePath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
            logger.info(`Created auth directory: ${dir}`)
        }

        if (!fs.existsSync(this.authFilePath)) {
            const emptyAuth: AuthData = {
                admin: {
                    username: "",
                    passwordHash: "",
                    apiKey: "",
                    createdAt: null,
                    updatedAt: null
                },
                users: []
            }
            this.saveAuthData(emptyAuth)
            logger.info(`Created empty auth file: ${this.authFilePath}`)
        }
    }

    loadAuthData (): AuthData {
        if (this.cachedRaw === null) {
            this.cachedRaw = fs.readFileSync(this.authFilePath, "utf8")
        }
        return JSON.parse(this.cachedRaw) as AuthData
    }

    saveAuthData (authData: AuthData): void {
        const raw = JSON.stringify(authData, null, 2)
        fs.writeFileSync(this.authFilePath, raw, { encoding: "utf8", mode: 0o600 })
        this.cachedRaw = raw
        logger.debug("Auth data saved successfully")
    }

    isSetupRequired (): boolean {
        const authData = this.loadAuthData()
        return !authData.admin.username || !authData.admin.passwordHash
    }

    async setupAdmin (username: string, password: string): Promise<boolean> {
        if (!username || !password) {
            throw new Error("Username and password are required")
        }
        if (password.length < 8) {
            throw new Error("Password must be at least 8 characters long")
        }

        const authData = this.loadAuthData()
        const passwordHash = await bcrypt.hash(password, 10)
        const now = new Date().toISOString()

        authData.admin = {
            username,
            passwordHash,
            apiKey: generateApiKey(),
            createdAt: now,
            updatedAt: now
        }

        this.saveAuthData(authData)
        logger.info(`Admin user created: ${username}`)
        return true
    }

    async validateCredentials (username: string, password: string): Promise<{ valid: boolean, userId: string, role: "admin" | "user", disabled: boolean } | null> {
        const authData = this.loadAuthData()

        /* Check admin */
        if (authData.admin.username === username && authData.admin.passwordHash) {
            const valid = await bcrypt.compare(password, authData.admin.passwordHash)
            if (valid) {
                return { valid: true, userId: "admin", role: "admin", disabled: false }
            }
        }

        /* Check users */
        for (const user of authData.users) {
            if (user.username === username) {
                const valid = await bcrypt.compare(password, user.passwordHash)
                if (valid) {
                    if (!user.enabled) {
                        return { valid: false, userId: user.id, role: "user", disabled: true }
                    }
                    /* Update lastLogin */
                    user.lastLogin = new Date().toISOString()
                    this.saveAuthData(authData)
                    return { valid: true, userId: user.id, role: "user", disabled: false }
                }
            }
        }

        return null
    }

    async updatePassword (userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
        const authData = this.loadAuthData()

        if (newPassword.length < 8) {
            throw new Error("New password must be at least 8 characters long")
        }

        if (userId === "admin") {
            const isValid = await bcrypt.compare(oldPassword, authData.admin.passwordHash)
            if (!isValid) {
                throw new Error("Invalid current password")
            }
            authData.admin.passwordHash = await bcrypt.hash(newPassword, 10)
            authData.admin.updatedAt = new Date().toISOString()
        }
        else {
            const user = authData.users.find((u) => u.id === userId)
            if (!user) {
                throw new Error("User not found")
            }
            const isValid = await bcrypt.compare(oldPassword, user.passwordHash)
            if (!isValid) {
                throw new Error("Invalid current password")
            }
            user.passwordHash = await bcrypt.hash(newPassword, 10)
            user.updatedAt = new Date().toISOString()
        }

        this.saveAuthData(authData)
        logger.info(`Password updated for user: ${userId}`)
        return true
    }

    getApiKeyForUser (userId: string): string {
        const authData = this.loadAuthData()
        if (userId === "admin") {
            return authData.admin.apiKey
        }
        const user = authData.users.find((u) => u.id === userId)
        return user ? user.apiKey : ""
    }

    regenerateApiKey (userId: string): string {
        const authData = this.loadAuthData()
        const newKey = generateApiKey()

        if (userId === "admin") {
            authData.admin.apiKey = newKey
            authData.admin.updatedAt = new Date().toISOString()
        }
        else {
            const user = authData.users.find((u) => u.id === userId)
            if (!user) {
                throw new Error("User not found")
            }
            user.apiKey = newKey
            user.updatedAt = new Date().toISOString()
        }

        this.saveAuthData(authData)
        logger.info(`API key regenerated for user: ${userId}`)
        return newKey
    }

    private safeEqual (a: string, b: string): boolean {
        const ha = crypto.createHash("sha256").update(a).digest()
        const hb = crypto.createHash("sha256").update(b).digest()
        return crypto.timingSafeEqual(ha, hb)
    }

    validateApiKey (key: string): { valid: boolean, userId: string, username: string } | null {
        const authData = this.loadAuthData()

        /* Check admin key */
        if (authData.admin.apiKey && this.safeEqual(authData.admin.apiKey, key)) {
            return { valid: true, userId: "admin", username: authData.admin.username }
        }

        /* Check user keys */
        for (const user of authData.users) {
            if (user.enabled && this.safeEqual(user.apiKey, key)) {
                return { valid: true, userId: user.id, username: user.username }
            }
        }

        return null
    }
}

export { AuthManager, AuthData, AdminData, UserData, generateApiKey }
