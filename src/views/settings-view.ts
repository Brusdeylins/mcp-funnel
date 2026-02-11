/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { generateLayout, generatePageHeader, escapeHtml } from "./layout-template.js"

function renderSettingsPage (role: "admin" | "user", username: string): string {
    const content = `
    ${generatePageHeader("Settings", "MCP-Funnel")}
    <div class="page-body">
      <div class="container-xl">
        <div class="row row-cards">
          <div class="col-lg-6">
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Change Password for <strong>${escapeHtml(username)}</strong></h3>
              </div>
              <div class="card-body">
                <div class="alert alert-danger d-none" id="pwError"></div>
                <div class="alert alert-success d-none" id="pwSuccess"></div>
                <form id="changePasswordForm">
                  <div class="mb-3">
                    <label class="form-label">Current Password</label>
                    <input type="password" class="form-control" id="currentPassword" required>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">New Password</label>
                    <input type="password" class="form-control" id="newPassword" required>
                    <div class="form-hint">Minimum 8 characters</div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Confirm New Password</label>
                    <input type="password" class="form-control" id="confirmPassword" required>
                  </div>
                  <button type="submit" class="btn btn-primary">Change Password</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`

    const scripts = `<script>
    document.getElementById('changePasswordForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var currentPassword = document.getElementById('currentPassword').value;
      var newPassword = document.getElementById('newPassword').value;
      var confirmPassword = document.getElementById('confirmPassword').value;
      var errorDiv = document.getElementById('pwError');
      var successDiv = document.getElementById('pwSuccess');
      errorDiv.classList.add('d-none');
      successDiv.classList.add('d-none');
      if (newPassword !== confirmPassword) { errorDiv.textContent = 'New passwords do not match'; errorDiv.classList.remove('d-none'); return; }
      if (newPassword.length < 8) { errorDiv.textContent = 'Password must be at least 8 characters'; errorDiv.classList.remove('d-none'); return; }
      try {
        var response = await fetch('/settings/api/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword })
        });
        var data = await response.json();
        if (response.ok) {
          successDiv.textContent = 'Password changed successfully';
          successDiv.classList.remove('d-none');
          document.getElementById('changePasswordForm').reset();
        } else {
          errorDiv.textContent = data.error || 'Failed to change password';
          errorDiv.classList.remove('d-none');
        }
      } catch (err) { errorDiv.textContent = 'Network error'; errorDiv.classList.remove('d-none'); }
    });
  </script>`

    return generateLayout({
        title: "MCP-Funnel - Settings",
        content,
        currentPage: "settings",
        scripts,
        role,
        username
    })
}

export { renderSettingsPage }
