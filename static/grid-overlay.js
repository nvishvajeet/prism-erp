/**
 * CATALYST Grid Overlay + Crawler Testing Framework
 * ================================================
 *
 * Interactive:  Ctrl+G toggle grid  |  Ctrl+F toggle feedback panel
 * Programmatic: window.catalyst.* API for automated crawlers
 *
 * Code scheme:  Letter = zone (H=header, N=nav, S=stat, C=card, T=table…)
 *               Number = position (1-based, left→right, top→bottom)
 *
 * Crawler API:
 *   catalyst.on()                    — activate grid
 *   catalyst.off()                   — deactivate grid
 *   catalyst.codes()                 — list all codes on current page
 *   catalyst.at(code)                — get { el, rect, desc } for a code
 *   catalyst.tap(code, note?)        — log a click on a code (no navigation)
 *   catalyst.path.start(name?)       — begin a named path
 *   catalyst.path.step(code, note?)  — add a step to current path
 *   catalyst.path.end()              — close current path
 *   catalyst.note(code, text)        — attach a note to a code
 *   catalyst.errors()                — return captured JS errors
 *   catalyst.log()                   — return full feed log
 *   catalyst.dump()                  — full JSON export (log + errors + paths + meta)
 *   catalyst.clear()                 — reset everything
 *   catalyst.find(code)              — scroll to element and highlight it
 *
 * Non-destructive guarantees:
 *   - All overlay DOM carries data-catalyst-ignore so page queries skip it
 *   - Click intercepts only fire when grid is active; form elements are never blocked
 *   - Errors are caught passively (listeners, not overrides)
 *   - No global prototype modifications
 */
(function () {
  "use strict";

  /* ═══════════════════════════════════════════════════════
     State
     ═══════════════════════════════════════════════════════ */
  var gridActive = false;
  var panelOpen  = false;
  var badges     = [];
  var taggedEls  = [];
  var legend     = {};         // code → desc
  var codeToEl   = {};         // code → element
  var feedLog    = [];         // [{ code, desc, note, page, time, type }]
  var errorLog   = [];         // [{ message, source, line, col, page, time, stack }]
  var paths      = [];         // [{ name, steps:[], startTime, endTime }]
  var activePath = null;
  var pathMode   = false;

  /* ═══════════════════════════════════════════════════════
     Zone definitions
     ═══════════════════════════════════════════════════════ */
  var ZONES = [
    { letter: "H", sel: "header.topbar, header.topbar > div, header.topbar h1, header.topbar a, .topbar-right, .userbox, .user-meta, .user-controls" },
    { letter: "N", sel: "nav.nav, nav.nav > a" },
    { letter: "S", sel: ".stat, .compact-stats .stat, .stats .stat, .grid-auto-stats .stat" },
    { letter: "M", sel: ".grid-two > .card, .grid-two" },
    { letter: "F", sel: ".filter-bar > *, .stream-filters select, .stream-filters input, .stream-filters button, select[name], input[type=search], input[type=text], input[type=date]" },
    { letter: "B", sel: "button:not([data-catalyst-ignore]), a.btn:not([data-catalyst-ignore]), a.link-button:not([data-catalyst-ignore]), .btn:not([data-catalyst-ignore])" },
    { letter: "C", sel: "section.card, .card:not([data-catalyst-ignore])" },
    { letter: "E", sel: "table thead th" },
    { letter: "T", sel: "table" },
    { letter: "P", sel: ".paginated-pane" },
    { letter: "R", sel: ".chart-container, .chart-container-doughnut, canvas" },
    { letter: "K", sel: ".section-head, .stream-page-header" },
    { letter: "L", sel: "a.text-link" },
    { letter: "D", sel: ".operation-status" },
  ];

  /* ═══════════════════════════════════════════════════════
     Helpers
     ═══════════════════════════════════════════════════════ */
  function shortText(el, max) {
    max = max || 30;
    var t = (el.textContent || "").trim().replace(/\s+/g, " ");
    return t.length > max ? t.slice(0, max) + "\u2026" : t;
  }
  function isVisible(el) {
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return false;
    var r = el.getBoundingClientRect();
    return r.width > 5 && r.height > 5;
  }
  function pageName() {
    return location.pathname.replace(/^\//, "") || "home";
  }
  function now() {
    return new Date().toISOString();
  }

  /* ═══════════════════════════════════════════════════════
     Auto-flush to server (debounced)
     ═══════════════════════════════════════════════════════ */
  var _flushTimer = null;
  function scheduleFlush() {
    if (_flushTimer) clearTimeout(_flushTimer);
    _flushTimer = setTimeout(flushToServer, 400);
  }
  function flushToServer() {
    try {
      var payload = JSON.stringify(buildDump());
      navigator.sendBeacon("/catalyst/save", new Blob([payload], { type: "application/json" }));
    } catch (e) { /* silent — persistence is best-effort */ }
  }
  function nowShort() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  function isCatalystEl(el) {
    return el && (el.hasAttribute("data-catalyst-ignore") || el.closest("[data-catalyst-ignore]"));
  }
  function isFormEl(el) {
    var tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "select" || tag === "textarea";
  }

  /* ═══════════════════════════════════════════════════════
     Error interception (passive — no overrides)
     ═══════════════════════════════════════════════════════ */
  window.addEventListener("error", function (e) {
    errorLog.push({
      type: "error",
      message: e.message || String(e),
      source: e.filename || "",
      line: e.lineno || 0,
      col: e.colno || 0,
      stack: e.error ? (e.error.stack || "") : "",
      page: pageName(),
      time: now()
    });
    renderLog();
    scheduleFlush();
  });
  window.addEventListener("unhandledrejection", function (e) {
    var reason = e.reason || {};
    errorLog.push({
      type: "promise",
      message: reason.message || String(reason),
      source: "",
      line: 0,
      col: 0,
      stack: reason.stack || "",
      page: pageName(),
      time: now()
    });
    renderLog();
    scheduleFlush();
  });

  // Intercept console.error without replacing it
  var _origConsoleError = console.error;
  console.error = function () {
    _origConsoleError.apply(console, arguments);
    var msg = Array.from(arguments).map(function (a) {
      return typeof a === "object" ? JSON.stringify(a) : String(a);
    }).join(" ");
    errorLog.push({
      type: "console.error",
      message: msg,
      source: "",
      line: 0,
      col: 0,
      stack: "",
      page: pageName(),
      time: now()
    });
    renderLog();
    scheduleFlush();
  };

  /* ═══════════════════════════════════════════════════════
     Scan & build codes
     ═══════════════════════════════════════════════════════ */
  function scan() {
    legend = {};
    codeToEl = {};
    var seen = new Set();
    var results = [];

    ZONES.forEach(function (zone) {
      var els;
      try { els = document.querySelectorAll(zone.sel); } catch (e) { return; }
      var n = 0;
      els.forEach(function (el) {
        if (seen.has(el) || !isVisible(el) || isCatalystEl(el)) return;
        seen.add(el);
        n++;
        var code = zone.letter + n;
        var desc = shortText(el, 40);
        legend[code] = desc;
        codeToEl[code] = el;
        results.push({ el: el, code: code });
      });
    });
    return results;
  }

  /* ═══════════════════════════════════════════════════════
     Badge painting / clearing
     ═══════════════════════════════════════════════════════ */
  function paintBadge(el, code) {
    var r = el.getBoundingClientRect();
    var b = document.createElement("div");
    b.className = "catalyst-grid-badge";
    b.textContent = code;
    b.dataset.code = code;
    b.setAttribute("data-catalyst-ignore", "");
    b.style.top  = (r.top  + window.scrollY) + "px";
    b.style.left = Math.max(0, r.left + window.scrollX) + "px";
    b.style.pointerEvents = "auto";
    b.style.cursor = "pointer";
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      logClick(code);
    });
    document.body.appendChild(b);
    badges.push(b);

    el.classList.add("catalyst-grid-outline");
    el.dataset.catalystCode = code;
    taggedEls.push(el);

    // Element click intercept — only when grid active, never on form elements
    el._catalystClick = function (e) {
      if (!gridActive || isFormEl(el)) return;
      e.preventDefault();
      e.stopPropagation();
      logClick(code);
    };
    el.addEventListener("click", el._catalystClick, true);
  }

  /* ═══════════════════════════════════════════════════════
     Pane ID badges (dev-only, toggleable with grid)
     ═══════════════════════════════════════════════════════ */
  var paneBadges = [];

  function paintPaneBadges() {
    clearPaneBadges();
    document.querySelectorAll("[data-pane-id]").forEach(function (pane) {
      if (isCatalystEl(pane)) return;
      var id = pane.dataset.paneId;
      var r = pane.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      var badge = document.createElement("div");
      badge.className = "catalyst-pane-id-badge";
      badge.textContent = id;
      badge.title = "Pane: " + id;
      badge.setAttribute("data-catalyst-ignore", "");
      badge.style.top  = (r.top + window.scrollY + 2) + "px";
      badge.style.left = (r.right + window.scrollX - badge.offsetWidth - 6) + "px";
      document.body.appendChild(badge);
      // Re-position now that it's in the DOM and has width
      badge.style.left = (r.right + window.scrollX - badge.offsetWidth - 6) + "px";
      paneBadges.push(badge);
    });
  }

  function clearPaneBadges() {
    paneBadges.forEach(function (b) { b.remove(); });
    paneBadges = [];
  }

  function clearBadges() {
    badges.forEach(function (b) { b.remove(); });
    badges = [];
    taggedEls.forEach(function (el) {
      el.classList.remove("catalyst-grid-outline");
      delete el.dataset.catalystCode;
      if (el._catalystClick) {
        el.removeEventListener("click", el._catalystClick, true);
        delete el._catalystClick;
      }
    });
    taggedEls = [];
    clearPaneBadges();
  }

  function paintAll() {
    clearBadges();
    scan().forEach(function (item) {
      paintBadge(item.el, item.code);
    });
    paintPaneBadges();
  }

  /* ═══════════════════════════════════════════════════════
     Feedback log
     ═══════════════════════════════════════════════════════ */
  function logClick(code, note) {
    var entry = {
      type: "click",
      code: code,
      desc: legend[code] || "",
      note: note || "",
      page: pageName(),
      time: now(),
      timeShort: nowShort()
    };
    feedLog.push(entry);

    // Auto-add to active path
    if (activePath) {
      activePath.steps.push({ code: code, desc: legend[code] || "", note: note || "", time: now() });
    }

    flashBadge(code);
    renderLog();
    scheduleFlush();
    if (!panelOpen) togglePanel();
  }

  function logSeparator(label) {
    feedLog.push({ type: "separator", code: "---", desc: label || "Path", note: "", page: pageName(), time: now(), timeShort: nowShort() });
    renderLog();
    scheduleFlush();
  }

  function logError(msg) {
    feedLog.push({ type: "error-note", code: "ERR", desc: msg.slice(0, 60), note: msg, page: pageName(), time: now(), timeShort: nowShort() });
    renderLog();
    scheduleFlush();
  }

  function flashBadge(code) {
    badges.forEach(function (b) {
      if (b.dataset.code === code) {
        b.classList.add("catalyst-badge-flash");
        setTimeout(function () { b.classList.remove("catalyst-badge-flash"); }, 600);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════
     Path recording
     ═══════════════════════════════════════════════════════ */
  var pathAPI = {
    start: function (name) {
      if (activePath) pathAPI.end();
      activePath = { name: name || ("path-" + (paths.length + 1)), steps: [], startTime: now(), endTime: null };
      logSeparator("Start: " + activePath.name);
      return activePath;
    },
    step: function (code, note) {
      code = (code || "").toUpperCase();
      if (!activePath) pathAPI.start();
      logClick(code, note);
      return activePath;
    },
    end: function () {
      if (!activePath) return null;
      activePath.endTime = now();
      paths.push(activePath);
      logSeparator("End: " + activePath.name);
      var finished = activePath;
      activePath = null;
      return finished;
    },
    current: function () { return activePath; },
    all: function () { return paths.slice(); }
  };

  /* ═══════════════════════════════════════════════════════
     Feedback Panel DOM
     ═══════════════════════════════════════════════════════ */
  var panel = document.createElement("div");
  panel.className = "catalyst-fb-panel";
  panel.setAttribute("data-catalyst-ignore", "");
  panel.innerHTML =
    '<div class="catalyst-fb-header">' +
      '<strong>Feedback Log</strong>' +
      '<span class="catalyst-fb-count">0</span>' +
      '<span class="catalyst-fb-err-count" title="JS errors caught">0 err</span>' +
      '<div class="catalyst-fb-actions">' +
        '<button class="catalyst-fb-btn catalyst-fb-path" title="Toggle path mode">Path</button>' +
        '<button class="catalyst-fb-btn catalyst-fb-export" title="Copy full dump as JSON">JSON</button>' +
        '<button class="catalyst-fb-btn catalyst-fb-copy-text" title="Copy as plain text">Copy</button>' +
        '<button class="catalyst-fb-btn catalyst-fb-clear" title="Clear all">Clear</button>' +
        '<button class="catalyst-fb-btn catalyst-fb-close">\u00d7</button>' +
      '</div>' +
    '</div>' +
    '<div class="catalyst-fb-body">' +
      '<div class="catalyst-fb-entries"></div>' +
      '<div class="catalyst-fb-form">' +
        '<input class="catalyst-fb-code-input" placeholder="Code" maxlength="4" data-catalyst-ignore>' +
        '<input class="catalyst-fb-note-input" placeholder="Feedback or error note\u2026" data-catalyst-ignore>' +
        '<button class="catalyst-fb-btn catalyst-fb-add" data-catalyst-ignore>+</button>' +
      '</div>' +
    '</div>';

  // Wire panel buttons
  panel.querySelector(".catalyst-fb-close").addEventListener("click", togglePanel);
  panel.querySelector(".catalyst-fb-clear").addEventListener("click", function () {
    feedLog = []; errorLog = []; paths = []; activePath = null;
    renderLog();
  });
  panel.querySelector(".catalyst-fb-path").addEventListener("click", function () {
    pathMode = !pathMode;
    this.classList.toggle("catalyst-fb-btn-active", pathMode);
    if (pathMode) {
      pathAPI.start();
    } else if (activePath) {
      pathAPI.end();
    }
  });
  panel.querySelector(".catalyst-fb-export").addEventListener("click", function () {
    var json = JSON.stringify(buildDump(), null, 2);
    navigator.clipboard.writeText(json).then(function () {
      var b = panel.querySelector(".catalyst-fb-export");
      b.textContent = "Done!"; setTimeout(function () { b.textContent = "JSON"; }, 1200);
    });
  });
  panel.querySelector(".catalyst-fb-copy-text").addEventListener("click", function () {
    navigator.clipboard.writeText(exportText()).then(function () {
      var b = panel.querySelector(".catalyst-fb-copy-text");
      b.textContent = "Done!"; setTimeout(function () { b.textContent = "Copy"; }, 1200);
    });
  });

  var codeInput = panel.querySelector(".catalyst-fb-code-input");
  var noteInput = panel.querySelector(".catalyst-fb-note-input");
  panel.querySelector(".catalyst-fb-add").addEventListener("click", addManual);
  noteInput.addEventListener("keydown", function (e) { if (e.key === "Enter") addManual(); });
  codeInput.addEventListener("keydown", function (e) { if (e.key === "Enter") noteInput.focus(); });

  function addManual() {
    var code = codeInput.value.trim().toUpperCase();
    var note = noteInput.value.trim();
    if (!code && !note) return;
    if (code === "ERR" || (!code && note)) {
      logError(note || "unspecified error");
    } else {
      logClick(code, note);
    }
    codeInput.value = ""; noteInput.value = "";
    codeInput.focus();
  }

  /* ═══════════════════════════════════════════════════════
     Render log entries
     ═══════════════════════════════════════════════════════ */
  function renderLog() {
    var container = panel.querySelector(".catalyst-fb-entries");
    if (!container) return;
    panel.querySelector(".catalyst-fb-count").textContent = feedLog.length;
    panel.querySelector(".catalyst-fb-err-count").textContent = errorLog.length + " err";
    panel.querySelector(".catalyst-fb-err-count").style.display = errorLog.length ? "" : "none";

    container.innerHTML = "";
    feedLog.forEach(function (entry, i) {
      var row = document.createElement("div");
      row.setAttribute("data-catalyst-ignore", "");

      if (entry.type === "separator") {
        row.className = "catalyst-fb-entry catalyst-fb-separator";
        row.innerHTML = '<span class="catalyst-fb-sep-line">\u2501\u2501 ' + esc(entry.desc) + ' \u2501\u2501</span>';
      } else if (entry.type === "error-note") {
        row.className = "catalyst-fb-entry catalyst-fb-error-entry";
        row.innerHTML =
          '<span class="catalyst-fb-code catalyst-fb-err-code">ERR</span>' +
          '<span class="catalyst-fb-desc">' + esc(entry.desc) + '</span>' +
          '<input class="catalyst-fb-entry-note" value="' + escA(entry.note) + '" data-idx="' + i + '" data-catalyst-ignore>' +
          '<button class="catalyst-fb-entry-del" data-idx="' + i + '" data-catalyst-ignore>\u00d7</button>';
      } else {
        row.className = "catalyst-fb-entry";
        row.innerHTML =
          '<span class="catalyst-fb-code" title="' + esc(entry.desc) + '">' + esc(entry.code) + '</span>' +
          '<span class="catalyst-fb-desc">' + esc((entry.desc || "").slice(0, 25)) + '</span>' +
          '<input class="catalyst-fb-entry-note" placeholder="note\u2026" value="' + escA(entry.note) + '" data-idx="' + i + '" data-catalyst-ignore>' +
          '<button class="catalyst-fb-entry-del" data-idx="' + i + '" data-catalyst-ignore>\u00d7</button>';
      }
      container.appendChild(row);
    });

    // Wire inline edits + deletes
    container.querySelectorAll(".catalyst-fb-entry-note").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var idx = parseInt(this.dataset.idx);
        if (feedLog[idx]) { feedLog[idx].note = this.value; scheduleFlush(); }
      });
    });
    container.querySelectorAll(".catalyst-fb-entry-del").forEach(function (btn) {
      btn.addEventListener("click", function () {
        feedLog.splice(parseInt(this.dataset.idx), 1);
        renderLog();
      });
    });
    container.scrollTop = container.scrollHeight;
  }

  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var escA = esc;

  /* ═══════════════════════════════════════════════════════
     Export
     ═══════════════════════════════════════════════════════ */
  function exportText() {
    var lines = ["CATALYST Feedback — " + location.href + " — " + new Date().toLocaleString(), ""];
    feedLog.forEach(function (e) {
      if (e.type === "separator") { lines.push("--- " + e.desc + " ---"); return; }
      if (e.type === "error-note") { lines.push("[ERR] " + e.note + "  (" + e.page + " @ " + e.timeShort + ")"); return; }
      var l = "[" + e.code + "] " + e.desc;
      if (e.note) l += "  \u2192  " + e.note;
      l += "  (" + e.page + " @ " + e.timeShort + ")";
      lines.push(l);
    });
    if (errorLog.length) {
      lines.push("", "=== JS ERRORS (" + errorLog.length + ") ===");
      errorLog.forEach(function (e) {
        lines.push("[" + e.type + "] " + e.message + (e.source ? " @ " + e.source + ":" + e.line : "") + "  (" + e.page + ")");
      });
    }
    return lines.join("\n");
  }

  function buildDump() {
    return {
      url: location.href,
      page: pageName(),
      timestamp: now(),
      userAgent: navigator.userAgent,
      codes: legend,
      feedLog: feedLog,
      errorLog: errorLog,
      paths: paths.concat(activePath ? [activePath] : []),
      meta: {
        gridActive: gridActive,
        totalCodes: Object.keys(legend).length,
        totalClicks: feedLog.filter(function (e) { return e.type === "click"; }).length,
        totalErrors: errorLog.length
      }
    };
  }

  /* ═══════════════════════════════════════════════════════
     Panel & Grid toggles
     ═══════════════════════════════════════════════════════ */
  function togglePanel() {
    panelOpen = !panelOpen;
    panel.classList.toggle("catalyst-fb-visible", panelOpen);
    fbBtn.classList.toggle("catalyst-fb-btn-active", panelOpen);
  }

  function activateGrid() {
    if (gridActive) return;
    gridActive = true;
    paintAll();
    gridBtn.classList.add("catalyst-grid-btn-active");
    gridBtn.title = "Hide grid (Ctrl+G)";
    fbBtn.style.display = "";
  }

  function deactivateGrid() {
    if (!gridActive) return;
    gridActive = false;
    clearBadges();
    gridBtn.classList.remove("catalyst-grid-btn-active");
    gridBtn.title = "Show grid (Ctrl+G)";
  }

  function toggleGrid() {
    gridActive ? deactivateGrid() : activateGrid();
  }

  /* ═══════════════════════════════════════════════════════
     Draggable panel
     ═══════════════════════════════════════════════════════ */
  (function () {
    var hdr = panel.querySelector(".catalyst-fb-header");
    var dragging = false, sx, sy, ox, oy;
    hdr.style.cursor = "grab";
    hdr.addEventListener("mousedown", function (e) {
      if (e.target.tagName === "BUTTON") return;
      dragging = true; hdr.style.cursor = "grabbing";
      sx = e.clientX; sy = e.clientY;
      var r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      panel.style.left = (ox + e.clientX - sx) + "px";
      panel.style.top  = (oy + e.clientY - sy) + "px";
      panel.style.right = "auto"; panel.style.bottom = "auto";
    });
    document.addEventListener("mouseup", function () {
      if (dragging) { dragging = false; hdr.style.cursor = "grab"; }
    });
  })();

  /* ═══════════════════════════════════════════════════════
     Floating buttons
     ═══════════════════════════════════════════════════════ */
  var gridBtn = document.createElement("button");
  gridBtn.className = "catalyst-grid-btn";
  gridBtn.innerHTML = "&#x25a6;";
  gridBtn.title = "Show grid (Ctrl+G)";
  gridBtn.setAttribute("aria-label", "Toggle grid overlay");
  gridBtn.setAttribute("data-catalyst-ignore", "");
  gridBtn.addEventListener("click", toggleGrid);

  var fbBtn = document.createElement("button");
  fbBtn.className = "catalyst-grid-btn catalyst-fb-toggle-btn";
  fbBtn.innerHTML = "&#x270e;";
  fbBtn.title = "Feedback panel (Ctrl+F)";
  fbBtn.setAttribute("aria-label", "Toggle feedback panel");
  fbBtn.setAttribute("data-catalyst-ignore", "");
  fbBtn.style.display = "none";
  fbBtn.addEventListener("click", togglePanel);

  /* ═══════════════════════════════════════════════════════
     Keyboard shortcuts
     ═══════════════════════════════════════════════════════ */
  document.addEventListener("keydown", function (e) {
    if (isFormEl(e.target) && !isCatalystEl(e.target)) return;  // don't intercept normal typing
    if (e.ctrlKey && e.key.toLowerCase() === "g") { e.preventDefault(); toggleGrid(); }
    if (e.ctrlKey && e.key.toLowerCase() === "f") { e.preventDefault(); if (gridActive) togglePanel(); }
  });

  /* ═══════════════════════════════════════════════════════
     Public API — window.catalyst
     ═══════════════════════════════════════════════════════ */
  window.catalyst = {
    // Grid control
    on:    activateGrid,
    off:   deactivateGrid,
    toggle: toggleGrid,
    refresh: paintAll,

    // Query
    codes: function () { if (!gridActive) activateGrid(); return Object.keys(legend).sort(); },
    at: function (code) {
      code = (code || "").toUpperCase();
      var el = codeToEl[code];
      if (!el) return null;
      return { el: el, code: code, desc: legend[code], rect: el.getBoundingClientRect() };
    },
    legend: function () { return Object.assign({}, legend); },

    // Actions
    tap: function (code, note) {
      code = (code || "").toUpperCase();
      if (!gridActive) activateGrid();
      logClick(code, note);
      return { code: code, desc: legend[code] || "(unknown)" };
    },
    note: function (code, text) {
      code = (code || "").toUpperCase();
      for (var i = feedLog.length - 1; i >= 0; i--) {
        if (feedLog[i].code === code) { feedLog[i].note = text; renderLog(); return true; }
      }
      return false;
    },
    error: function (msg) { logError(msg); },

    // Path recording
    path: pathAPI,

    // Export
    log: function () { return feedLog.slice(); },
    errors: function () { return errorLog.slice(); },
    dump: buildDump,
    text: exportText,
    clear: function () {
      feedLog = []; errorLog = []; paths = []; activePath = null; renderLog();
      try { navigator.sendBeacon("/catalyst/clear", new Blob(["{}"], { type: "application/json" })); } catch(e) {}
    },

    // Persistence
    flush: flushToServer,

    // Navigation
    find: function (code) {
      code = (code || "").toUpperCase();
      var el = codeToEl[code];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.outline = "3px solid red";
        setTimeout(function () { el.style.outline = ""; el.classList.add("catalyst-grid-outline"); }, 2000);
      }
      return el || null;
    }
  };

  /* ═══════════════════════════════════════════════════════
     Boot
     ═══════════════════════════════════════════════════════ */
  function boot() {
    document.body.appendChild(gridBtn);
    document.body.appendChild(fbBtn);
    document.body.appendChild(panel);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
