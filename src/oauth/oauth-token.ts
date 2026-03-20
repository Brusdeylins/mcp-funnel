/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import fs from "fs"
import path from "path"

/* jose is ESM-only — use dynamic import and cache */
/* eslint-disable @typescript-eslint/no-explicit-any */
let joseModule: any = null
async function getJose (): Promise<any> {
    if (!joseModule) joseModule = await import("jose")
    return joseModule
}

/* Strip private RSA fields from a JWK, returning the public portion */
function toPublicJwk (jwk: Record<string, any>): Record<string, any> {
    const pub = { ...jwk }
    delete pub.d
    delete pub.p
    delete pub.q
    delete pub.dp
    delete pub.dq
    delete pub.qi
    return pub
}

let keyPair: { privateKey: any; publicKey: any; jwk: Record<string, any> } | null = null
let keyPairPromise: Promise<{ privateKey: any; publicKey: any; jwk: Record<string, any> }> | null = null

async function getKeyPair (dataDir: string): Promise<{ privateKey: any; publicKey: any; jwk: Record<string, any> }> {
    if (keyPair) return keyPair
    if (keyPairPromise) return keyPairPromise
    keyPairPromise = loadKeyPair(dataDir)
    keyPair = await keyPairPromise
    keyPairPromise = null
    return keyPair
}

async function loadKeyPair (dataDir: string): Promise<{ privateKey: any; publicKey: any; jwk: Record<string, any> }> {
    const jose = await getJose()
    const keyFile = path.join(dataDir, "oauth", "jwk-private.json")

    if (fs.existsSync(keyFile)) {
        const stored = JSON.parse(fs.readFileSync(keyFile, "utf8"))
        const privateKey = await jose.importJWK(stored, "RS256")
        const publicJwk = toPublicJwk(stored)
        const publicKey = await jose.importJWK(publicJwk, "RS256")
        return { privateKey, publicKey, jwk: publicJwk }
    }

    const { publicKey, privateKey } = await jose.generateKeyPair("RS256", { extractable: true })
    const privateJwk = await jose.exportJWK(privateKey)
    privateJwk.kid = jose.base64url.encode(new TextEncoder().encode(Date.now().toString())).slice(0, 8)
    privateJwk.alg = "RS256"
    privateJwk.use = "sig"

    fs.mkdirSync(path.join(dataDir, "oauth"), { recursive: true })
    fs.writeFileSync(keyFile, JSON.stringify(privateJwk, null, 2), { mode: 0o600 })

    const publicJwk = toPublicJwk(privateJwk)

    return { privateKey, publicKey, jwk: publicJwk }
}

async function createAccessToken (dataDir: string, issuer: string, subject: string, audience: string, scope: string, lifetime: number): Promise<string> {
    const jose = await getJose()
    const { privateKey, jwk } = await getKeyPair(dataDir)
    return await new jose.SignJWT({ scope })
        .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
        .setIssuer(issuer)
        .setSubject(subject)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(`${lifetime}s`)
        .sign(privateKey)
}

async function verifyAccessToken (dataDir: string, token: string, issuer: string, audience: string): Promise<{ sub: string; scope: string } | null> {
    try {
        const jose = await getJose()
        const { publicKey } = await getKeyPair(dataDir)
        const { payload } = await jose.jwtVerify(token, publicKey, {
            issuer,
            audience
        })
        return { sub: payload.sub || "", scope: (payload.scope as string) || "" }
    }
    catch {
        return null
    }
}

async function getJwks (dataDir: string): Promise<{ keys: Record<string, any>[] }> {
    const { jwk } = await getKeyPair(dataDir)
    return { keys: [jwk] }
}

export { createAccessToken, verifyAccessToken, getJwks, getKeyPair }
