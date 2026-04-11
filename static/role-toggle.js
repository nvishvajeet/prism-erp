/* W1.4.12 — inline XHR role-change toggle. Third consumer of the
   inline-toggle pattern after intake-toggle.js (W1.4.3) and
   approval-toggle.js (W1.4.6). Replaces the legacy <form> on
   user_detail.html's "Change Role" tile with a button strip.
   Role changes are treated as dangerous (demotion can lock a
   user out of their in-flight approvals), so commit requires
   2-tap arming with a 3-second disarm timer, identical to the
   reject path on the approvals tile. On XHR failure, a real
   form POST is synthesised so the user is never stranded. */
(function () {
  var groups = Array.from(document.querySelectorAll('.role-toggle-group'));
  if (!groups.length) return;

  function bind(group) {
    var postUrl = group.dataset.rolePost;
    var status = group.querySelector('.role-toggle-status');
    var buttons = Array.from(group.querySelectorAll('.role-toggle-btn'));
    var armed = null;
    var armedTimer = null;
    var busy = false;

    function message(text, tone) {
      if (!status) return;
      status.textContent = text || '';
      status.dataset.tone = tone || '';
    }

    function disarm() {
      if (armedTimer) { clearTimeout(armedTimer); armedTimer = null; }
      if (armed) { armed.classList.remove('is-arming'); armed = null; }
    }

    function lockBlock() {
      group.classList.add('is-committed');
      buttons.forEach(function (b) { b.disabled = true; });
    }

    function fallbackFormPost(newRole) {
      var form = document.createElement('form');
      form.method = 'POST';
      form.action = postUrl;
      form.style.display = 'none';
      function hidden(name, val) {
        var i = document.createElement('input');
        i.type = 'hidden'; i.name = name; i.value = val;
        form.appendChild(i);
      }
      hidden('action', 'change_role');
      hidden('new_role', newRole);
      document.body.appendChild(form);
      form.submit();
    }

    function commit(btn) {
      if (busy) return;
      var newRole = btn.dataset.roleNew;
      busy = true;
      message('Saving…', '');
      var body = new FormData();
      body.append('action', 'change_role');
      body.append('new_role', newRole);
      fetch(postUrl, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
        body: body,
        credentials: 'same-origin',
      }).then(function (r) {
        if (r.ok) return r.json();
        return r.json().then(function (data) { return Promise.reject(data); },
                             function () { return Promise.reject({error: 'http_' + r.status}); });
      }).then(function (data) {
        lockBlock();
        var label = (data && data.new_role_label) || newRole;
        message('✓ Role set to ' + label + ' — refreshing page…', 'ok');
        setTimeout(function () {
          window.location.href = (data && data.reload_url) || window.location.href;
        }, 450);
      }).catch(function (err) {
        busy = false;
        var code = (err && err.error) || 'unknown';
        if (code === 'invalid_role') {
          message('Invalid role selection.', 'err');
        } else if (code === 'forbidden' || code === 'http_403') {
          message('Not allowed for your role. Falling back to form post…', 'err');
          setTimeout(function () { fallbackFormPost(newRole); }, 600);
        } else {
          message('Save failed (' + code + '). Falling back to form post…', 'err');
          setTimeout(function () { fallbackFormPost(newRole); }, 600);
        }
      });
    }

    function onClick(btn) {
      if (busy || btn.disabled) return;
      if (btn.classList.contains('is-active')) {
        message('Already in this role.', 'warn');
        return;
      }
      if (armed === btn) { disarm(); commit(btn); return; }
      disarm();
      armed = btn;
      btn.classList.add('is-arming');
      message('Tap "' + (btn.textContent || '').trim() + '" again to confirm (3s)…', 'warn');
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
  }

  groups.forEach(bind);
})();
