/* user_detail_grants.js — category + group quick-grant buttons for
   the instrument assignment matrix on user_detail.html. Extracted
   from inline <script> on 2026-04-15 to keep the template under
   the 400-line architecture budget. Pure vanilla JS, no Jinja. */

  (function () {
    var buttons = document.querySelectorAll('.category-grant');
    if (!buttons.length) return;
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var category = btn.getAttribute('data-assignment-category');
        var lane = btn.getAttribute('data-assignment-lane');
        var rows = document.querySelectorAll('tr.assignment-row[data-assignment-category="' + category + '"]');
        rows.forEach(function (row) {
          if (lane === 'clear') {
            row.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.checked = false; });
          } else {
            var box = row.querySelector('input[name="' + lane + '"]');
            if (box) box.checked = true;
          }
        });
      });
    });
  })();

  /* W1.3.6 — group quick-grant buttons. Each button carries a JSON
     list of instrument ids; clicking it checks the given lane for
     every matching row. */
  (function () {
    var groupBtns = document.querySelectorAll('.group-grant');
    if (!groupBtns.length) return;
    groupBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var lane = btn.getAttribute('data-group-lane');
        var ids = [];
        try {
          ids = JSON.parse(btn.getAttribute('data-group-ids') || '[]');
        } catch (err) { return; }
        ids.forEach(function (id) {
          var box = document.querySelector(
            'input[name="' + lane + '"][value="' + id + '"]'
          );
          if (box) box.checked = true;
        });
      });
    });
  })();
