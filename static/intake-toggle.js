/* W1.4.3 c1 — instrument intake-mode inline toggle.
   Replaces the legacy radio form on instrument_detail.html with a
   segmented switch that posts via XHR and updates in-place.
   Safety: moving AWAY from "accepting" requires a second tap within
   ~3 seconds. Moving TO "accepting" commits on the first tap because
   re-opening the queue is never dangerous. */
(function () {
  var group = document.getElementById('instrumentIntakeToggle');
  if (!group) return;

  var status = document.getElementById('intakeToggleStatus');
  var headerBadge = document.querySelector('.inst-header-status');
  var buttons = Array.from(group.querySelectorAll('[data-intake-mode]'));
  var postUrl = group.dataset.intakePost;
  var armed = null;        // button currently armed for confirm
  var armedTimer = null;

  function message(text, tone) {
    if (!status) return;
    status.textContent = text || '';
    status.dataset.tone = tone || '';
  }

  function disarm() {
    if (armedTimer) { clearTimeout(armedTimer); armedTimer = null; }
    if (armed) { armed.classList.remove('is-arming'); armed = null; }
  }

  function setActive(mode) {
    buttons.forEach(function (b) {
      var on = b.dataset.intakeMode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    group.dataset.intakeCurrent = mode;
    if (headerBadge) {
      headerBadge.classList.remove('operation-accepting', 'operation-on_hold', 'operation-maintenance');
      headerBadge.classList.add('operation-' + mode);
      var label = headerBadge.querySelector('strong');
      if (label) {
        label.textContent = mode === 'accepting' ? 'Accepting'
                          : mode === 'on_hold' ? 'On Hold'
                          : 'Maintenance';
      }
    }
  }

  var busy = false;

  function commit(btn) {
    if (busy) return;
    busy = true;
    var mode = btn.dataset.intakeMode;
    message('Saving…');
    var body = new URLSearchParams({ action: 'update_operation', intake_mode: mode });
    fetch(postUrl, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
      body: body,
      credentials: 'same-origin',
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        setActive(data.intake_mode);
        var extra = data.released_count ? ' · released ' + data.released_count + ' queued' : '';
        // Soft-reload so the Recent Activity tile (instrument_event_log)
        // immediately reflects the new entry with the clicker's name,
        // and any header badge / queue side-effect lands authoritative.
        message('Now ' + data.label + extra + ' — refreshing…', 'ok');
        setTimeout(function () { window.location.reload(); }, 450);
      })
      .catch(function (err) {
        busy = false;
        message('Change failed (' + err + '). Reload and retry.', 'err');
      });
  }

  function onClick(btn) {
    if (btn.classList.contains('is-active')) { disarm(); return; }
    var safe = btn.dataset.intakeSafe === '1';
    if (safe) { disarm(); commit(btn); return; }
    if (armed === btn) { disarm(); commit(btn); return; }
    disarm();
    armed = btn;
    btn.classList.add('is-arming');
    message('Tap ' + (btn.querySelector('.control-mode-label') || {}).textContent + ' again to confirm (3s)…', 'warn');
    armedTimer = setTimeout(function () {
      disarm();
      message('', '');
    }, 3000);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () { onClick(btn); });
  });

  document.addEventListener('click', function (e) {
    if (!armed) return;
    if (!group.contains(e.target)) disarm();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && armed) { disarm(); message('', ''); }
  });
})();
