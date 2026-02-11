/* MCP-Funnel — Multi-user MCP server management
 * Copyright (c) 2026 Matthias Brusdeylins
 * SPDX-License-Identifier: GPL-3.0-only
 * 100% AI-generated code (vibe-coding with Claude) */

import { generateLayout, generatePageHeader } from "./layout-template.js"

function renderUsersPage (username: string): string {
    const content = `
    ${generatePageHeader("User Management", "Administration", `
      <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#createUserModal">
        <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M12 5l0 14" /><path d="M5 12l14 0" />
        </svg>
        Add User
      </button>
    `)}
    <div class="page-body">
      <div class="container-xl">
        <div class="card">
          <div class="table-responsive">
            <table class="table table-vcenter card-table" id="usersTable">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Requests</th>
                  <th>API Key</th>
                  <th>Created</th>
                  <th>Last Login</th>
                  <th class="w-1">Actions</th>
                </tr>
              </thead>
              <tbody id="usersBody">
                <tr><td colspan="7" class="text-center text-secondary">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Create User Modal -->
    <div class="modal modal-blur fade" id="createUserModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Create User</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-danger d-none" id="createError"></div>
            <div class="mb-3">
              <label class="form-label">Username</label>
              <input type="text" class="form-control" id="newUsername" required>
            </div>
            <div class="mb-3">
              <label class="form-label">Password</label>
              <input type="password" class="form-control" id="newPassword" required>
              <div class="form-hint">Minimum 8 characters</div>
            </div>
            <div class="mb-3">
              <label class="form-label">Confirm Password</label>
              <input type="password" class="form-control" id="newPasswordConfirm" required>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="createUser()">Create User</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div class="modal modal-blur fade" id="editUserModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit User: <span id="editUsername"></span></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-danger d-none" id="editError"></div>
            <input type="hidden" id="editUserId">
            <div class="mb-3">
              <label class="form-label">New Password (leave empty to keep current)</label>
              <input type="password" class="form-control" id="editPassword">
              <div class="form-hint">Minimum 8 characters</div>
            </div>
            <div class="mb-3">
              <label class="form-label">Confirm New Password</label>
              <input type="password" class="form-control" id="editPasswordConfirm">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="updateUser()">Save Changes</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal modal-blur fade" id="deleteUserModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Delete User</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to delete user <strong id="deleteUsername"></strong>? This action cannot be undone.</p>
            <input type="hidden" id="deleteUserId">
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" onclick="deleteUser()">Delete</button>
          </div>
        </div>
      </div>
    </div>`

    const scripts = `<script>
    function escapeHtml(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function maskKey(key) {
      if (!key || key.length <= 12) return key || '';
      return key.substring(0, 8) + '...' + key.substring(key.length - 4);
    }

    async function loadUsers() {
      try {
        var response = await fetch('/users/api/list');
        var users = await response.json();
        var tbody = document.getElementById('usersBody');
        if (!users.length) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">No users found</td></tr>';
          return;
        }
        tbody.innerHTML = users.map(function(u) {
          var statusBadge = u.enabled
            ? '<span class="badge bg-success text-white">Enabled</span>'
            : '<span class="badge bg-secondary text-dark">Disabled</span>';
          var lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never';
          var created = new Date(u.createdAt).toLocaleDateString();
          var reqCount = (u.requestCount || 0).toLocaleString();
          return '<tr>' +
            '<td>' + escapeHtml(u.username) + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td>' + reqCount + '</td>' +
            '<td><code>' + maskKey(u.apiKey) + '</code></td>' +
            '<td>' + created + '</td>' +
            '<td>' + lastLogin + '</td>' +
            '<td><div class="btn-list flex-nowrap">' +
              '<button class="btn btn-sm btn-outline-primary" onclick="showEditUser(\\'' + u.id + '\\', \\'' + escapeHtml(u.username) + '\\')">Edit</button>' +
              '<button class="btn btn-sm btn-outline-' + (u.enabled ? 'warning' : 'success') + '" onclick="toggleUser(\\'' + u.id + '\\', ' + !u.enabled + ')">' + (u.enabled ? 'Disable' : 'Enable') + '</button>' +
              '<button class="btn btn-sm btn-outline-danger" onclick="showDeleteUser(\\'' + u.id + '\\', \\'' + escapeHtml(u.username) + '\\')">Delete</button>' +
            '</div></td>' +
          '</tr>';
        }).join('');
      } catch (err) {
        document.getElementById('usersBody').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load users</td></tr>';
      }
    }

    async function createUser() {
      var username = document.getElementById('newUsername').value;
      var password = document.getElementById('newPassword').value;
      var passwordConfirm = document.getElementById('newPasswordConfirm').value;
      var errorDiv = document.getElementById('createError');
      errorDiv.classList.add('d-none');
      if (!username || !password) { errorDiv.textContent = 'Username and password required'; errorDiv.classList.remove('d-none'); return; }
      if (password.length < 8) { errorDiv.textContent = 'Password must be at least 8 characters'; errorDiv.classList.remove('d-none'); return; }
      if (password !== passwordConfirm) { errorDiv.textContent = 'Passwords do not match'; errorDiv.classList.remove('d-none'); return; }
      try {
        var response = await fetch('/users/api/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, password: password }) });
        var data = await response.json();
        if (response.ok) { bootstrap.Modal.getInstance(document.getElementById('createUserModal')).hide(); document.getElementById('newUsername').value = ''; document.getElementById('newPassword').value = ''; loadUsers(); }
        else { errorDiv.textContent = data.error || 'Failed to create user'; errorDiv.classList.remove('d-none'); }
      } catch (err) { errorDiv.textContent = 'Network error'; errorDiv.classList.remove('d-none'); }
    }

    function showEditUser(id, username) {
      document.getElementById('editUserId').value = id;
      document.getElementById('editUsername').textContent = username;
      document.getElementById('editPassword').value = '';
      document.getElementById('editError').classList.add('d-none');
      new bootstrap.Modal(document.getElementById('editUserModal')).show();
    }

    async function updateUser() {
      var id = document.getElementById('editUserId').value;
      var password = document.getElementById('editPassword').value;
      var passwordConfirm = document.getElementById('editPasswordConfirm').value;
      var errorDiv = document.getElementById('editError');
      errorDiv.classList.add('d-none');
      var body = {};
      if (password) {
        if (password.length < 8) { errorDiv.textContent = 'Password must be at least 8 characters'; errorDiv.classList.remove('d-none'); return; }
        if (password !== passwordConfirm) { errorDiv.textContent = 'Passwords do not match'; errorDiv.classList.remove('d-none'); return; }
        body.password = password;
      }
      try {
        var response = await fetch('/users/api/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        var data = await response.json();
        if (response.ok) { bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide(); loadUsers(); }
        else { errorDiv.textContent = data.error || 'Failed to update user'; errorDiv.classList.remove('d-none'); }
      } catch (err) { errorDiv.textContent = 'Network error'; errorDiv.classList.remove('d-none'); }
    }

    async function toggleUser(id, enabled) {
      try {
        await fetch('/users/api/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: enabled }) });
        loadUsers();
      } catch (err) { alert('Network error'); }
    }

    function showDeleteUser(id, username) {
      document.getElementById('deleteUserId').value = id;
      document.getElementById('deleteUsername').textContent = username;
      new bootstrap.Modal(document.getElementById('deleteUserModal')).show();
    }

    async function deleteUser() {
      var id = document.getElementById('deleteUserId').value;
      try {
        var response = await fetch('/users/api/' + id, { method: 'DELETE' });
        if (response.ok) { bootstrap.Modal.getInstance(document.getElementById('deleteUserModal')).hide(); loadUsers(); }
        else { var data = await response.json(); alert(data.error || 'Failed to delete user'); }
      } catch (err) { alert('Network error'); }
    }

    document.getElementById('createUserModal').addEventListener('show.bs.modal', function() {
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('newPasswordConfirm').value = '';
      document.getElementById('createError').classList.add('d-none');
    });

    document.getElementById('editUserModal').addEventListener('show.bs.modal', function() {
      document.getElementById('editPassword').value = '';
      document.getElementById('editPasswordConfirm').value = '';
      document.getElementById('editError').classList.add('d-none');
    });

    document.addEventListener('DOMContentLoaded', loadUsers);
  </script>`

    return generateLayout({
        title: "MCP-Funnel - Users",
        content,
        currentPage: "users",
        scripts,
        role: "admin",
        username
    })
}

export { renderUsersPage }
