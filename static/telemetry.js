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
      activeMs += now - tickStart;
    }
    tickStart = now;
    ticking = true;
    window.setTimeout(tick, 1000);
  }
  if (!document.hidden) { tick(); }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
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

  // Click capture — only events on elements with data-action
  document.addEventListener('click', function (ev) {
    var el = ev.target;
    var steps = 0;
    while (el && steps < 6) {
      if (el.dataset && el.dataset.action) {
        var action = String(el.dataset.action).slice(0, 64);
        clickQueue.push({
          path: path,
          action: action,
          clicked_at: new Date().toISOString()
        });
        if (clickQueue.length >= MAX_BATCH) send();
        return;
      }
      el = el.parentElement;
      steps += 1;
    }
  }, { capture: true, passive: true });

  // Periodic flush so long-running pages don't lose data
  window.setInterval(function () {
    flushPageTime();
  }, FLUSH_EVERY_MS);

  // Final flush on page unload
  window.addEventListener('pagehide', flushPageTime);
  window.addEventListener('beforeunload', flushPageTime);

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
