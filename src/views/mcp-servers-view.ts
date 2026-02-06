import { generateLayout, generatePageHeader } from "./layout-template"

function renderMcpServersPage (role: "admin" | "user"): string {
    const content = `
    ${generatePageHeader("MCP Servers", "MCP-Funnel")}
    <div class="page-body">
      <div class="container-xl">
        <div class="card">
          <div class="card-body">
            <div class="text-center py-5">
              <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-lg text-secondary mb-3" width="48" height="48" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1 -5 -5l1.5 -1.5z" />
                <path d="M17 12l-5 -5l1.5 -1.5a3.536 3.536 0 1 1 5 5l-1.5 1.5z" />
                <path d="M3 21l2.5 -2.5" />
                <path d="M18.5 5.5l2.5 -2.5" />
                <path d="M10 14l-2 2" />
                <path d="M10 10l4 4" />
              </svg>
              <h3 class="text-secondary">MCP Server management coming soon</h3>
              <p class="text-secondary">Configure and manage your MCP servers from this page.</p>
            </div>
          </div>
        </div>
      </div>
    </div>`

    return generateLayout({
        title: "MCP-Funnel - MCP Servers",
        content,
        currentPage: "mcp-servers",
        role
    })
}

export { renderMcpServersPage }
