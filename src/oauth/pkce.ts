/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import crypto from "crypto"

function verifyPkceS256 (codeVerifier: string, codeChallenge: string): boolean {
    const hash = crypto.createHash("sha256").update(codeVerifier).digest()
    const computed = hash.toString("base64url")
    return computed === codeChallenge
}

export { verifyPkceS256 }
