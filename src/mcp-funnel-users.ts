// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import bcrypt from "bcryptjs"
import { v4 as uuidv4 } from "uuid"
import { AuthManager, UserData, generateApiKey } from "./mcp-funnel-auth.js"
import logger from "./mcp-funnel-log.js"

interface CreateUserInput {
    username: string
    password: string
}

interface UpdateUserInput {
    password?: string
    enabled?: boolean
}

interface UserInfo {
    id: string
    username: string
    apiKey: string
    enabled: boolean
    createdAt: string
    updatedAt: string
    lastLogin: string | null
}

class UserManager {
    private authManager: AuthManager

    constructor (authManager: AuthManager) {
        this.authManager = authManager
    }

    listUsers (): UserInfo[] {
        const authData = this.authManager.loadAuthData()
        return authData.users.map((u) => ({
            id: u.id,
            username: u.username,
            apiKey: u.apiKey,
            enabled: u.enabled,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            lastLogin: u.lastLogin
        }))
    }

    async createUser (input: CreateUserInput): Promise<UserInfo> {
        if (!input.username || !input.password) {
            throw new Error("Username and password are required")
        }
        if (input.password.length < 8) {
            throw new Error("Password must be at least 8 characters long")
        }

        const authData = this.authManager.loadAuthData()

        /* Check for duplicate username */
        if (authData.admin.username === input.username) {
            throw new Error("Username already exists")
        }
        if (authData.users.some((u) => u.username === input.username)) {
            throw new Error("Username already exists")
        }

        const now = new Date().toISOString()
        const passwordHash = await bcrypt.hash(input.password, 10)

        const newUser: UserData = {
            id: uuidv4(),
            username: input.username,
            passwordHash,
            apiKey: generateApiKey(),
            enabled: true,
            createdAt: now,
            updatedAt: now,
            lastLogin: null
        }

        authData.users.push(newUser)
        this.authManager.saveAuthData(authData)
        logger.info(`User created: ${input.username}`)

        return {
            id: newUser.id,
            username: newUser.username,
            apiKey: newUser.apiKey,
            enabled: newUser.enabled,
            createdAt: newUser.createdAt,
            updatedAt: newUser.updatedAt,
            lastLogin: newUser.lastLogin
        }
    }

    async updateUser (id: string, input: UpdateUserInput): Promise<UserInfo> {
        const authData = this.authManager.loadAuthData()
        const user = authData.users.find((u) => u.id === id)

        if (!user) {
            throw new Error("User not found")
        }

        if (input.password !== undefined) {
            if (input.password.length < 8) {
                throw new Error("Password must be at least 8 characters long")
            }
            user.passwordHash = await bcrypt.hash(input.password, 10)
        }

        if (input.enabled !== undefined) {
            user.enabled = input.enabled
        }

        user.updatedAt = new Date().toISOString()
        this.authManager.saveAuthData(authData)
        logger.info(`User updated: ${user.username}`)

        return {
            id: user.id,
            username: user.username,
            apiKey: user.apiKey,
            enabled: user.enabled,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLogin: user.lastLogin
        }
    }

    deleteUser (id: string): boolean {
        const authData = this.authManager.loadAuthData()
        const index = authData.users.findIndex((u) => u.id === id)

        if (index === -1) {
            throw new Error("User not found")
        }

        const username = authData.users[index].username
        authData.users.splice(index, 1)
        this.authManager.saveAuthData(authData)
        logger.info(`User deleted: ${username}`)
        return true
    }
}

export { UserManager, CreateUserInput, UpdateUserInput, UserInfo }
