import { generateLayout, generatePageHeader } from "./layout-template"

interface DashboardData {
    apiKey: string
    role: "admin" | "user"
    username: string
    mcpEndpoint: string
}

function maskApiKey (key: string): string {
    if (key.length <= 12) return key
    return key.substring(0, 8) + "..." + key.substring(key.length - 4)
}

function renderDashboardPage (data: DashboardData): string {
    const maskedKey = maskApiKey(data.apiKey)

    const content = `
    ${generatePageHeader("Dashboard", "MCP-Funnel")}
    <div class="page-body">
      <div class="container-xl">
        <div class="row row-deck row-cards">

          <!-- API Key Card -->
          <div class="col-lg-6">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">API Key</h3>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <div class="input-group">
                    <input type="text" class="form-control" id="apiKeyDisplay" value="${maskedKey}" readonly>
                    <button class="btn btn-outline-primary" onclick="copyApiKey()" id="copyBtn" title="Copy full API key">
                      <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
                        <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <input type="hidden" id="apiKeyFull" value="${data.apiKey}">
                </div>
                <button class="btn btn-outline-warning" onclick="confirmRegenerate()">
                  Regenerate API Key
                </button>
              </div>
            </div>
          </div>

          <!-- MCP Endpoint Card -->
          <div class="col-lg-6">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">MCP Endpoint</h3>
              </div>
              <div class="card-body">
                <p class="text-secondary mb-2">Your personal MCP endpoint:</p>
                <div class="input-group">
                  <input type="text" class="form-control font-monospace" id="endpointDisplay" value="${data.mcpEndpoint}" readonly>
                  <button class="btn btn-outline-primary" onclick="copyEndpoint()">
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                      <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
                      <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
                    </svg>
                    Copy
                  </button>
                </div>
                <p class="text-secondary mt-2 small">Use this URL with your MCP client. Authenticate with your API key as Bearer token.</p>
              </div>
            </div>
          </div>

          <!-- Stats Placeholder -->
          <div class="col-12">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Statistics</h3>
              </div>
              <div class="card-body">
                <div class="text-center text-secondary py-4">
                  <p>Statistics coming soon</p>
                  <p class="small">Connected servers, tool count, request metrics will appear here.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Regenerate Confirmation Modal -->
    <div class="modal modal-blur fade" id="regenerateModal" tabindex="-1">
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Regenerate API Key</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to regenerate your API key? The current key will be invalidated immediately.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-warning" onclick="regenerateKey()">Regenerate</button>
          </div>
        </div>
      </div>
    </div>`

    const scripts = `<script>
    function copyApiKey() {
      var fullKey = document.getElementById('apiKeyFull').value;
      navigator.clipboard.writeText(fullKey).then(function() {
        var btn = document.getElementById('copyBtn');
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg> Copied';
        setTimeout(function() { btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg> Copy'; }, 2000);
      });
    }
    function copyEndpoint() {
      var endpoint = document.getElementById('endpointDisplay').value;
      navigator.clipboard.writeText(endpoint);
    }
    function confirmRegenerate() {
      new bootstrap.Modal(document.getElementById('regenerateModal')).show();
    }
    async function regenerateKey() {
      try {
        var response = await fetch('/dashboard/api/regenerate-key', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        var data = await response.json();
        if (response.ok) { window.location.reload(); }
        else { alert(data.error || 'Failed to regenerate key'); }
      } catch (err) { alert('Network error'); }
    }
  </script>`

    return generateLayout({
        title: "MCP-Funnel - Dashboard",
        content,
        currentPage: "dashboard",
        scripts,
        role: data.role
    })
}

export { renderDashboardPage, DashboardData }
