// MCP-Funnel — Multi-user MCP server management
// Copyright (c) 2026 Matthias Brusdeylins
// SPDX-License-Identifier: GPL-3.0-only
// 100% AI-generated code (vibe-coding with Claude)

interface LayoutOptions {
    title: string
    content: string
    currentPage?: string
    scripts?: string
    role?: "admin" | "user"
    username?: string
}

// Inline SVG logo paths extracted from gfx/mcp-w.svg (viewBox="0 0 1056 1022")
// The paths use currentColor so they adapt to the context
const MCP_LOGO_PATHS = `<g transform="matrix(0.1,0,0,-0.1,-472.151,1510.49)">
<path d="M9310,15100C8434,15075 7879,15032 7080,14929C5902,14778 5110,14533 4844,14236C4774,14159 4729,14058 4723,13963C4706,13721 4847,13542 5185,13372C5363,13282 5520,13227 5825,13145C6168,13053 6245,13024 6354,12946C6513,12833 6577,12747 6898,12220C7010,12036 7254,11642 7355,11480C7395,11417 7508,11232 7607,11070C7706,10908 7861,10656 7952,10510C8042,10364 8145,10198 8180,10140C8215,10082 8286,9968 8338,9885C8390,9803 8484,9650 8548,9545C8611,9441 8675,9337 8690,9315C8716,9276 9192,8506 9276,8365C9299,8327 9339,8256 9365,8207C9390,8159 9422,8113 9435,8104C9471,8080 9624,8053 9847,8031C9959,8019 10061,8010 10074,8010C10097,8010 10095,8016 10028,8143C9869,8444 9628,8849 9270,9420C9216,9505 9116,9668 9047,9782C8978,9896 8897,10026 8869,10072C8840,10118 8717,10317 8595,10515C8473,10713 8322,10958 8258,11060C8128,11269 7934,11585 7727,11925C7650,12052 7544,12223 7492,12305C7302,12605 7130,12895 7141,12899C7147,12901 7188,12897 7233,12891C7514,12851 7715,12755 7886,12578C7991,12469 8037,12403 8160,12180C8216,12078 8313,11907 8375,11800C8437,11693 8539,11515 8602,11405C8665,11295 8785,11086 8869,10940C9030,10661 9062,10605 9262,10260C9330,10142 9413,9998 9445,9940C9477,9882 9545,9765 9595,9680C9646,9595 9714,9478 9747,9420C9780,9362 9893,9167 9997,8985C10102,8804 10247,8552 10320,8425C10393,8299 10477,8155 10507,8105C10584,7980 10613,7919 10654,7802C10704,7657 10721,7563 10722,7425C10723,7284 10714,7243 10629,6978C10566,6780 10482,6461 10455,6310C10438,6223 10437,6219 10378,6155C10288,6058 10145,5941 9965,5822C9815,5722 9663,5633 9655,5642C9653,5644 9637,5747 9620,5870C9580,6160 9551,6316 9489,6575C9384,7016 9294,7288 9120,7700C8857,8322 8665,8644 7619,10215C6774,11485 6488,11919 6198,12375C6121,12496 6042,12619 6022,12649L5985,12704L5796,12751C5573,12808 5426,12855 5227,12935C5208,12943 5240,12884 5407,12610C5652,12206 5785,11997 6148,11440C6190,11377 6553,10830 6955,10225C8272,8245 8404,8025 8670,7355C8928,6704 9084,5981 9135,5205C9156,4873 9153,4889 9193,4897C9479,4950 9917,5136 10223,5334C10561,5553 10776,5747 10908,5950C10964,6038 10978,6077 11005,6236C11036,6417 11104,6681 11170,6878C11283,7217 11299,7373 11249,7671C11230,7791 11188,7946 11151,8039C11125,8104 11026,8301 10978,8385C10959,8418 10830,8641 10693,8880C10556,9119 10412,9369 10373,9435C10335,9501 10243,9659 10170,9785C10097,9912 10015,10053 9987,10100C9960,10147 9893,10264 9838,10360C9783,10456 9662,10666 9570,10825C9431,11066 9144,11565 8972,11865C8950,11904 8857,12068 8764,12230C8469,12749 8429,12811 8296,12949C8157,13092 8005,13201 7823,13287C7630,13377 7535,13399 7065,13466C6241,13582 5752,13701 5417,13866C5308,13919 5306,13923 5378,13959C5930,14238 7124,14443 8675,14525C9581,14573 10490,14573 11350,14525C12924,14437 14061,14242 14610,13965C14653,13943 14678,13925 14674,13918C14663,13900 14455,13806 14319,13757C14072,13667 13587,13559 13125,13490C13087,13484 13043,13477 13027,13474C12998,13468 13003,13477 12798,13120C12746,13029 12611,12795 12498,12600C12386,12405 12262,12189 12223,12120C12183,12051 12096,11899 12028,11783C11960,11666 11797,11383 11666,11153C11534,10923 11382,10659 11327,10565C11273,10472 11174,10301 11108,10185C10918,9856 10775,9607 10761,9585C10749,9567 10758,9547 10841,9405C10892,9317 10964,9192 11000,9128L11067,9011L11285,9393C11406,9603 11585,9915 11683,10085C11782,10256 11905,10469 11958,10560C12010,10651 12058,10731 12065,10738C12078,10752 12160,10767 12443,10805C12772,10849 12939,10886 13127,10956C13504,11096 13777,11317 14015,11675C14186,11932 14651,12692 14776,12917C14797,12955 14899,13134 15004,13315C15248,13739 15245,13735 15265,13804C15290,13891 15282,14017 15247,14094C15208,14178 15156,14244 15081,14304C14817,14516 14378,14674 13675,14809C12900,14958 12034,15049 11005,15090C10653,15104 9661,15110 9310,15100ZM14284,13158C14280,13151 14242,13089 14200,13020C14157,12951 14083,12830 14034,12750C13500,11877 13506,11886 13380,11759C13231,11609 13093,11520 12910,11459C12776,11413 12410,11344 12422,11366C12425,11371 12472,11452 12527,11545C12582,11639 12684,11816 12755,11940C12825,12064 12929,12244 12985,12340C13041,12436 13131,12592 13185,12685C13338,12950 13351,12970 13374,12975C13386,12977 13483,12995 13590,13015C13798,13053 14155,13131 14230,13154C14287,13172 14293,13173 14284,13158Z" fill="currentColor" fill-rule="nonzero"/>
<path d="M12180,13385C11957,13363 11678,13343 11275,13320C10554,13278 9479,13280 8695,13324C8569,13332 8463,13336 8461,13334C8458,13331 8501,13284 8556,13227C8683,13098 8798,12958 8868,12851C8930,12754 9215,12260 9460,11825C9500,11754 9579,11616 9636,11520C9732,11356 9934,11003 10075,10755C10109,10695 10204,10528 10285,10385C10366,10242 10451,10092 10472,10053C10494,10013 10515,9980 10518,9980C10522,9980 10535,9999 10548,10023C10561,10046 10599,10115 10632,10175C10665,10236 10768,10416 10860,10575C10952,10735 11075,10948 11133,11050C11191,11152 11292,11327 11358,11440C11424,11553 11477,11645 11477,11646C11472,11649 10880,11628 10855,11624C10824,11619 10791,11566 10571,11173C10546,11128 10522,11090 10518,11090C10511,11090 10418,11252 9991,12005C9841,12269 9687,12540 9649,12606C9611,12673 9580,12732 9580,12736C9580,12741 9804,12745 10078,12745C10351,12745 10665,12749 10775,12753C11055,12763 11375,12779 11438,12785C11466,12788 11490,12788 11490,12785C11490,12779 11368,12560 11285,12415L11233,12325L11269,12322C11301,12318 11872,12339 11876,12343C11886,12353 12480,13398 12480,13405C12480,13412 12440,13410 12180,13385Z" fill="currentColor" fill-rule="nonzero"/>
<path d="M13267,10599C13211,10566 12883,10485 12665,10450C12594,10438 12532,10426 12527,10423C12504,10409 11662,9121 11439,8759C11379,8662 11330,8578 11330,8572C11330,8566 11365,8490 11408,8403C11483,8250 11549,8076 11574,7968L11586,7915L11619,7978C11636,8013 11679,8090 11714,8148C11749,8207 11785,8270 11794,8288C11864,8425 12884,9986 13222,10472C13270,10542 13310,10602 13310,10605C13310,10613 13286,10610 13267,10599Z" fill="currentColor" fill-rule="nonzero"/>
</g>`

// Favicon: simplified funnel icon (works at small sizes where the detailed logo would be illegible)
const MCP_FUNNEL_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23206bc4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 3h16a1 1 0 0 1 .857 1.515L14 16v3a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-3L3.143 4.515A1 1 0 0 1 4 3z' /%3E%3C/svg%3E"

function inlineLogo (size: number, cssClass: string): string {
    return `<svg class="${cssClass}" width="${size}" height="${size}" viewBox="0 0 1056 1022" xmlns="http://www.w3.org/2000/svg" style="fill-rule:evenodd;clip-rule:evenodd;">${MCP_LOGO_PATHS}</svg>`
}

function getTablerIcon (iconName: string): string {
    const icons: Record<string, string> = {
        "layout-dashboard": "<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M4 4h6v8h-6z\" /><path d=\"M4 16h6v4h-6z\" /><path d=\"M14 12h6v8h-6z\" /><path d=\"M14 4h6v4h-6z\" />",
        "plug-connected": "<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1 -5 -5l1.5 -1.5z\" /><path d=\"M17 12l-5 -5l1.5 -1.5a3.536 3.536 0 1 1 5 5l-1.5 1.5z\" /><path d=\"M3 21l2.5 -2.5\" /><path d=\"M18.5 5.5l2.5 -2.5\" /><path d=\"M10 14l-2 2\" /><path d=\"M10 10l4 4\" />",
        "users": "<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" /><path d=\"M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2\" /><path d=\"M16 3.13a4 4 0 0 1 0 7.75\" /><path d=\"M21 21v-2a4 4 0 0 0 -3 -3.85\" />",
        "settings": "<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z\" /><path d=\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />"
    }
    return icons[iconName] || ""
}

function getThemeIcon (): string {
    return "<path stroke=\"none\" d=\"M0 0h24v24H0z\" fill=\"none\"/><path d=\"M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" /><path d=\"M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7\" />"
}

function generateSidebar (currentPage: string, role: "admin" | "user", username: string): string {
    interface MenuItem {
        id: string
        icon: string
        label: string
        href: string
    }

    const menuItems: MenuItem[] = [
        { id: "dashboard",   icon: "layout-dashboard", label: "Dashboard",   href: "/dashboard" },
        { id: "mcp-servers", icon: "plug-connected",   label: "MCP Servers", href: "/mcp-servers/manage" }
    ]

    if (role === "admin") {
        menuItems.push({ id: "users", icon: "users", label: "Users", href: "/users/manage" })
    }

    menuItems.push({ id: "settings", icon: "settings", label: "Settings", href: "/settings" })

    const menuHTML = menuItems.map(item => {
        const active = item.id === currentPage ? "active" : ""
        return `
      <li class="nav-item ${active}">
        <a class="nav-link" href="${item.href}">
          <span class="nav-link-icon d-md-none d-lg-inline-block">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
              ${getTablerIcon(item.icon)}
            </svg>
          </span>
          <span class="nav-link-title">${item.label}</span>
        </a>
      </li>`
    }).join("")

    // Sidebar is always data-bs-theme="dark", so white logo (currentColor = white text)
    return `
    <aside class="navbar navbar-vertical navbar-expand-lg" data-bs-theme="dark">
      <div class="container-fluid">
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#sidebar-menu" aria-controls="sidebar-menu" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="d-flex flex-column align-items-center w-100 d-none d-lg-flex">
          <h1 class="navbar-brand navbar-brand-autodark mb-0">
            <a href="/dashboard" class="d-flex align-items-center" style="color: inherit; text-decoration: none;">
              ${inlineLogo(28, "me-2")}
              <span class="navbar-brand-text">MCP-Funnel</span>
            </a>
          </h1>
          <small class="text-secondary" style="font-size: 0.65rem; opacity: 0.5; margin-top: -0.25rem;">v1.0.0</small>
        </div>
        <h1 class="navbar-brand navbar-brand-autodark d-lg-none mb-0">
          <a href="/dashboard" class="d-flex align-items-center" style="color: inherit; text-decoration: none;">
            ${inlineLogo(28, "me-2")}
            <span class="navbar-brand-text">MCP-Funnel</span>
          </a>
        </h1>
        <div class="navbar-nav flex-row d-lg-none">
          <div class="nav-item dropdown">
            <a href="/logout" class="nav-link d-flex lh-1 text-reset p-0">
              <span class="avatar avatar-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                  <path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
                  <path d="M9 12h12l-3 -3" />
                  <path d="M18 15l3 -3" />
                </svg>
              </span>
            </a>
          </div>
        </div>
        <div class="collapse navbar-collapse d-flex flex-column" id="sidebar-menu">
          <ul class="navbar-nav pt-lg-3">
            ${menuHTML}
          </ul>
          <div class="mt-auto w-100">
            <hr class="my-3" style="border-color: rgba(255,255,255,0.1);" />
            <ul class="navbar-nav">
              <li class="nav-item">
                <button id="theme-toggle-btn" class="nav-link w-100 text-start border-0 bg-transparent" onclick="toggleTheme()">
                  <span class="nav-link-icon d-md-none d-lg-inline-block">
                    <svg id="theme-toggle-icon" xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      ${getThemeIcon()}
                    </svg>
                  </span>
                  <span id="theme-toggle-text" class="nav-link-title">Light Mode</span>
                </button>
              </li>
              <li class="nav-item">
                <a class="nav-link text-danger" href="/logout">
                  <span class="nav-link-icon d-md-none d-lg-inline-block">
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                      <path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
                      <path d="M9 12h12l-3 -3" />
                      <path d="M18 15l3 -3" />
                    </svg>
                  </span>
                  <span class="nav-link-title">Logout (${username})</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </aside>`
}

function generatePageHeader (title: string, subtitle = "", actions = ""): string {
    return `
    <div class="page-header d-print-none">
      <div class="container-xl">
        <div class="row g-2 align-items-center">
          <div class="col">
            <div class="page-pretitle">${subtitle}</div>
            <h2 class="page-title">${title}</h2>
          </div>
          ${actions ? `<div class="col-auto ms-auto d-print-none">${actions}</div>` : ""}
        </div>
      </div>
    </div>`
}

function generateLayout (opts: LayoutOptions): string {
    const { title, content, currentPage = "dashboard", scripts = "", role = "admin", username = "" } = opts
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <meta http-equiv="X-UA-Compatible" content="ie=edge"/>
  <title>${title}</title>
  <link rel="icon" type="image/svg+xml" href="${MCP_FUNNEL_FAVICON}"/>
  <link href="https://cdn.jsdelivr.net/npm/@tabler/core@latest/dist/css/tabler.min.css" rel="stylesheet"/>
  <link href="https://cdn.jsdelivr.net/npm/@tabler/core@latest/dist/css/tabler-vendors.min.css" rel="stylesheet"/>
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
<body>
  <div class="page">
    ${generateSidebar(currentPage, role, username)}
    <div class="page-wrapper">
      ${content}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tabler/core@latest/dist/js/tabler.min.js"></script>
  <script>
    var ICON_SUN = '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" />';
    var ICON_MOON = '<path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />';
    function updateThemeButton(theme) {
      var icon = document.getElementById('theme-toggle-icon');
      var text = document.getElementById('theme-toggle-text');
      if (!icon || !text) return;
      if (theme === 'light') { icon.innerHTML = ICON_MOON; text.textContent = 'Dark Mode'; }
      else { icon.innerHTML = ICON_SUN; text.textContent = 'Light Mode'; }
    }
    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-bs-theme');
      var next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-bs-theme', next);
      localStorage.setItem('theme', next);
      updateThemeButton(next);
    }
    document.addEventListener('DOMContentLoaded', function() {
      var theme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
      updateThemeButton(theme);
    });
  </script>
  ${scripts}
</body>
</html>`
}

export { generateLayout, generatePageHeader, inlineLogo, MCP_LOGO_PATHS, MCP_FUNNEL_FAVICON }
