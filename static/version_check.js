// version_check.js
// --------------------------------------------------------------------
// Polls /api/version every 60 seconds. When the deployed git sha or
// boot time changes from what this tab saw on load, show a toast:
// "New version available — click to refresh."
//
// This closes the gap where a fix ships to the server but an already-
// open browser tab keeps running stale JS/HTML until the user
// navigates. The toast lets the user pick up the new code without
// losing session (session cookie survives reload).
//
// Operator directive 2026-04-17 Paris: "if a simple fix is to restart
// the server then we can ship new things to the users as soon as we
// fix them." Plus: stations sometimes forget to cherry-pick, so the
// toast is the last safety net — user sees the fix shipped + a way to
// load it without operator intervention.
//
// Zero deps. ~80 lines. Safe to load on every page.

(function () {
  'use strict';

  var BOOT_SHA = null;
  var BOOT_TIME = null;
  var POLL_INTERVAL_MS = 60 * 1000; // 60 s
  var STALE_TAB_WARN_HOURS = 24;
  var TAB_OPEN_AT = Date.now();
  var toastShown = false;

  function fetchVersion() {
    return fetch('/api/version', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function showToast(kind, message) {
    if (toastShown) return;
    toastShown = true;
    var toast = document.createElement('div');
    toast.className = 'version-toast version-toast-' + kind;
    toast.setAttribute('role', 'status');
    toast.innerHTML =
      '<span class="version-toast-icon">🔄</span>' +
      '<span class="version-toast-message">' + message + '</span>' +
      '<button class="version-toast-reload" type="button">Reload</button>' +
      '<button class="version-toast-dismiss" type="button" aria-label="Dismiss">×</button>';
    toast.style.cssText = [
      'position:fixed',
      'top:16px',
      'right:16px',
      'z-index:9999',
      'display:flex',
      'gap:.5rem',
      'align-items:center',
      'padding:.7rem 1rem',
      'background:linear-gradient(135deg,#1e40af,#3b82f6)',
      'color:#fff',
      'border-radius:.6rem',
      'box-shadow:0 8px 24px rgba(0,0,0,.18)',
      'font:.9rem ui-sans-serif,system-ui,sans-serif',
      'max-width:380px'
    ].join(';');

    toast.querySelector('.version-toast-reload').style.cssText =
      'background:#fff;color:#1e40af;border:none;padding:.3rem .75rem;border-radius:.35rem;font-weight:600;cursor:pointer';
    toast.querySelector('.version-toast-dismiss').style.cssText =
      'background:transparent;color:#fff;border:none;font-size:1.2rem;cursor:pointer;opacity:.7';

    toast.querySelector('.version-toast-reload').addEventListener('click', function () {
      window.location.reload();
    });
    toast.querySelector('.version-toast-dismiss').addEventListener('click', function () {
      toast.remove();
      toastShown = false;
    });
    document.body.appendChild(toast);
  }

  function check() {
    fetchVersion().then(function (v) {
      if (!v) return;
      if (BOOT_SHA === null) {
        BOOT_SHA = v.sha;
        BOOT_TIME = v.deployed_at;
        return;
      }
      var changed = v.sha !== BOOT_SHA || v.deployed_at !== BOOT_TIME;
      var stale = (Date.now() - TAB_OPEN_AT) > STALE_TAB_WARN_HOURS * 3600 * 1000;
      if (changed) {
        showToast('update',
          'New version available (' + v.sha.substr(0, 7) + ') — reload to pick up the latest fixes.');
      } else if (stale) {
        showToast('stale',
          'This tab has been open for over ' + STALE_TAB_WARN_HOURS + ' h — reload to stay in sync.');
      }
    });
  }

  // First check: prime BOOT_SHA/BOOT_TIME from server (not the page's
  // inline template) so an already-stale tab gets the toast immediately.
  function init() {
    check();
    setInterval(check, POLL_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
