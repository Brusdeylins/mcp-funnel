/* MCP Spec Test Server — Standalone CLI Runner
 * Usage: npx tsx test/fixtures/mcp-spec-server-runner.ts --port=4001 */

import { createSpecServer } from "./mcp-spec-server.js"

async function main () {
    const portArg = process.argv.find(a => a.startsWith("--port="))
    const port = parseInt(portArg?.split("=")[1] || "4001", 10)

    const { url, shutdown } = await createSpecServer(port)
    console.log(`MCP Spec Test Server running at ${url}`)

    process.on("SIGINT", async () => {
        console.log("\nShutting down...")
        await shutdown()
        process.exit(0)
    })

    process.on("SIGTERM", async () => {
        await shutdown()
        process.exit(0)
    })
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
