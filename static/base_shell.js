/* base_shell.js — extracted from base.html on 2026-04-15 to keep the
   template under the 400-line architecture budget.

   Groups together five small IIFE modules that used to sit inline in
   base.html: CatalystPrefs preference storage, theme toggle + toast,
   nav/notification dropdowns, clickable-row delegation, and the
   generic data-toggle-target pattern. None of them reference Jinja,
   so they are safely static. The head-inline blocks (theme bootstrap
   before paint + CSRF fetch wrap) and the Alt-key shortcut block
   that uses url_for() remain inline in base.html. */

    /* ── Local preference storage only — no cookie banner, no tracking ── */
    window.CatalystPrefs = (function () {
      var keyPrefix = "catalyst_pref_";
      var knownKeys = ["theme", "pane_heights", "dash_collapsed", "queue_view", "queue_sort"];
      var legacyMap = {
        "theme": "labTheme",
        "pane_heights": "labPaneHeights",
        "dash_collapsed": "labDashCollapsed",
        "queue_view": "labQueueView"
        // queue_sort is new in 2026-04 — no legacy key to migrate.
      };

      function readValue(name) {
        try { return localStorage.getItem(name); } catch (e) { return null; }
      }

      function writeValue(name, value) {
        try { localStorage.setItem(name, value); } catch (e) {}
      }

      function clearValue(name) {
        try { localStorage.removeItem(name); } catch (e) {}
      }

      function consentState() {
        return "accepted";
      }

      function canPersist() {
        return true;
      }

      function get(key) {
        return readValue(keyPrefix + key);
      }

      function set(key, value) {
        writeValue(keyPrefix + key, value);
        try {
          if (legacyMap[key]) localStorage.removeItem(legacyMap[key]);
        } catch (e) {}
        return true;
      }

      function getJSON(key, fallback) {
        var raw = get(key);
        if (!raw) return fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback; }
      }

      function setJSON(key, value) {
        return set(key, JSON.stringify(value));
      }

      function migrateLegacy() {
        Object.keys(legacyMap).forEach(function (key) {
          try {
            var legacy = localStorage.getItem(legacyMap[key]);
            if (legacy && !readValue(keyPrefix + key)) {
              writeValue(keyPrefix + key, legacy);
            }
            if (legacy) localStorage.removeItem(legacyMap[key]);
          } catch (e) {}
        });
      }

      function clearPrefs() {
        knownKeys.forEach(function (key) { clearValue(keyPrefix + key); });
      }

      function accept() {
        migrateLegacy();
      }

      function decline() {
        clearPrefs();
      }

      return {
        consentState: consentState,
        canPersist: canPersist,
        get: get,
        set: set,
        getJSON: getJSON,
        setJSON: setJSON,
        accept: accept,
        decline: decline,
        migrateLegacy: migrateLegacy
      };
    })();

    /* ── Shared paginated-pane engine ── */
    window.PaginatedPane = (function () {
      var registry = {};
      var storageKey = 'pane_heights';

      function savedHeights() {
        return window.CatalystPrefs.getJSON(storageKey, {});
      }
      function saveHeight(id, px) {
        var h = savedHeights();
        h[id] = px;
        window.CatalystPrefs.setJSON(storageKey, h);
      }

      function init(paneId) {
        var pane = document.querySelector('[data-pane-id="' + paneId + '"]');
        if (!pane) return;
        var pageSize = parseInt(pane.dataset.pageSize, 10) || 10;
        var scrollEl = document.getElementById(paneId + 'Scroll');
        var tbody = document.getElementById(paneId + 'Body');
        if (!tbody && !scrollEl) return;
        var controls = document.getElementById(paneId + 'Controls');
        var prevBtn  = document.getElementById(paneId + 'Prev');
        var nextBtn  = document.getElementById(paneId + 'Next');
        var label    = document.getElementById(paneId + 'Label');
        var handle   = pane.querySelector('[data-resize-for="' + paneId + '"]');
        var currentPage = 0;

        // Restore saved height
        var saved = savedHeights()[paneId];
        if (saved && scrollEl) scrollEl.style.maxHeight = saved + 'px';

        // Resize handle drag
        if (handle && scrollEl) {
          handle.addEventListener('mousedown', function (e) {
            e.preventDefault();
            handle.classList.add('dragging');
            var startY = e.clientY;
            var startH = scrollEl.getBoundingClientRect().height;
            function onMove(ev) {
              var newH = Math.max(80, startH + (ev.clientY - startY));
              scrollEl.style.maxHeight = newH + 'px';
            }
            function onUp() {
              handle.classList.remove('dragging');
              saveHeight(paneId, parseInt(scrollEl.style.maxHeight, 10));
              document.removeEventListener('mousemove', onMove);
              document.removeEventListener('mouseup', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          });
        }

        function visibleRows() {
          // Support both table rows and generic pane items
          var container = tbody || scrollEl;
          var sel = 'tr[data-bucket],tr[data-search],tr[data-status],[data-pane-item]';
          return Array.from(container.querySelectorAll(sel))
            .filter(function (r) { return !r.hidden; });
        }

        function render() {
          var rows = visibleRows();
          var totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
          if (currentPage >= totalPages) currentPage = totalPages - 1;

          // First: un-page all visible rows
          rows.forEach(function (r) { r.classList.remove('pane-page-hidden'); });
          // Then hide those outside current page
          rows.forEach(function (row, i) {
            if (i < currentPage * pageSize || i >= (currentPage + 1) * pageSize) {
              row.classList.add('pane-page-hidden');
            }
          });

          if (controls) controls.style.display = totalPages > 1 ? '' : 'none';
          if (label) label.textContent = rows.length ? (currentPage + 1) + ' / ' + totalPages : '';
          if (prevBtn) prevBtn.disabled = currentPage === 0;
          if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;
        }

        if (prevBtn) prevBtn.addEventListener('click', function () { if (currentPage > 0) { currentPage--; render(); } });
        if (nextBtn) nextBtn.addEventListener('click', function () { currentPage++; render(); });

        registry[paneId] = { refresh: function () { currentPage = 0; render(); }, renderCurrent: render };
        render();
      }

      function initAll() {
        document.querySelectorAll('[data-pane-id]').forEach(function (el) { init(el.dataset.paneId); });
      }

      return { init: init, initAll: initAll, refresh: function (id) { if (registry[id]) registry[id].refresh(); }, get: function(id) { return registry[id]; } };
    })();

    document.addEventListener('DOMContentLoaded', function () {
      window.PaginatedPane.initAll();

      /* ── Role-visibility filter ──
         Owner is a super-super-user: bypass the filter entirely so even
         elements tagged only for a specific role (e.g. data-vis="requester")
         still render for owner. Fixes blank-page bug where role="owner" +
         role-specific data-vis tags hid every structural element. */
      var role = (document.body.getAttribute('data-user-role') || '').trim();
      if (role && role !== 'owner') {
        document.querySelectorAll('[data-vis]').forEach(function (el) {
          var allowed = el.getAttribute('data-vis').split(/\s+/);
          if (allowed.indexOf('all') === -1 && allowed.indexOf(role) === -1) {
            el.style.display = 'none';
          }
        });
      }
    });
    (function () {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const toggle = document.getElementById("themeToggle");
      const prefs = window.CatalystPrefs;
      const initialConsent = prefs ? prefs.consentState() : null;

      if (prefs && initialConsent === "accepted") {
        prefs.migrateLegacy();
      }

      function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        if (toggle) {
          const isDark = theme === "dark";
          toggle.setAttribute("aria-pressed", String(isDark));
          toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
          toggle.setAttribute("title", isDark ? "Switch to light mode" : "Switch to dark mode");
        }
      }

      function currentTheme() {
        return (prefs && prefs.get("theme")) || localStorage.getItem("labTheme") || (media.matches ? "dark" : "light");
      }

      applyTheme(currentTheme());

      if (toggle) {
        toggle.addEventListener("click", function () {
          // Invert the theme currently painted on <html>, not currentTheme()
          // — the data-theme attribute is the source of truth for what the
          // user is actually looking at, so the toggle flip is always
          // visually correct even if prefs storage is flaky.
          const painted = document.documentElement.getAttribute("data-theme") || currentTheme();
          const next = painted === "dark" ? "light" : "dark";
          if (prefs) prefs.set("theme", next);
          try { localStorage.setItem("catalyst_pref_theme", next); } catch (e) {}
          applyTheme(next);
        });
      }

      media.addEventListener("change", function () {
        var storedTheme = (prefs && prefs.get("theme")) || localStorage.getItem("labTheme");
        if (!storedTheme) {
          applyTheme(media.matches ? "dark" : "light");
        }
      });
    })();

    /* ── Toast auto-dismiss + close button ── */
    (function () {
      var stack = document.getElementById('toastStack');
      if (!stack) return;
      var toasts = stack.querySelectorAll('.toast');
      toasts.forEach(function (toast, idx) {
        var btn = toast.querySelector('.toast-close');
        function dismiss() {
          toast.classList.add('toast-leave');
          setTimeout(function () { toast.remove(); }, 220);
        }
        if (btn) btn.addEventListener('click', dismiss);
        // Errors stay until dismissed; everything else auto-fades.
        if (!toast.classList.contains('toast-error')) {
          setTimeout(dismiss, 5000 + idx * 400);
        }
      });
    })();
    /* ── Instrument dropdown mobile support + ARIA ── */
    (function () {
      var dropdowns = document.querySelectorAll('.nav-dropdown');
      function setExpanded(dropdown, value) {
        var trigger = dropdown.querySelector('.nav-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', value ? 'true' : 'false');
      }
      dropdowns.forEach(function (dropdown) {
        var trigger = dropdown.querySelector('.nav-trigger');
        if (!trigger) return;

        trigger.addEventListener('click', function (e) {
          var isTouch = e.pointerType === 'touch' || e.pointerType === '';
          if (!isTouch) return; // Let hover handle desktop
          e.preventDefault();
          var nowOpen = !dropdown.classList.contains('nav-dropdown-open');
          dropdown.classList.toggle('nav-dropdown-open', nowOpen);
          setExpanded(dropdown, nowOpen);
        });
        // Hover open/close on desktop — keep ARIA in sync
        dropdown.addEventListener('mouseenter', function () { setExpanded(dropdown, true); });
        dropdown.addEventListener('mouseleave', function () { setExpanded(dropdown, false); });
        // Esc closes
        dropdown.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            dropdown.classList.remove('nav-dropdown-open');
            setExpanded(dropdown, false);
            trigger.focus();
          }
        });
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.nav-dropdown')) {
          dropdowns.forEach(function (d) {
            d.classList.remove('nav-dropdown-open');
            setExpanded(d, false);
          });
        }
      });
    })();

    /* ── Notification dropdown — click-to-toggle ── */
    (function () {
      var trigger = document.querySelector('[data-notif-trigger]');
      if (!trigger) return;
      var dropdown = trigger.closest('.notif-dropdown');
      if (!dropdown) return;

      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        var nowOpen = !dropdown.classList.contains('notif-dropdown-open');
        dropdown.classList.toggle('notif-dropdown-open', nowOpen);
        trigger.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
      });

      document.addEventListener('click', function (e) {
        if (!e.target.closest('.notif-dropdown')) {
          dropdown.classList.remove('notif-dropdown-open');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });

      dropdown.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          dropdown.classList.remove('notif-dropdown-open');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
        }
      });
    })();
    /* ── Global clickable-row handler ──
       Any <tr class="clickable-row" data-href="..."> navigates on click.
       Event-delegated so it covers every page without per-template JS.
       Skips clicks on <a>, <button>, <input>, <select>, <textarea>, or
       elements with class="no-row-nav" so inline controls still work. */
    (function () {
      document.addEventListener('click', function (e) {
        var row = e.target && e.target.closest && e.target.closest('tr.clickable-row[data-href]');
        if (!row) return;
        // Let inline interactive elements handle their own clicks.
        if (e.target.closest('a, button, input, select, textarea, label, .no-row-nav')) return;
        var href = row.getAttribute('data-href');
        if (!href) return;
        if (e.metaKey || e.ctrlKey || e.button === 1) {
          window.open(href, '_blank');
        } else {
          window.location.href = href;
        }
      });
    })();
    /* ── Generic click-to-reveal toggle ──
       Wire any element carrying `data-toggle-target="#id"` so that clicking it
       shows/hides the referenced element and keeps aria-expanded in sync. The
       button text swaps between its initial label and the value of
       `data-toggle-alt` (defaults to "Hide"). Used by every admin "Edit"
       button that reveals an in-place metadata form — one handler, all
       tiles, no bespoke IIFE per page. */
    (function () {
      var toggles = document.querySelectorAll('[data-toggle-target]');
      toggles.forEach(function (btn) {
        var sel = btn.getAttribute('data-toggle-target');
        var target = sel ? document.querySelector(sel) : null;
        if (!target) return;
        var labelOpen = btn.textContent.trim();
        var labelClose = btn.getAttribute('data-toggle-alt') || 'Hide';
        btn.setAttribute('aria-expanded', target.hidden ? 'false' : 'true');
        btn.addEventListener('click', function () {
          var nowOpen = target.hidden;
          target.hidden = !nowOpen;
          btn.setAttribute('aria-expanded', String(nowOpen));
          btn.textContent = nowOpen ? labelClose : labelOpen;
        });
      });
    })();
