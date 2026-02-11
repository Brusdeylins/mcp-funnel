/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { generateLayout, generatePageHeader } from "./layout-template.js"
import { UserStats } from "../mcp-funnel-stats.js"

interface DashboardData {
    apiKey: string
    role: "admin" | "user"
    username: string
    mcpEndpoint: string
    stats: UserStats
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
                  <div class="d-flex align-items-center gap-2">
                    <code class="px-3 py-2 border rounded bg-body-tertiary flex-fill" style="font-size: 0.9rem; letter-spacing: 0.5px;" id="apiKeyDisplay">${maskedKey}</code>
                    <button class="btn btn-outline-primary btn-icon" onclick="copyApiKey()" id="copyBtn" title="Copy full API key">
                      <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
                        <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
                      </svg>
                    </button>
                  </div>
                  <input type="hidden" id="apiKeyFull" value="${data.apiKey}">
                  <small class="text-secondary mt-1 d-block">Click the copy button to copy the full API key to clipboard.</small>
                </div>
                <button class="btn btn-outline-warning" onclick="confirmRegenerate()">
                  Regenerate API Key
                </button>
              </div>
            </div>
          </div>

          <!-- Stats Card -->
          <div class="col-lg-6">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Statistics</h3>
              </div>
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-6">
                    <div class="text-secondary small">API Requests</div>
                    <div class="h1 mb-0">${data.stats.requests.toLocaleString()}</div>
                  </div>
                  <div class="col-6">
                    <div class="text-secondary small">MCP Servers</div>
                    <div class="h1 mb-0">${data.stats.mcpServers.toLocaleString()}</div>
                  </div>
                  <div class="col-6">
                    <div class="text-secondary small">Registered Tools</div>
                    <div class="h1 mb-0">${data.stats.registeredTools.toLocaleString()}</div>
                  </div>
                  <div class="col-6">
                    <div class="text-secondary small">Active Tools</div>
                    <div class="h1 mb-0">${data.stats.activeTools.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Integration Guide Card -->
          <div class="col-12">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Integration</h3>
              </div>
              <div class="card-body">
                <ul class="nav nav-tabs" role="tablist">
                  <li class="nav-item" role="presentation">
                    <a class="nav-link active" data-bs-toggle="tab" href="#tab-claude-code" role="tab">Claude Code</a>
                  </li>
                  <li class="nav-item" role="presentation">
                    <a class="nav-link" data-bs-toggle="tab" href="#tab-copilot" role="tab">GitHub Copilot</a>
                  </li>
                  <li class="nav-item" role="presentation">
                    <a class="nav-link" data-bs-toggle="tab" href="#tab-cursor" role="tab">Cursor</a>
                  </li>
                </ul>
                <div class="tab-content mt-3">
                  <div class="tab-pane active show" id="tab-claude-code" role="tabpanel">
                    <p class="text-secondary mb-2">Add to <code>~/.claude/settings.json</code>:</p>
                    <div class="position-relative">
                      <pre class="p-3 border rounded bg-body-tertiary text-body" id="claudeCodeSnippet"><code>{
  "mcpServers": {
    "mcp-funnel": {
      "type": "http",
      "url": "${data.mcpEndpoint}",
      "headers": {
        "Authorization": "Bearer ${maskedKey}"
      }
    }
  }
}</code></pre>
                      <button class="btn btn-icon btn-outline-primary position-absolute top-0 end-0 m-2" onclick="copySnippet('claudeCode')" id="copyClaudeCodeBtn" title="Copy">
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>
                      </button>
                    </div>
                  </div>
                  <div class="tab-pane" id="tab-copilot" role="tabpanel">
                    <p class="text-secondary mb-2">Add to VS Code <code>settings.json</code>:</p>
                    <div class="position-relative">
                      <pre class="p-3 border rounded bg-body-tertiary text-body" id="copilotSnippet"><code>{
  "mcp": {
    "servers": {
      "mcp-funnel": {
        "type": "http",
        "url": "${data.mcpEndpoint}",
        "headers": {
          "Authorization": "Bearer ${maskedKey}"
        }
      }
    }
  }
}</code></pre>
                      <button class="btn btn-icon btn-outline-primary position-absolute top-0 end-0 m-2" onclick="copySnippet('copilot')" id="copyCopilotBtn" title="Copy">
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>
                      </button>
                    </div>
                  </div>
                  <div class="tab-pane" id="tab-cursor" role="tabpanel">
                    <p class="text-secondary mb-2">Add to <code>~/.cursor/mcp.json</code>:</p>
                    <div class="position-relative">
                      <pre class="p-3 border rounded bg-body-tertiary text-body" id="cursorSnippet"><code>{
  "mcpServers": {
    "mcp-funnel": {
      "url": "${data.mcpEndpoint}",
      "headers": {
        "Authorization": "Bearer ${maskedKey}"
      }
    }
  }
}</code></pre>
                      <button class="btn btn-icon btn-outline-primary position-absolute top-0 end-0 m-2" onclick="copySnippet('cursor')" id="copyCursorBtn" title="Copy">
                        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
                <p class="text-secondary mt-3 small">Replace the masked API key with your full key (use the copy button above).</p>
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
    var copyIcon = '<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>';
    var checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" class="icon text-success" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>';

    function flashCopyButton(btn, originalHtml) {
      btn.innerHTML = checkIcon;
      setTimeout(function() { btn.innerHTML = originalHtml || copyIcon; }, 1500);
    }

    function copyApiKey() {
      var fullKey = document.getElementById('apiKeyFull').value;
      var btn = document.getElementById('copyBtn');
      navigator.clipboard.writeText(fullKey).then(function() { flashCopyButton(btn); });
    }

    function copySnippet(type) {
      var el = document.getElementById(type + 'Snippet');
      var fullKey = document.getElementById('apiKeyFull').value;
      var text = el.textContent.replace('${maskedKey}', fullKey);
      var btn = document.getElementById('copy' + type.charAt(0).toUpperCase() + type.slice(1) + 'Btn');
      navigator.clipboard.writeText(text).then(function() { flashCopyButton(btn); });
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
        role: data.role,
        username: data.username
    })
}

export { renderDashboardPage, DashboardData }
