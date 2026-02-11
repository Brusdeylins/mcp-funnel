/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { generateLayout, generatePageHeader } from "./layout-template.js"

function renderMcpServersPage (role: "admin" | "user", username: string): string {
    const content = `
    <style>
      .icon.spin {
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
    ${generatePageHeader("MCP Servers", "MCP-Funnel")}

    <div class="page-body">
      <div class="container-xl">
        <!-- Notification Alert -->
        <div id="notification" class="alert alert-success alert-dismissible d-none" role="alert">
          <div class="d-flex">
            <div><span id="notificationText"></span></div>
          </div>
          <a class="btn-close" onclick="document.getElementById('notification').classList.add('d-none')"></a>
        </div>

        <!-- Add MCP Server Card -->
        <div class="row mb-3">
          <div class="col-12">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">
                  <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M12 5l0 14" />
                    <path d="M5 12l14 0" />
                  </svg>
                  Add New MCP Server
                </h3>
              </div>
              <div class="card-body">
                <div class="row g-3">
                  <div class="col-md-4">
                    <label class="form-label">Server Name</label>
                    <input type="text" id="serverName" class="form-control" placeholder="e.g., GitHub MCP">
                  </div>
                  <div class="col-md-3">
                    <label class="form-label">Transport Type</label>
                    <select id="serverType" class="form-select" onchange="updateConfigFields()">
                      <option value="http" selected>HTTP (Streamable)</option>
                      <option value="sse">SSE (Server-Sent Events)</option>
                      <option value="stdio">Stdio (Local Process)</option>
                    </select>
                  </div>
                  <div class="col-md-5" id="configContainer">
                  </div>
                </div>
                <div class="row g-3 mt-2" id="authContainer">
                </div>
                <div class="row mt-3">
                  <div class="col-12">
                    <button class="btn btn-outline-primary" onclick="addServer()">
                      <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                        <path d="M12 5l0 14" />
                        <path d="M5 12l14 0" />
                      </svg>
                      Add MCP Server
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Existing MCP Servers -->
        <div class="row">
          <div class="col-12">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">
                  <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M3 4m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" />
                    <path d="M3 12m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" />
                    <path d="M7 8l0 .01" />
                    <path d="M7 16l0 .01" />
                  </svg>
                  Registered MCP Servers
                </h3>
                <div class="card-actions">
                  <button class="btn btn-outline-primary me-2" onclick="refreshAllServers()" id="refreshAllBtn">
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon me-1" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                      <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
                      <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
                    </svg>
                    Refresh All
                  </button>
                </div>
              </div>
              <div id="serversContainer">
                <div class="card-body text-center text-muted">
                  <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                  Loading MCP servers...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Server Tools Modal -->
    <div id="editModal" class="modal modal-blur fade" tabindex="-1" aria-labelledby="editModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="editModalLabel">
              <svg xmlns="http://www.w3.org/2000/svg" class="icon me-2" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5" />
              </svg>
              <span id="editServerName">Server Tools</span>
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="editServerId">
            <div id="toolsLoadingContainer" class="text-center py-4">
              <div class="spinner-border text-primary" role="status"></div>
              <p class="text-muted mt-2">Loading tools...</p>
            </div>
            <div id="toolsContainer" class="d-none">
              <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <span class="text-muted" id="toolsCount">0 tools</span>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" onclick="selectAllTools(true)">Enable All</button>
                    <button class="btn btn-outline-secondary" onclick="selectAllTools(false)">Disable All</button>
                  </div>
                </div>
                <input type="text" id="toolsFilter" class="form-control" placeholder="Filter tools..." oninput="filterTools()">
              </div>
              <div id="toolsList" class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;">
              </div>
            </div>
            <div id="toolsNotConnected" class="d-none">
              <div class="empty">
                <div class="empty-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M20 16l-4 4" /><path d="M7 4v4h4" /><path d="M7 8l4 -4" /><path d="M20 8l-4 -4" />
                    <path d="M4 20l4 -4" /><path d="M4 8l4 4" /><path d="M16 20v-4h4" />
                  </svg>
                </div>
                <p class="empty-title">Server not connected</p>
                <p class="empty-subtitle text-muted">Enable the server and refresh connections to manage tools</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-outline-primary" onclick="saveToolSettings()">
              <svg xmlns="http://www.w3.org/2000/svg" class="icon me-1" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" />
              </svg>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>`

    const scripts = `<script>
    var editModal = null;

    document.addEventListener('DOMContentLoaded', function() {
      updateConfigFields();
      loadServers();
      var modalEl = document.getElementById('editModal');
      if (modalEl && typeof bootstrap !== 'undefined') {
        editModal = new bootstrap.Modal(modalEl);
        modalEl.addEventListener('hide.bs.modal', function() {
          if (document.activeElement && modalEl.contains(document.activeElement)) {
            document.activeElement.blur();
          }
        });
      }
    });

    function updateConfigFields() {
      var type = document.getElementById('serverType').value;
      var container = document.getElementById('configContainer');
      var authContainer = document.getElementById('authContainer');

      if (type === 'stdio') {
        container.innerHTML =
          '<label class="form-label">Command</label>' +
          '<input type="text" id="stdioCommand" class="form-control" placeholder="e.g., npx or /usr/local/bin/mcp-server">' +
          '<small class="form-hint">The command to spawn the MCP server process</small>';
        authContainer.innerHTML =
          '<div class="col-md-6">' +
          '  <label class="form-label">Arguments (one per line)</label>' +
          '  <textarea id="stdioArgs" class="form-control" rows="2" placeholder="-y\\n@anthropic-ai/mcp-server-memory"></textarea>' +
          '</div>' +
          '<div class="col-md-6">' +
          '  <label class="form-label">Working Directory (optional)</label>' +
          '  <input type="text" id="stdioCwd" class="form-control" placeholder="/path/to/working/dir">' +
          '</div>' +
          '<div class="col-12 mt-2">' +
          '  <label class="form-label">Environment Variables (KEY=VALUE, one per line, optional)</label>' +
          '  <textarea id="stdioEnv" class="form-control" rows="2" placeholder="NODE_ENV=production\\nDEBUG=true"></textarea>' +
          '</div>';
      } else {
        container.innerHTML =
          '<label class="form-label">Server URL</label>' +
          '<input type="url" id="configUrl" class="form-control" placeholder="https://mcp.example.com/mcp">' +
          '<small class="form-hint">The MCP server endpoint URL</small>';
        authContainer.innerHTML =
          '<div class="col-md-4">' +
          '  <label class="form-label">Authentication Type</label>' +
          '  <select id="authType" class="form-select" onchange="updateAuthFields()">' +
          '    <option value="none">None</option>' +
          '    <option value="bearer">Bearer Token</option>' +
          '    <option value="basic">Basic Auth</option>' +
          '    <option value="apikey">API Key Header</option>' +
          '    <option value="urlparam">URL Parameter</option>' +
          '    <option value="custom">Custom Header</option>' +
          '  </select>' +
          '</div>' +
          '<div class="col-md-8" id="authFieldsContainer"></div>';
        updateAuthFields();
      }
    }

    function updateAuthFields() {
      var authType = document.getElementById('authType') ? document.getElementById('authType').value : 'none';
      var container = document.getElementById('authFieldsContainer');
      if (!container) return;

      switch (authType) {
        case 'none':
          container.innerHTML = '';
          break;
        case 'bearer':
          container.innerHTML =
            '<label class="form-label">Bearer Token</label>' +
            '<input type="password" id="authToken" class="form-control" placeholder="your-api-token">' +
            '<small class="form-hint">Will be sent as: Authorization: Bearer &lt;token&gt;</small>';
          break;
        case 'basic':
          container.innerHTML =
            '<label class="form-label">Basic Auth</label>' +
            '<div class="row g-2">' +
            '  <div class="col-5"><input type="text" id="authUsername" class="form-control" placeholder="Username"></div>' +
            '  <div class="col-7"><input type="password" id="authPassword" class="form-control" placeholder="Password"></div>' +
            '</div>' +
            '<small class="form-hint">Will be sent as: Authorization: Basic &lt;base64&gt;</small>';
          break;
        case 'apikey':
          container.innerHTML =
            '<label class="form-label">API Key</label>' +
            '<div class="row g-2">' +
            '  <div class="col-5"><input type="text" id="authHeaderName" class="form-control" value="X-API-Key" placeholder="Header name"></div>' +
            '  <div class="col-7"><input type="password" id="authToken" class="form-control" placeholder="your-api-key"></div>' +
            '</div>';
          break;
        case 'urlparam':
          container.innerHTML =
            '<label class="form-label">URL Parameter</label>' +
            '<div class="row g-2">' +
            '  <div class="col-5"><input type="text" id="authParamName" class="form-control" value="apikey" placeholder="Parameter name"></div>' +
            '  <div class="col-7"><input type="password" id="authParamValue" class="form-control" placeholder="your-api-key"></div>' +
            '</div>' +
            '<small class="form-hint">Will be appended to URL: ?apikey=your-key</small>';
          break;
        case 'custom':
          container.innerHTML =
            '<label class="form-label">Custom Header</label>' +
            '<div class="row g-2">' +
            '  <div class="col-5"><input type="text" id="authHeaderName" class="form-control" placeholder="Header-Name"></div>' +
            '  <div class="col-7"><input type="text" id="authToken" class="form-control" placeholder="Header value"></div>' +
            '</div>';
          break;
      }
    }

    function getAuthHeaders() {
      var authType = document.getElementById('authType') ? document.getElementById('authType').value : 'none';
      var headers = {};
      switch (authType) {
        case 'bearer':
          var bearerToken = document.getElementById('authToken') ? document.getElementById('authToken').value : '';
          if (bearerToken) headers['Authorization'] = 'Bearer ' + bearerToken;
          break;
        case 'basic':
          var username = document.getElementById('authUsername') ? document.getElementById('authUsername').value : '';
          var password = document.getElementById('authPassword') ? document.getElementById('authPassword').value : '';
          if (username) {
            var credentials = btoa(username + ':' + (password || ''));
            headers['Authorization'] = 'Basic ' + credentials;
          }
          break;
        case 'apikey':
        case 'custom':
          var headerName = document.getElementById('authHeaderName') ? document.getElementById('authHeaderName').value : '';
          var headerValue = document.getElementById('authToken') ? document.getElementById('authToken').value : '';
          if (headerName && headerValue) headers[headerName] = headerValue;
          break;
      }
      return headers;
    }

    function getConfigFromFields() {
      var type = document.getElementById('serverType').value;

      if (type === 'stdio') {
        var command = document.getElementById('stdioCommand') ? document.getElementById('stdioCommand').value.trim() : '';
        var argsText = document.getElementById('stdioArgs') ? document.getElementById('stdioArgs').value.trim() : '';
        var cwd = document.getElementById('stdioCwd') ? document.getElementById('stdioCwd').value.trim() : '';
        var envText = document.getElementById('stdioEnv') ? document.getElementById('stdioEnv').value.trim() : '';

        var config = { command: command };
        if (argsText) {
          config.args = argsText.split('\\n').map(function(a) { return a.trim(); }).filter(function(a) { return a; });
        }
        if (cwd) {
          config.cwd = cwd;
        }
        if (envText) {
          var env = {};
          envText.split('\\n').forEach(function(line) {
            line = line.trim();
            if (!line) return;
            var eqIdx = line.indexOf('=');
            if (eqIdx > 0) {
              env[line.substring(0, eqIdx).trim()] = line.substring(eqIdx + 1).trim();
            }
          });
          if (Object.keys(env).length > 0) {
            config.env = env;
          }
        }
        return config;
      }

      var url = document.getElementById('configUrl').value;
      var authType = document.getElementById('authType') ? document.getElementById('authType').value : 'none';

      if (authType === 'urlparam') {
        var paramName = document.getElementById('authParamName') ? document.getElementById('authParamName').value : 'apikey';
        var paramValue = document.getElementById('authParamValue') ? document.getElementById('authParamValue').value : '';
        if (paramValue) {
          var separator = url.includes('?') ? '&' : '?';
          url = url + separator + encodeURIComponent(paramName) + '=' + encodeURIComponent(paramValue);
        }
      }

      var urlConfig = { url: url };
      var headers = getAuthHeaders();
      if (Object.keys(headers).length > 0) {
        urlConfig.headers = headers;
      }
      return urlConfig;
    }

    async function loadServers() {
      try {
        var response = await fetch('/mcp-servers/api/list');
        var data = await response.json();

        if (data.success && data.servers.length > 0) {
          renderServersTable(data.servers);
        } else {
          document.getElementById('serversContainer').innerHTML =
            '<div class="empty">' +
            '  <div class="empty-icon">' +
            '    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
            '      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>' +
            '      <path d="M3 4m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" />' +
            '      <path d="M3 12m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" />' +
            '    </svg>' +
            '  </div>' +
            '  <p class="empty-title">No MCP servers registered</p>' +
            '  <p class="empty-subtitle text-muted">Add your first MCP server above</p>' +
            '</div>';
        }
      } catch (error) {
        showNotification('Failed to load MCP servers: ' + error.message, 'danger');
      }
    }

    function renderServersTable(servers) {
      var rows = servers.map(function(server) {
        return '<tr>' +
          '<td><span class="badge text-white ' + (server.enabled ? 'bg-success' : 'bg-secondary') + '">' +
            (server.enabled ? 'Enabled' : 'Disabled') + '</span></td>' +
          '<td>' + getConnectionBadge(server) + '</td>' +
          '<td class="fw-bold">' + escapeHtml(server.name) + '</td>' +
          '<td><span class="badge bg-blue-lt">' + server.type.toUpperCase() + '</span> ' +
            '<span class="badge bg-purple-lt ms-1">' + getAuthType(server) + '</span></td>' +
          '<td>' + (server.disabledTools && server.disabledTools.length > 0
            ? '<span class="text-warning" title="' + server.disabledTools.length + ' tools disabled">' + server.disabledTools.length + ' disabled</span>'
            : '<span class="text-muted">All enabled</span>') + '</td>' +
          '<td><code class="text-muted">' + formatConfig(server.type, server.config) + '</code></td>' +
          '<td>' +
            '<div class="btn-list flex-nowrap">' +
              '<button class="btn btn-icon btn-outline-primary" onclick="refreshServer(\\'' + server.id + '\\')" title="Refresh" id="refresh-' + server.id + '">' +
                '<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>' +
              '</button>' +
              '<button class="btn btn-icon btn-outline-teal" onclick="editServer(\\'' + server.id + '\\')" title="Manage Tools">' +
                '<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5" /></svg>' +
              '</button>' +
              '<button class="btn btn-icon ' + (server.enabled ? 'btn-outline-warning' : 'btn-outline-success') + '" onclick="toggleServer(\\'' + server.id + '\\')" title="' + (server.enabled ? 'Disable' : 'Enable') + '">' +
                '<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/>' +
                '<path d="M7 6a7.75 7.75 0 1 0 10 0" /><path d="M12 4l0 8" />' +
                '</svg>' +
              '</button>' +
              '<button class="btn btn-icon btn-outline-danger" onclick="deleteServer(\\'' + server.id + '\\', \\'' + escapeHtml(server.name) + '\\')" title="Delete">' +
                '<svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>' +
              '</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');

      document.getElementById('serversContainer').innerHTML =
        '<div class="table-responsive"><table class="table table-vcenter card-table"><thead><tr>' +
        '<th>Status</th><th>Connection</th><th>Name</th><th>Type</th><th>Tools</th><th>Configuration</th><th class="w-1">Actions</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function formatConfig(type, config) {
      if (type === 'stdio') {
        var cmd = config.command || '-';
        var args = config.args ? config.args.join(' ') : '';
        return cmd + (args ? ' ' + args : '');
      }
      var url = config.url || '-';
      if (url.includes('?')) {
        var parts = url.split('?');
        var maskedParams = parts[1].split('&').map(function(param) {
          return param.split('=')[0] + '=***';
        }).join('&');
        return parts[0] + '?' + maskedParams;
      }
      return url;
    }

    function getConnectionBadge(server) {
      var state = server.connectionState || (server.connected ? 'connected' : 'offline');
      switch (state) {
        case 'connected':
          return '<span class="badge bg-success text-white">' +
            '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-sm me-1" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>' +
            'Connected</span>';
        case 'reconnecting':
          var attempts = server.reconnectAttempts || 0;
          var max = server.maxReconnectAttempts || 5;
          return '<span class="badge bg-warning text-dark" title="Reconnect attempt ' + attempts + '/' + max + '">' +
            '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-sm me-1 spin" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>' +
            'Reconnecting (' + attempts + '/' + max + ')</span>';
        case 'failed':
          return '<span class="badge bg-danger text-white" title="' + escapeHtml(server.lastError || 'Max reconnect attempts reached') + '">' +
            '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-sm me-1" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z" /></svg>' +
            'Failed</span>';
        default:
          if (server.lastError) {
            return '<span class="badge bg-danger text-white" title="' + escapeHtml(server.lastError) + '">' +
              '<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-sm me-1" width="16" height="16" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z" /></svg>' +
              'Error</span>';
          }
          return '<span class="badge bg-secondary text-white">Offline</span>';
      }
    }

    function getAuthType(server) {
      if (server.type === 'stdio') return 'Local';
      var url = server.config ? server.config.url || '' : '';
      if (url.includes('?') && url.includes('=')) return 'URL Param';
      var headers = server.config ? server.config.headers : null;
      if (!headers || Object.keys(headers).length === 0) return 'None';
      var authHeader = headers['Authorization'] || headers['authorization'];
      if (authHeader) {
        if (authHeader.startsWith('Bearer ')) return 'Bearer';
        if (authHeader.startsWith('Basic ')) return 'Basic';
        return 'Auth';
      }
      if (headers['X-API-Key'] || headers['x-api-key']) return 'API Key';
      return 'Custom';
    }

    async function addServer() {
      var name = document.getElementById('serverName').value.trim();
      var type = document.getElementById('serverType').value;
      var config = getConfigFromFields();

      if (!name) {
        showNotification('Please enter a server name', 'warning');
        return;
      }

      if (type === 'stdio') {
        if (!config.command) {
          showNotification('Please enter a command for the stdio server', 'warning');
          return;
        }
      } else {
        if (!config.url) {
          showNotification('Please enter a server URL', 'warning');
          return;
        }
      }

      var addBtn = document.querySelector('button[onclick="addServer()"]');
      var originalBtnHtml = addBtn.innerHTML;
      addBtn.disabled = true;
      addBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Testing connection...';

      try {
        var response = await fetch('/mcp-servers/api/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, type: type, config: config })
        });
        var data = await response.json();

        if (response.ok) {
          showNotification(data.message || 'MCP server added successfully', 'success');
          document.getElementById('serverName').value = '';
          document.getElementById('serverType').value = 'http';
          updateConfigFields();
          loadServers();
        } else {
          showNotification(data.error || 'Failed to add server', 'danger');
        }
      } catch (error) {
        showNotification('Network error: ' + error.message, 'danger');
      } finally {
        addBtn.disabled = false;
        addBtn.innerHTML = originalBtnHtml;
      }
    }

    async function toggleServer(id) {
      try {
        var response = await fetch('/mcp-servers/api/' + id + '/toggle', { method: 'POST' });
        var data = await response.json();
        if (response.ok) {
          showNotification(data.message, 'success');
          loadServers();
        } else {
          showNotification(data.error, 'danger');
        }
      } catch (error) {
        showNotification('Network error: ' + error.message, 'danger');
      }
    }

    async function refreshAllServers() {
      var btn = document.getElementById('refreshAllBtn');
      var originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Refreshing...';

      try {
        var response = await fetch('/mcp-servers/api/refresh', { method: 'POST' });
        var data = await response.json();
        if (response.ok) {
          showNotification(data.message || 'All connections refreshed', 'success');
          loadServers();
        } else {
          showNotification(data.error || 'Failed to refresh', 'danger');
        }
      } catch (error) {
        showNotification('Network error: ' + error.message, 'danger');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }

    async function refreshServer(id) {
      var btn = document.getElementById('refresh-' + id);
      if (!btn) return;
      var originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      try {
        var response = await fetch('/mcp-servers/api/' + id + '/refresh', { method: 'POST' });
        var data = await response.json();
        if (response.ok) {
          showNotification(data.message || 'Server refreshed', 'success');
          loadServers();
        } else {
          showNotification(data.error || 'Failed to refresh server', 'danger');
        }
      } catch (error) {
        showNotification('Network error: ' + error.message, 'danger');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }

    var currentServerTools = [];

    async function editServer(id) {
      try {
        document.getElementById('editServerId').value = id;
        document.getElementById('toolsLoadingContainer').classList.remove('d-none');
        document.getElementById('toolsContainer').classList.add('d-none');
        document.getElementById('toolsNotConnected').classList.add('d-none');
        document.getElementById('toolsFilter').value = '';

        if (editModal) editModal.show();

        var response = await fetch('/mcp-servers/api/' + id + '/tools');
        var data = await response.json();

        document.getElementById('toolsLoadingContainer').classList.add('d-none');

        if (!response.ok) {
          showNotification(data.error, 'danger');
          if (editModal) editModal.hide();
          return;
        }

        document.getElementById('editServerName').textContent = data.server.name + ' Tools';

        if (!data.connected) {
          document.getElementById('toolsNotConnected').classList.remove('d-none');
          return;
        }

        currentServerTools = data.tools;
        renderToolsList(currentServerTools);
        document.getElementById('toolsContainer').classList.remove('d-none');
        document.getElementById('toolsCount').textContent = currentServerTools.length + ' tools';
      } catch (error) {
        document.getElementById('toolsLoadingContainer').classList.add('d-none');
        showNotification('Network error: ' + error.message, 'danger');
        if (editModal) editModal.hide();
      }
    }

    function renderToolsList(tools) {
      var container = document.getElementById('toolsList');
      if (tools.length === 0) {
        container.innerHTML = '<div class="text-muted text-center py-3">No tools available</div>';
        return;
      }
      container.innerHTML = tools.map(function(tool) {
        return '<label class="list-group-item d-flex align-items-start tool-item" data-tool-name="' + escapeHtml(tool.name) + '">' +
          '<input class="form-check-input me-3 mt-1 tool-checkbox" type="checkbox" value="' + escapeHtml(tool.name) + '"' + (!tool.disabled ? ' checked' : '') + '>' +
          '<div class="flex-grow-1">' +
            '<div class="fw-bold">' + escapeHtml(tool.name) + '</div>' +
            '<small class="text-muted">' + escapeHtml(tool.description || 'No description') + '</small>' +
          '</div>' +
        '</label>';
      }).join('');
    }

    function filterTools() {
      var filter = document.getElementById('toolsFilter').value.toLowerCase();
      var items = document.querySelectorAll('.tool-item');
      items.forEach(function(item) {
        var name = item.dataset.toolName.toLowerCase();
        var desc = item.querySelector('.text-muted') ? item.querySelector('.text-muted').textContent.toLowerCase() : '';
        item.style.display = (name.includes(filter) || desc.includes(filter)) ? '' : 'none';
      });
    }

    function selectAllTools(enable) {
      var checkboxes = document.querySelectorAll('.tool-checkbox');
      checkboxes.forEach(function(cb) { cb.checked = enable; });
    }

    async function saveToolSettings() {
      var id = document.getElementById('editServerId').value;
      var checkboxes = document.querySelectorAll('.tool-checkbox');
      var disabledTools = [];
      checkboxes.forEach(function(cb) {
        if (!cb.checked) disabledTools.push(cb.value);
      });

      var saveBtn = document.querySelector('button[onclick="saveToolSettings()"]');
      var originalHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';

      try {
        var response = await fetch('/mcp-servers/api/' + id + '/tools', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disabledTools: disabledTools })
        });
        var data = await response.json();
        if (response.ok) {
          showNotification(data.message || 'Tool settings saved', 'success');
          if (editModal) editModal.hide();
          loadServers();
        } else {
          showNotification(data.error, 'danger');
        }
      } catch (error) {
        showNotification('Network error: ' + error.message, 'danger');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
      }
    }

    async function deleteServer(id, name) {
      if (!confirm('Delete MCP server "' + name + '"? This cannot be undone.')) return;
      try {
        var response = await fetch('/mcp-servers/api/' + id, { method: 'DELETE' });
        var data = await response.json();
        if (response.ok) {
          showNotification('MCP server deleted', 'success');
          loadServers();
        } else {
          showNotification(data.error, 'danger');
        }
      } catch (error) {
        showNotification('Network error: ' + error.message, 'danger');
      }
    }

    function showNotification(message, type) {
      type = type || 'info';
      var notification = document.getElementById('notification');
      var textElement = document.getElementById('notificationText');
      notification.className = 'alert alert-' + type + ' alert-dismissible';
      textElement.textContent = message;
      notification.classList.remove('d-none');
      notification.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      var delay = (type === 'danger' || type === 'warning') ? 8000 : 5000;
      setTimeout(function() { notification.classList.add('d-none'); }, delay);
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  </script>`

    return generateLayout({
        title: "MCP-Funnel - MCP Servers",
        content,
        currentPage: "mcp-servers",
        scripts,
        role,
        username
    })
}

export { renderMcpServersPage }
