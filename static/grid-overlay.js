/**
 * PRISM Grid Overlay + Crawler Testing Framework
 * ================================================
 *
 * Interactive:  Ctrl+G toggle grid  |  Ctrl+F toggle feedback panel
 * Programmatic: window.prism.* API for automated crawlers
 *
 * Code scheme:  Letter = zone (H=header, N=nav, S=stat, C=card, T=table…)
 *               Number = position (1-based, left→right, top→bottom)
 *
 * Crawler API:
 *   prism.on()                    — activate grid
 *   prism.off()                   — deactivate grid
 *   prism.codes()                 — list all codes on current page
 *   prism.at(code)                — get { el, rect, desc } for a code
 *   prism.tap(code, note?)        — log a click on a code (no navigation)
 *   prism.path.start(name?)       — begin a named path
 *   prism.path.step(code, note?)  — add a step to current path
 *   prism.path.end()              — close current path
 *   prism.note(code, text)        — attach a note to a code
 *   prism.errors()                — return captured JS errors
 *   prism.log()                   — return full feed log
 *   prism.dump()                  — full JSON export (log + errors + paths + meta)
 *   prism.clear()                 — reset everything
 *   prism.find(code)              — scroll to element and highlight it
 *
 * Non-destructive guarantees:
 *   - All overlay DOM carries data-prism-ignore so page queries skip it
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
    { letter: "B", sel: "button:not([data-prism-ignore]), a.btn:not([data-prism-ignore]), a.link-button:not([data-prism-ignore]), .btn:not([data-prism-ignore])" },
    { letter: "C", sel: "section.card, .card:not([data-prism-ignore])" },
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
      navigator.sendBeacon("/prism/save", new Blob([payload], { type: "application/json" }));
    } catch (e) { /* silent — persistence is best-effort */ }
  }
  function nowShort() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  function isPrismEl(el) {
    return el && (el.hasAttribute("data-prism-ignore") || el.closest("[data-prism-ignore]"));
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
        if (seen.has(el) || !isVisible(el) || isPrismEl(el)) return;
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
    b.className = "prism-grid-badge";
    b.textContent = code;
    b.dataset.code = code;
    b.setAttribute("data-prism-ignore", "");
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

    el.classList.add("prism-grid-outline");
    el.dataset.prismCode = code;
    taggedEls.push(el);

    // Element click intercept — only when grid active, never on form elements
    el._prismClick = function (e) {
      if (!gridActive || isFormEl(el)) return;
      e.preventDefault();
      e.stopPropagation();
      logClick(code);
    };
    el.addEventListener("click", el._prismClick, true);
  }

  /* ═══════════════════════════════════════════════════════
     Pane ID badges (dev-only, toggleable with grid)
     ═══════════════════════════════════════════════════════ */
  var paneBadges = [];

  function paintPaneBadges() {
    clearPaneBadges();
    document.querySelectorAll("[data-pane-id]").forEach(function (pane) {
      if (isPrismEl(pane)) return;
      var id = pane.dataset.paneId;
      var r = pane.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      var badge = document.createElement("div");
      badge.className = "prism-pane-id-badge";
      badge.textContent = id;
      badge.title = "Pane: " + id;
      badge.setAttribute("data-prism-ignore", "");
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
      el.classList.remove("prism-grid-outline");
      delete el.dataset.prismCode;
      if (el._prismClick) {
        el.removeEventListener("click", el._prismClick, true);
        delete el._prismClick;
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
        b.classList.add("prism-badge-flash");
        setTimeout(function () { b.classList.remove("prism-badge-flash"); }, 600);
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
  panel.className = "prism-fb-panel";
  panel.setAttribute("data-prism-ignore", "");
  panel.innerHTML =
    '<div class="prism-fb-header">' +
      '<strong>Feedback Log</strong>' +
      '<span class="prism-fb-count">0</span>' +
      '<span class="prism-fb-err-count" title="JS errors caught">0 err</span>' +
      '<div class="prism-fb-actions">' +
        '<button class="prism-fb-btn prism-fb-path" title="Toggle path mode">Path</button>' +
        '<button class="prism-fb-btn prism-fb-export" title="Copy full dump as JSON">JSON</button>' +
        '<button class="prism-fb-btn prism-fb-copy-text" title="Copy as plain text">Copy</button>' +
        '<button class="prism-fb-btn prism-fb-clear" title="Clear all">Clear</button>' +
        '<button class="prism-fb-btn prism-fb-close">\u00d7</button>' +
      '</div>' +
    '</div>' +
    '<div class="prism-fb-body">' +
      '<div class="prism-fb-entries"></div>' +
      '<div class="prism-fb-form">' +
        '<input class="prism-fb-code-input" placeholder="Code" maxlength="4" data-prism-ignore>' +
        '<input class="prism-fb-note-input" placeholder="Feedback or error note\u2026" data-prism-ignore>' +
        '<button class="prism-fb-btn prism-fb-add" data-prism-ignore>+</button>' +
      '</div>' +
    '</div>';

  // Wire panel buttons
  panel.querySelector(".prism-fb-close").addEventListener("click", togglePanel);
  panel.querySelector(".prism-fb-clear").addEventListener("click", function () {
    feedLog = []; errorLog = []; paths = []; activePath = null;
    renderLog();
  });
  panel.querySelector(".prism-fb-path").addEventListener("click", function () {
    pathMode = !pathMode;
    this.classList.toggle("prism-fb-btn-active", pathMode);
    if (pathMode) {
      pathAPI.start();
    } else if (activePath) {
      pathAPI.end();
    }
  });
  panel.querySelector(".prism-fb-export").addEventListener("click", function () {
    var json = JSON.stringify(buildDump(), null, 2);
    navigator.clipboard.writeText(json).then(function () {
      var b = panel.querySelector(".prism-fb-export");
      b.textContent = "Done!"; setTimeout(function () { b.textContent = "JSON"; }, 1200);
    });
  });
  panel.querySelector(".prism-fb-copy-text").addEventListener("click", function () {
    navigator.clipboard.writeText(exportText()).then(function () {
      var b = panel.querySelector(".prism-fb-copy-text");
      b.textContent = "Done!"; setTimeout(function () { b.textContent = "Copy"; }, 1200);
    });
  });

  var codeInput = panel.querySelector(".prism-fb-code-input");
  var noteInput = panel.querySelector(".prism-fb-note-input");
  panel.querySelector(".prism-fb-add").addEventListener("click", addManual);
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
    var container = panel.querySelector(".prism-fb-entries");
    if (!container) return;
    panel.querySelector(".prism-fb-count").textContent = feedLog.length;
    panel.querySelector(".prism-fb-err-count").textContent = errorLog.length + " err";
    panel.querySelector(".prism-fb-err-count").style.display = errorLog.length ? "" : "none";

    container.innerHTML = "";
    feedLog.forEach(function (entry, i) {
      var row = document.createElement("div");
      row.setAttribute("data-prism-ignore", "");

      if (entry.type === "separator") {
        row.className = "prism-fb-entry prism-fb-separator";
        row.innerHTML = '<span class="prism-fb-sep-line">\u2501\u2501 ' + esc(entry.desc) + ' \u2501\u2501</span>';
      } else if (entry.type === "error-note") {
        row.className = "prism-fb-entry prism-fb-error-entry";
        row.innerHTML =
          '<span class="prism-fb-code prism-fb-err-code">ERR</span>' +
          '<span class="prism-fb-desc">' + esc(entry.desc) + '</span>' +
          '<input class="prism-fb-entry-note" value="' + escA(entry.note) + '" data-idx="' + i + '" data-prism-ignore>' +
          '<button class="prism-fb-entry-del" data-idx="' + i + '" data-prism-ignore>\u00d7</button>';
      } else {
        row.className = "prism-fb-entry";
        row.innerHTML =
          '<span class="prism-fb-code" title="' + esc(entry.desc) + '">' + esc(entry.code) + '</span>' +
          '<span class="prism-fb-desc">' + esc((entry.desc || "").slice(0, 25)) + '</span>' +
          '<input class="prism-fb-entry-note" placeholder="note\u2026" value="' + escA(entry.note) + '" data-idx="' + i + '" data-prism-ignore>' +
          '<button class="prism-fb-entry-del" data-idx="' + i + '" data-prism-ignore>\u00d7</button>';
      }
      container.appendChild(row);
    });

    // Wire inline edits + deletes
    container.querySelectorAll(".prism-fb-entry-note").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var idx = parseInt(this.dataset.idx);
        if (feedLog[idx]) { feedLog[idx].note = this.value; scheduleFlush(); }
      });
    });
    container.querySelectorAll(".prism-fb-entry-del").forEach(function (btn) {
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
    var lines = ["PRISM Feedback — " + location.href + " — " + new Date().toLocaleString(), ""];
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
    panel.classList.toggle("prism-fb-visible", panelOpen);
    fbBtn.classList.toggle("prism-fb-btn-active", panelOpen);
  }

  function activateGrid() {
    if (gridActive) return;
    gridActive = true;
    paintAll();
    gridBtn.classList.add("prism-grid-btn-active");
    gridBtn.title = "Hide grid (Ctrl+G)";
    fbBtn.style.display = "";
  }

  function deactivateGrid() {
    if (!gridActive) return;
    gridActive = false;
    clearBadges();
    gridBtn.classList.remove("prism-grid-btn-active");
    gridBtn.title = "Show grid (Ctrl+G)";
  }

  function toggleGrid() {
    gridActive ? deactivateGrid() : activateGrid();
  }

  /* ═══════════════════════════════════════════════════════
     Draggable panel
     ═══════════════════════════════════════════════════════ */
  (function () {
    var hdr = panel.querySelector(".prism-fb-header");
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
  gridBtn.className = "prism-grid-btn";
  gridBtn.innerHTML = "&#x25a6;";
  gridBtn.title = "Show grid (Ctrl+G)";
  gridBtn.setAttribute("aria-label", "Toggle grid overlay");
  gridBtn.setAttribute("data-prism-ignore", "");
  gridBtn.addEventListener("click", toggleGrid);

  var fbBtn = document.createElement("button");
  fbBtn.className = "prism-grid-btn prism-fb-toggle-btn";
  fbBtn.innerHTML = "&#x270e;";
  fbBtn.title = "Feedback panel (Ctrl+F)";
  fbBtn.setAttribute("aria-label", "Toggle feedback panel");
  fbBtn.setAttribute("data-prism-ignore", "");
  fbBtn.style.display = "none";
  fbBtn.addEventListener("click", togglePanel);

  /* ═══════════════════════════════════════════════════════
     Keyboard shortcuts
     ═══════════════════════════════════════════════════════ */
  document.addEventListener("keydown", function (e) {
    if (isFormEl(e.target) && !isPrismEl(e.target)) return;  // don't intercept normal typing
    if (e.ctrlKey && e.key.toLowerCase() === "g") { e.preventDefault(); toggleGrid(); }
    if (e.ctrlKey && e.key.toLowerCase() === "f") { e.preventDefault(); if (gridActive) togglePanel(); }
  });

  /* ═══════════════════════════════════════════════════════
     Public API — window.prism
     ═══════════════════════════════════════════════════════ */
  window.prism = {
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
      try { navigator.sendBeacon("/prism/clear", new Blob(["{}"], { type: "application/json" })); } catch(e) {}
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
        setTimeout(function () { el.style.outline = ""; el.classList.add("prism-grid-outline"); }, 2000);
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
