/* CATALYST Insights — user-behavior telemetry (client side)
 *
 * Tracks per-page active time (tab visible + user interacting in last 30s)
 * and click events that carry a data-action attribute. Batches up to
 * TELEMETRY_MAX_BATCH events and flushes on visibilitychange/pagehide via
 * sendBeacon. Privacy: no raw mouse coordinates, no keystroke contents,
 * no cross-session identifiers beyond a random UUID per tab.
 *
 * Opt-out: set window.__CATALYST_TELEMETRY_OFF = true before this script
 * loads (e.g. in a role-specific template block) to disable entirely.
 */
(function () {
  'use strict';
  if (window.__CATALYST_TELEMETRY_OFF) return;

  var ENDPOINT = '/api/telemetry/batch';
  var HEARTBEAT_ENDPOINT = '/me/heartbeat';
  var MAX_BATCH = 50;
  var IDLE_MS = 30000;   // user considered idle after 30s of no input
  var FLUSH_EVERY_MS = 60000;

  // session id = random UUID for this tab
  var sessionId = (function () {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    // Fallback: simple RFC4122-ish
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  })();

  var path = window.location.pathname;
  var lastInput = Date.now();
  var activeMs = 0;
  var heartbeatActiveMs = 0;
  var started = new Date().toISOString();
  var tickStart = Date.now();
  var ticking = false;
  var pageTimeQueue = [];
  var clickQueue = [];

  function markInput() { lastInput = Date.now(); }
  ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(function (evt) {
    window.addEventListener(evt, markInput, { passive: true, capture: true });
  });

  function tick() {
    if (document.hidden) { ticking = false; return; }
    var now = Date.now();
    if (now - lastInput < IDLE_MS) {
      var delta = now - tickStart;
      activeMs += delta;
      heartbeatActiveMs += delta;
    }
    tickStart = now;
    ticking = true;
    window.setTimeout(tick, 1000);
  }
  if (!document.hidden) { tick(); }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      sendHeartbeat();
      flushPageTime();
    } else {
      tickStart = Date.now();
      lastInput = Date.now();
      started = new Date().toISOString();
      if (!ticking) tick();
    }
  });

  function flushPageTime() {
    if (activeMs <= 0) return;
    pageTimeQueue.push({
      path: path,
      active_ms: activeMs,
      started_at: started,
      ended_at: new Date().toISOString()
    });
    activeMs = 0;
    started = new Date().toISOString();
    send();
  }

  function sendHeartbeat() {
    var activeSeconds = Math.round(heartbeatActiveMs / 1000);
    heartbeatActiveMs = 0;
    if (activeSeconds <= 0) return;
    activeSeconds = Math.min(activeSeconds, 300);
    try {
      fetch(HEARTBEAT_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: path,
          active_seconds: activeSeconds
        }),
        keepalive: true
      }).catch(function () { /* swallow */ });
    } catch (e) { /* swallow */ }
  }

  // Normalize human text into a stable, short slug suitable for use as
  // an action name. "Submit Receipt" → "submit-receipt", "+ New PO" →
  // "new-po", truncated to 64 chars. Used by the fallback inference
  // below so explicit data-action tags remain authoritative but nothing
  // is missed.
  function slugify(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .replace(/[\u2190-\u21ff\u2600-\u27bf]/g, '')  // arrows + misc-symbol glyphs
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  // Infer a sensible action name from a clicked element when no
  // explicit data-action attribute is present. Returns '' if the
  // element is not action-like (random <div> clicks are ignored).
  function inferAction(el) {
    if (!el || !el.tagName) return '';
    var tag = el.tagName.toLowerCase();
    var role = el.getAttribute ? el.getAttribute('role') : '';
    var isAction = (
      tag === 'button' || tag === 'a' ||
      (tag === 'input' && (el.type === 'submit' || el.type === 'button')) ||
      role === 'button' || role === 'link' ||
      (el.classList && (el.classList.contains('btn') || el.classList.contains('tile-action')))
    );
    if (!isAction) return '';
    // Prefer aria-label, then name/value, then visible text.
    var text = el.getAttribute('aria-label')
            || el.name || el.value
            || (el.innerText || el.textContent || '').trim();
    var slug = slugify(text);
    if (!slug) return '';
    return 'auto:' + slug;
  }

  // Click capture — explicit data-action wins on the nearest ancestor
  // that has one; otherwise we infer from the nearest action-like
  // ancestor.
  document.addEventListener('click', function (ev) {
    var el = ev.target;
    var action = '';
    var firstInferred = '';
    var steps = 0;
    while (el && steps < 6) {
      if (el.dataset && el.dataset.action) {
        action = String(el.dataset.action).slice(0, 64);
        break;
      }
      if (!firstInferred) {
        var guessed = inferAction(el);
        if (guessed) firstInferred = guessed;
      }
      el = el.parentElement;
      steps += 1;
    }
    if (!action) action = firstInferred;
    if (!action) return;
    clickQueue.push({
      path: path,
      action: action,
      clicked_at: new Date().toISOString()
    });
    if (clickQueue.length >= MAX_BATCH) send();
  }, { capture: true, passive: true });

  // Periodic flush so long-running pages don't lose data
  window.setInterval(function () {
    sendHeartbeat();
    flushPageTime();
  }, FLUSH_EVERY_MS);

  // Final flush on page unload
  window.addEventListener('pagehide', function () {
    sendHeartbeat();
    flushPageTime();
  });
  window.addEventListener('beforeunload', function () {
    sendHeartbeat();
    flushPageTime();
  });

  // JS error forwarding — window.onerror + unhandledrejection → /api/telemetry/js-error.
  // Capped at 5 per session so a broken script doesn't spam the server.
  var jsErrorCount = 0;
  var JS_ERROR_MAX = 5;
  var JS_ERROR_ENDPOINT = '/api/telemetry/js-error';

  function sendJsError(message, source, lineno, colno, stack, errorType) {
    if (jsErrorCount >= JS_ERROR_MAX) return;
    jsErrorCount += 1;
    try {
      fetch(JS_ERROR_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          path: path,
          message: String(message || '').slice(0, 512),
          source: String(source || '').slice(0, 512),
          lineno: lineno || 0,
          colno: colno || 0,
          stack: String(stack || '').slice(0, 4096),
          error_type: String(errorType || '')
        }),
        keepalive: true
      }).catch(function () { /* swallow */ });
    } catch (e) { /* swallow */ }
  }

  var _origOnerror = window.onerror;
  window.onerror = function (msg, src, line, col, err) {
    sendJsError(msg, src, line, col, err && err.stack, err && err.name);
    if (typeof _origOnerror === 'function') return _origOnerror.apply(this, arguments);
  };

  window.addEventListener('unhandledrejection', function (ev) {
    var reason = ev.reason;
    var msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection');
    var stk = reason instanceof Error ? (reason.stack || '') : '';
    var etype = reason instanceof Error ? reason.name : 'UnhandledRejection';
    sendJsError(msg, '', 0, 0, stk, etype);
  });

  function send() {
    if (pageTimeQueue.length === 0 && clickQueue.length === 0) return;
    var body = JSON.stringify({
      session_id: sessionId,
      page_time: pageTimeQueue.splice(0, MAX_BATCH),
      clicks: clickQueue.splice(0, MAX_BATCH)
    });

    // Prefer sendBeacon for unload safety, fall back to fetch.
    // sendBeacon skips CSRF (no custom headers), so when the page
    // is still live we prefer fetch so the base-template shim can
    // attach the X-CSRFToken header.
    var useBeacon = document.hidden || document.visibilityState === 'hidden';
    if (useBeacon && navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
        return;
      } catch (e) { /* fall through */ }
    }
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function () { /* swallow — telemetry must never throw */ });
    } catch (e) { /* swallow */ }
  }
})();
