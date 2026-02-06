// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

import { MCP_LOGO_PATHS, MCP_FUNNEL_FAVICON } from "./layout-template.js"

function renderSetupPage (): string {
    // Logo adapts to theme via currentColor; in dark mode text is white, in light mode black
    const logoSvg = `<svg width="36" height="36" viewBox="0 0 1056 1022" xmlns="http://www.w3.org/2000/svg" class="text-primary" style="fill-rule:evenodd;clip-rule:evenodd;color:var(--tblr-primary);">${MCP_LOGO_PATHS}</svg>`

    return `<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>MCP-Funnel - Initial Setup</title>
  <link rel="icon" type="image/svg+xml" href="${MCP_FUNNEL_FAVICON}"/>
  <link href="https://cdn.jsdelivr.net/npm/@tabler/core@latest/dist/css/tabler.min.css" rel="stylesheet">
  <style>
    @import url('https://rsms.me/inter/inter.css');
    :root { --tblr-font-sans-serif: 'Inter', -apple-system, BlinkMacSystemFont, San Francisco, Segoe UI, Roboto, Helvetica Neue, sans-serif; }
    body { font-feature-settings: "cv03", "cv04", "cv11"; }
  </style>
  <script>
    (function() {
      var saved = localStorage.getItem('theme');
      var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-bs-theme', theme);
    })();
  </script>
</head>
<body class="d-flex flex-column">
  <div class="page page-center">
    <div class="container container-tight py-4">
      <div class="card card-md">
        <div class="card-body">
          <h1 class="h2 text-center mb-4 d-flex align-items-center justify-content-center gap-2">
            ${logoSvg}
            MCP-Funnel
          </h1>
          <p class="text-center text-secondary mb-4">Initial Setup - Create admin credentials</p>
          <div class="alert alert-danger d-none" role="alert" id="error"></div>
          <form id="setupForm" autocomplete="off">
            <div class="mb-3">
              <label class="form-label" for="username">Username</label>
              <input type="text" class="form-control" id="username" name="username" autocomplete="username" required>
            </div>
            <div class="mb-3">
              <label class="form-label" for="password">Password</label>
              <input type="password" class="form-control" id="password" name="password" autocomplete="new-password" required>
              <div class="form-hint">Minimum 8 characters</div>
            </div>
            <div class="mb-4">
              <label class="form-label" for="passwordConfirm">Confirm Password</label>
              <input type="password" class="form-control" id="passwordConfirm" name="passwordConfirm" autocomplete="new-password" required>
            </div>
            <div class="form-footer">
              <button type="submit" class="btn btn-primary w-100" id="submitBtn">Create Admin Account</button>
            </div>
          </form>
        </div>
      </div>
      <div class="text-center text-secondary mt-3">This is a one-time setup to secure your dashboard.</div>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@tabler/core@latest/dist/js/tabler.min.js"></script>
  <script>
    document.getElementById('setupForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var username = document.getElementById('username').value;
      var password = document.getElementById('password').value;
      var passwordConfirm = document.getElementById('passwordConfirm').value;
      var errorDiv = document.getElementById('error');
      var submitBtn = document.getElementById('submitBtn');
      errorDiv.classList.add('d-none');
      if (password !== passwordConfirm) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.classList.remove('d-none');
        return;
      }
      if (password.length < 8) {
        errorDiv.textContent = 'Password must be at least 8 characters';
        errorDiv.classList.remove('d-none');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Creating account...';
      try {
        var response = await fetch('/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username, password: password }) });
        var data = await response.json();
        if (response.ok) { window.location.href = '/login?setup=success'; }
        else { errorDiv.textContent = data.error || 'Setup failed'; errorDiv.classList.remove('d-none'); submitBtn.disabled = false; submitBtn.innerHTML = 'Create Admin Account'; }
      } catch (err) { errorDiv.textContent = 'Network error'; errorDiv.classList.remove('d-none'); submitBtn.disabled = false; submitBtn.innerHTML = 'Create Admin Account'; }
    });
  </script>
</body>
</html>`
}

export { renderSetupPage }
