/**
 * PRISM Grid Overlay + Feedback Panel
 *
 * Toggle grid:     Ctrl+G  or  floating ▦ button
 * Toggle feedback: Ctrl+F  or  floating ✎ button (appears when grid is on)
 *
 * How it works:
 *   1. Turn on the grid  →  every UI element gets a short code (H1, S3, E4…)
 *   2. Click any badge/element  →  it's logged in the feedback panel
 *   3. Type a note next to each logged item  →  builds an actionable punch-list
 *   4. Export as JSON or plain text  →  hand to the dev / AI agent
 *
 * Code scheme:
 *   Letter = semantic zone  (H=header, N=nav, S=stat, C=card, T=table, E=col-header…)
 *   Number = position within zone (1-based, left→right, top→bottom)
 */
(function () {
  "use strict";

  /* ── State ─────────────────────────────────────────────── */
  var gridActive = false;
  var panelOpen  = false;
  var badges     = [];         // DOM badge elements
  var taggedEls  = [];         // tagged source elements (parallel to badges)
  var legend     = {};         // code → description
  var feedLog    = [];         // [{ code, desc, note, page, ts }]
  var codeToEl   = {};         // code → element (for scroll-to)
  var pathMode   = false;      // when true, clicks add to a "path" sequence

  /* ── Zone definitions ─────────────────────────────────── */
  var ZONES = [
    { letter: "H", sel: "header.topbar, header.topbar > div, header.topbar h1, header.topbar a, .topbar-right, .userbox, .user-meta, .user-controls" },
    { letter: "N", sel: "nav.nav, nav.nav > a" },
    { letter: "S", sel: ".stat, .compact-stats .stat, .stats .stat, .grid-auto-stats .stat" },
    { letter: "M", sel: ".grid-two > .card, .grid-two" },
    { letter: "F", sel: ".filter-bar > *, .stream-filters select, .stream-filters input, .stream-filters button, select[name], input[type=search], input[type=text], input[type=date]" },
    { letter: "B", sel: "button:not(.prism-fb-btn):not(.prism-grid-btn), a.btn, a.link-button, .btn:not(.prism-fb-btn):not(.prism-grid-btn)" },
    { letter: "C", sel: "section.card, .card:not(.prism-grid-badge)" },
    { letter: "E", sel: "table thead th" },
    { letter: "T", sel: "table" },
    { letter: "P", sel: ".paginated-pane" },
    { letter: "R", sel: ".chart-container, .chart-container-doughnut, canvas" },
    { letter: "K", sel: ".section-head, .stream-page-header" },
    { letter: "L", sel: "a.text-link" },
    { letter: "D", sel: ".operation-status" },
  ];

  /* ── Helpers ───────────────────────────────────────────── */
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
  function ts() {
    var d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  /* ── Scan & build codes ────────────────────────────────── */
  function scan() {
    legend = {};
    codeToEl = {};
    var seen = new Set();
    var results = [];

    ZONES.forEach(function (zone) {
      var els = document.querySelectorAll(zone.sel);
      var n = 0;
      els.forEach(function (el) {
        if (seen.has(el)) return;
        if (!isVisible(el)) return;
        if (el.closest(".prism-fb-panel")) return;   // skip our own panel
        if (el.classList.contains("prism-grid-btn") || el.classList.contains("prism-fb-btn")) return;
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

  /* ── Paint / clear badges ──────────────────────────────── */
  function paintBadge(el, code) {
    var r = el.getBoundingClientRect();
    var b = document.createElement("div");
    b.className = "prism-grid-badge";
    b.textContent = code;
    b.dataset.code = code;
    b.style.top  = (r.top  + window.scrollY) + "px";
    b.style.left = Math.max(0, r.left + window.scrollX) + "px";

    // Make badges clickable
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

    // Also allow clicking the element itself
    el._prismClick = function (e) {
      // Don't intercept if user is interacting with form elements
      if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") return;
      if (!gridActive) return;
      e.preventDefault();
      e.stopPropagation();
      logClick(code);
    };
    el.addEventListener("click", el._prismClick, true);
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
  }

  function paintAll() {
    clearBadges();
    var items = scan();
    items.forEach(function (item) {
      paintBadge(item.el, item.code);
    });
  }

  /* ── Feedback log ──────────────────────────────────────── */
  function logClick(code) {
    var entry = {
      code: code,
      desc: legend[code] || "",
      note: "",
      page: pageName(),
      time: ts()
    };
    feedLog.push(entry);
    flashBadge(code);
    renderLog();

    // Auto-open panel if closed
    if (!panelOpen) togglePanel();
  }

  function flashBadge(code) {
    badges.forEach(function (b) {
      if (b.dataset.code === code) {
        b.classList.add("prism-badge-flash");
        setTimeout(function () { b.classList.remove("prism-badge-flash"); }, 600);
      }
    });
  }

  /* ── Feedback panel DOM ────────────────────────────────── */
  var panel = document.createElement("div");
  panel.className = "prism-fb-panel";
  panel.innerHTML =
    '<div class="prism-fb-header">' +
      '<strong>Feedback Log</strong>' +
      '<span class="prism-fb-count">0</span>' +
      '<div class="prism-fb-actions">' +
        '<button class="prism-fb-btn prism-fb-path" title="Toggle path mode: clicks build a sequence">Path</button>' +
        '<button class="prism-fb-btn prism-fb-export" title="Copy log as text">Copy</button>' +
        '<button class="prism-fb-btn prism-fb-clear" title="Clear all entries">Clear</button>' +
        '<button class="prism-fb-btn prism-fb-close" title="Close panel">\u00d7</button>' +
      '</div>' +
    '</div>' +
    '<div class="prism-fb-body">' +
      '<div class="prism-fb-entries"></div>' +
      '<div class="prism-fb-form">' +
        '<input class="prism-fb-code-input" placeholder="Code (e.g. S3)" maxlength="4">' +
        '<input class="prism-fb-note-input" placeholder="Type feedback here\u2026">' +
        '<button class="prism-fb-btn prism-fb-add">+</button>' +
      '</div>' +
    '</div>';

  // Wire up panel buttons
  panel.querySelector(".prism-fb-close").addEventListener("click", togglePanel);
  panel.querySelector(".prism-fb-clear").addEventListener("click", function () {
    feedLog = [];
    renderLog();
  });
  panel.querySelector(".prism-fb-path").addEventListener("click", function () {
    pathMode = !pathMode;
    this.classList.toggle("prism-fb-btn-active", pathMode);
    this.title = pathMode
      ? "Path mode ON: each click adds to the sequence"
      : "Toggle path mode: clicks build a sequence";
    if (pathMode) {
      feedLog.push({ code: "---", desc: "--- Path Start ---", note: "", page: pageName(), time: ts() });
      renderLog();
    }
  });
  panel.querySelector(".prism-fb-export").addEventListener("click", function () {
    var text = exportText();
    navigator.clipboard.writeText(text).then(function () {
      var btn = panel.querySelector(".prism-fb-export");
      btn.textContent = "Copied!";
      setTimeout(function () { btn.textContent = "Copy"; }, 1500);
    });
  });

  // Manual add form
  var codeInput = panel.querySelector(".prism-fb-code-input");
  var noteInput = panel.querySelector(".prism-fb-note-input");
  panel.querySelector(".prism-fb-add").addEventListener("click", addManual);
  noteInput.addEventListener("keydown", function (e) { if (e.key === "Enter") addManual(); });
  codeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      noteInput.focus();
    }
  });

  function addManual() {
    var code = codeInput.value.trim().toUpperCase();
    var note = noteInput.value.trim();
    if (!code && !note) return;
    feedLog.push({
      code: code || "??",
      desc: legend[code] || "(manual)",
      note: note,
      page: pageName(),
      time: ts()
    });
    codeInput.value = "";
    noteInput.value = "";
    codeInput.focus();
    renderLog();
  }

  /* ── Render log entries ────────────────────────────────── */
  function renderLog() {
    var container = panel.querySelector(".prism-fb-entries");
    var count = panel.querySelector(".prism-fb-count");
    count.textContent = feedLog.length;

    container.innerHTML = "";
    feedLog.forEach(function (entry, i) {
      var row = document.createElement("div");
      row.className = "prism-fb-entry" + (entry.code === "---" ? " prism-fb-separator" : "");

      if (entry.code === "---") {
        row.innerHTML = '<span class="prism-fb-sep-line">\u2501\u2501 Path \u2501\u2501</span>';
      } else {
        row.innerHTML =
          '<span class="prism-fb-code" title="' + escHtml(entry.desc) + '">' + escHtml(entry.code) + '</span>' +
          '<span class="prism-fb-desc">' + escHtml(entry.desc.slice(0, 25)) + '</span>' +
          '<input class="prism-fb-entry-note" placeholder="note\u2026" value="' + escAttr(entry.note) + '" data-idx="' + i + '">' +
          '<button class="prism-fb-entry-del" data-idx="' + i + '" title="Remove">\u00d7</button>';
      }
      container.appendChild(row);
    });

    // Wire inline note edits
    container.querySelectorAll(".prism-fb-entry-note").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var idx = parseInt(this.dataset.idx);
        if (feedLog[idx]) feedLog[idx].note = this.value;
      });
    });

    // Wire delete buttons
    container.querySelectorAll(".prism-fb-entry-del").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(this.dataset.idx);
        feedLog.splice(idx, 1);
        renderLog();
      });
    });

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  function escHtml(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function escAttr(s) { return escHtml(s); }

  /* ── Export ─────────────────────────────────────────────── */
  function exportText() {
    var lines = ["PRISM Feedback — " + location.href + " — " + new Date().toLocaleString(), ""];
    feedLog.forEach(function (e) {
      if (e.code === "---") {
        lines.push("--- Path ---");
      } else {
        var line = "[" + e.code + "] " + e.desc;
        if (e.note) line += "  →  " + e.note;
        line += "  (" + e.page + " @ " + e.time + ")";
        lines.push(line);
      }
    });
    return lines.join("\n");
  }

  /* ── Panel toggle ──────────────────────────────────────── */
  function togglePanel() {
    panelOpen = !panelOpen;
    panel.classList.toggle("prism-fb-visible", panelOpen);
    fbBtn.classList.toggle("prism-fb-btn-active", panelOpen);
  }

  /* ── Grid toggle ───────────────────────────────────────── */
  function toggleGrid() {
    gridActive = !gridActive;
    if (gridActive) {
      paintAll();
      gridBtn.classList.add("prism-grid-btn-active");
      gridBtn.title = "Hide grid (Ctrl+G)";
      fbBtn.style.display = "";
    } else {
      clearBadges();
      gridBtn.classList.remove("prism-grid-btn-active");
      gridBtn.title = "Show grid (Ctrl+G)";
      // Keep feedback panel open even if grid is off
    }
  }

  /* ── Draggable panel ───────────────────────────────────── */
  (function makeDraggable() {
    var header = panel.querySelector(".prism-fb-header");
    var dragging = false, startX, startY, origX, origY;

    header.style.cursor = "grab";
    header.addEventListener("mousedown", function (e) {
      if (e.target.tagName === "BUTTON") return;
      dragging = true;
      header.style.cursor = "grabbing";
      startX = e.clientX;
      startY = e.clientY;
      var rect = panel.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      panel.style.left = (origX + dx) + "px";
      panel.style.top  = (origY + dy) + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });
    document.addEventListener("mouseup", function () {
      if (dragging) { dragging = false; header.style.cursor = "grab"; }
    });
  })();

  /* ── Floating buttons ──────────────────────────────────── */
  var gridBtn = document.createElement("button");
  gridBtn.className = "prism-grid-btn";
  gridBtn.innerHTML = "&#x25a6;";
  gridBtn.title = "Show grid (Ctrl+G)";
  gridBtn.setAttribute("aria-label", "Toggle grid overlay");
  gridBtn.addEventListener("click", toggleGrid);

  var fbBtn = document.createElement("button");
  fbBtn.className = "prism-grid-btn prism-fb-toggle-btn";
  fbBtn.innerHTML = "&#x270e;";
  fbBtn.title = "Open feedback panel (Ctrl+F)";
  fbBtn.setAttribute("aria-label", "Toggle feedback panel");
  fbBtn.style.display = "none";   // hidden until grid is on
  fbBtn.addEventListener("click", togglePanel);

  /* ── Keyboard shortcuts ────────────────────────────────── */
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
    if (e.ctrlKey && e.key.toLowerCase() === "g") {
      e.preventDefault();
      toggleGrid();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      if (gridActive) togglePanel();
    }
  });

  /* ── Console API ───────────────────────────────────────── */
  window.prism = {
    legend: function () { console.table(legend); return legend; },
    log:    function () { return feedLog; },
    text:   function () { var t = exportText(); console.log(t); return t; },
    find:   function (code) {
      code = (code || "").toUpperCase();
      var el = codeToEl[code];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.outline = "3px solid red";
        setTimeout(function () { el.style.outline = ""; el.classList.add("prism-grid-outline"); }, 2000);
      }
      return el;
    }
  };

  /* ── Inject into DOM ───────────────────────────────────── */
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
