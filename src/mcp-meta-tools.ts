// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

type SearchWords = string | { and: string[] } | { or: string[] }

interface ToolWithServer {
    name: string
    description: string
    inputSchema: unknown
    _serverId: string
    _serverName: string
    [key: string]: unknown
}

interface ToolSearchResult {
    name: string
    description: string
    server: string
}

const META_TOOLS = [
    {
        name: "mcp_discover_tools",
        description: "Search for tools by keywords in their names and descriptions. IMPORTANT: Use minimal, specific keywords that directly match the user's intent. Each keyword will match tools containing that word - avoid generic terms unless explicitly needed.",
        inputSchema: {
            type: "object",
            properties: {
                words: {
                    oneOf: [
                        {
                            type: "string",
                            description: "Space-separated keywords (uses AND logic - tool must contain ALL keywords)"
                        },
                        {
                            type: "object",
                            properties: {
                                and: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Tool must contain ALL of these keywords"
                                }
                            },
                            required: ["and"]
                        },
                        {
                            type: "object",
                            properties: {
                                or: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Tool must contain ANY of these keywords"
                                }
                            },
                            required: ["or"]
                        }
                    ],
                    description: "Search keywords - string (AND logic), {and: [...]} (ALL keywords), or {or: [...]} (ANY keyword)"
                },
                limit: {
                    type: "number",
                    description: "Maximum number of results to return",
                    default: 10
                }
            },
            required: ["words"]
        }
    },
    {
        name: "mcp_get_tool_schema",
        description: "Retrieve the full input schema for a specific tool. Use this after discovering a tool to understand its required and optional parameters before calling it.",
        inputSchema: {
            type: "object",
            properties: {
                tool_name: {
                    type: "string",
                    description: "The exact tool name as returned by mcp_discover_tools"
                }
            },
            required: ["tool_name"]
        }
    },
    {
        name: "mcp_call_tool",
        description: "Execute a tool dynamically. Always use mcp_get_tool_schema first to get the required arguments. Pass the exact tool name and arguments object.",
        inputSchema: {
            type: "object",
            properties: {
                tool_name: {
                    type: "string",
                    description: "The exact tool name to execute"
                },
                arguments: {
                    type: "object",
                    description: "The arguments object matching the tool's input schema"
                }
            },
            required: ["tool_name", "arguments"]
        }
    }
]

function isMetaTool (toolName: string): boolean {
    return META_TOOLS.some((t) => t.name === toolName)
}

function getMetaTools (): typeof META_TOOLS {
    return META_TOOLS
}

function parseWordsParameter (words: SearchWords): { keywords: string[], mode: "and" | "or" } {
    let keywords: string[] = []
    let mode: "and" | "or" = "and"

    if (typeof words === "string") {
        keywords = words.toLowerCase().split(/\s+/).filter((w) => w.length > 0)
    }
    else if (typeof words === "object" && words !== null) {
        if ("and" in words && Array.isArray(words.and)) {
            keywords = words.and.map((k) => k.toLowerCase())
            mode = "and"
        }
        else if ("or" in words && Array.isArray(words.or)) {
            keywords = words.or.map((k) => k.toLowerCase())
            mode = "or"
        }
        else {
            throw new Error("Invalid words format - use string, {and: [...]}, or {or: [...]}")
        }
    }
    else {
        throw new Error("Missing or invalid \"words\" parameter")
    }

    return { keywords, mode }
}

function matchesKeywords (tool: ToolWithServer, keywords: string[], mode: "and" | "or" = "and"): boolean {
    const searchText = `${tool.name || ""} ${tool.description || ""} ${tool._serverName || ""}`.toLowerCase()

    if (mode === "or") {
        return keywords.some((kw) => searchText.includes(kw))
    }
    else {
        return keywords.every((kw) => searchText.includes(kw))
    }
}

function truncateDescription (description: string): string {
    if (!description) return ""
    if (description.length <= 100) return description

    const firstBreak = description.indexOf("\n", 100)
    if (firstBreak !== -1) {
        return description.substring(0, firstBreak)
    }

    if (description.length > 200) {
        return description.substring(0, 197) + "..."
    }
    return description
}

function searchTools (allTools: ToolWithServer[], words: SearchWords, limit = 10): ToolSearchResult[] {
    const { keywords, mode } = parseWordsParameter(words)

    if (keywords.length === 0) {
        return allTools.slice(0, limit).map((t) => ({
            name: t.name,
            description: truncateDescription(t.description),
            server: t._serverName
        }))
    }

    return allTools
        .filter((tool) => matchesKeywords(tool, keywords, mode))
        .slice(0, limit)
        .map((t) => ({
            name: t.name,
            description: truncateDescription(t.description),
            server: t._serverName
        }))
}

export { META_TOOLS, isMetaTool, getMetaTools, searchTools, parseWordsParameter, matchesKeywords }
export type { SearchWords, ToolWithServer, ToolSearchResult }
