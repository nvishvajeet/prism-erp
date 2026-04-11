/* W1.4.1 c3 — bare-key shortcuts.
   `n` → /requests/new, `?` → toggle help overlay.
   No-op while any form input / textarea / contenteditable is focused.
   Philosophy rule: ≤40 lines, vanilla JS, zero framework creep. */
(function () {
  var overlay = document.getElementById('keybindHelp');
  function typing(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    return !!el.isContentEditable;
  }
  function hideOverlay() { if (overlay) overlay.hidden = true; }
  if (overlay) {
    var closeBtn = overlay.querySelector('[data-keybind-close]');
    if (closeBtn) closeBtn.addEventListener('click', hideOverlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) hideOverlay();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (typing(e.target)) return;
    if (e.key === 'n' || e.key === 'N') {
      window.location.href = '/requests/new';
      e.preventDefault();
    } else if (e.key === '?') {
      if (overlay) { overlay.hidden = !overlay.hidden; e.preventDefault(); }
    } else if (e.key === 'Escape' && overlay && !overlay.hidden) {
      hideOverlay();
      e.preventDefault();
    }
  });
})();
