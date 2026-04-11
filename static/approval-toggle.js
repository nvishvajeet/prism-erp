/* W1.4.6 — request approval inline toggle.
   Replaces the legacy twin <form> block on request_detail.html's
   Approvals tile. Approve commits on first click; Reject uses 2-tap
   arming identical to the W1.4.3 c1 intake toggle. Remarks textarea
   is required for reject (enforced both client- and server-side).
   On success, the block locks itself, shows a status pill, and
   soft-reloads the page so every downstream tile (status badge,
   approval chain, event stream) refreshes against authoritative
   server state. On XHR failure, a plain form POST is performed as
   a graceful fallback so the user is never stuck.
*/
(function () {
  var groups = Array.from(document.querySelectorAll('.approval-toggle-group'));
  if (!groups.length) return;

  function bind(group) {
    var stepId = group.dataset.approvalStepId;
    var postUrl = group.dataset.approvalPost;
    var role = group.dataset.approvalRole || '';
    var status = group.querySelector('.approval-action-status');
    var note = group.querySelector('.approval-action-note');
    var fileInput = group.querySelector('input[type="file"]');
    var approveBtn = group.querySelector('[data-approval-action="approve"]');
    var rejectBtn = group.querySelector('[data-approval-action="reject"]');
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
      if (approveBtn) approveBtn.disabled = true;
      if (rejectBtn) rejectBtn.disabled = true;
      if (note) note.disabled = true;
      if (fileInput) fileInput.disabled = true;
    }

    function fallbackFormPost(actionValue) {
      // Graceful degrade: build a real form, submit it. The server
      // already accepts the same field names for the non-XHR path.
      var form = document.createElement('form');
      form.method = 'POST';
      form.action = postUrl;
      form.enctype = 'multipart/form-data';
      form.style.display = 'none';
      function hidden(name, val) {
        var i = document.createElement('input');
        i.type = 'hidden'; i.name = name; i.value = val;
        form.appendChild(i);
      }
      hidden('action', actionValue);
      hidden('step_id', stepId);
      if (note) hidden('remarks', note.value || '');
      // Note: file upload cannot be synthesised outside the XHR path,
      // so on fallback the user re-uploads on the reloaded page. This
      // only affects the finance step and only after JS itself fails.
      document.body.appendChild(form);
      form.submit();
    }

    function commit(btn) {
      if (busy) return;
      var actionValue = btn.dataset.approvalAction === 'approve' ? 'approve_step' : 'reject_step';
      busy = true;
      message('Saving…', '');
      var body = new FormData();
      body.append('action', actionValue);
      body.append('step_id', stepId);
      if (note) body.append('remarks', note.value || '');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        body.append('approval_attachment', fileInput.files[0]);
      }
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
        var verb = actionValue === 'approve_step' ? 'Approved' : 'Rejected';
        message('✓ ' + verb + ' — refreshing page…', 'ok');
        setTimeout(function () {
          window.location.href = data.reload_url || window.location.href;
        }, 450);
      }).catch(function (err) {
        busy = false;
        var code = (err && err.error) || 'unknown';
        if (code === 'remarks_required') {
          message('A rejection reason is required.', 'warn');
          if (note) note.focus();
        } else if (code === 'forbidden') {
          message('Not allowed for your role. Falling back to form post…', 'err');
          setTimeout(function () { fallbackFormPost(actionValue); }, 600);
        } else {
          message('Save failed (' + code + '). Falling back to form post…', 'err');
          setTimeout(function () { fallbackFormPost(actionValue); }, 600);
        }
      });
    }

    function onClick(btn) {
      if (busy || btn.disabled) return;
      var safe = btn.dataset.approvalSafe === '1';
      if (safe) { disarm(); commit(btn); return; }
      // Reject path: require non-empty remarks before arming.
      if (note && !note.value.trim()) {
        disarm();
        message('Add a rejection reason first.', 'warn');
        note.focus();
        return;
      }
      if (armed === btn) { disarm(); commit(btn); return; }
      disarm();
      armed = btn;
      btn.classList.add('is-arming');
      message('Tap Reject again to confirm (3s)…', 'warn');
      armedTimer = setTimeout(function () {
        disarm();
        message('', '');
      }, 3000);
    }

    if (approveBtn) approveBtn.addEventListener('click', function () { onClick(approveBtn); });
    if (rejectBtn) rejectBtn.addEventListener('click', function () { onClick(rejectBtn); });

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
