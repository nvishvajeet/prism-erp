/* v2.2.0 — Sortable tables. Any <table class="sortable-table"> gets
   click-to-sort on every <th>. Toggles asc/desc. Arrow indicator on
   active column. Pure JS, no dependencies, no server round-trip.

   Design model primitive: WIDGET (data table variant).
   Lives inside a TILE. Never causes the tile to resize. */
(function () {
  document.querySelectorAll('table.sortable-table').forEach(function (table) {
    var headers = table.querySelectorAll('thead th');
    var tbody = table.querySelector('tbody');
    if (!headers.length || !tbody) return;

    var currentCol = -1;
    var ascending = true;

    headers.forEach(function (th, colIndex) {
      th.style.cursor = 'pointer';
      th.style.userSelect = 'none';
      th.setAttribute('title', 'Click to sort');

      th.addEventListener('click', function () {
        if (currentCol === colIndex) {
          ascending = !ascending;
        } else {
          currentCol = colIndex;
          ascending = true;
        }

        // Remove arrows from all headers
        headers.forEach(function (h) {
          h.textContent = h.textContent.replace(/ [▲▼]$/, '');
        });
        th.textContent += ascending ? ' ▲' : ' ▼';

        // Sort rows
        var rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort(function (a, b) {
          var aCell = a.cells[colIndex];
          var bCell = b.cells[colIndex];
          if (!aCell || !bCell) return 0;

          var aText = (aCell.textContent || '').trim();
          var bText = (bCell.textContent || '').trim();

          // Try numeric comparison first
          var aNum = parseFloat(aText.replace(/[₹,%]/g, '').replace(/,/g, ''));
          var bNum = parseFloat(bText.replace(/[₹,%]/g, '').replace(/,/g, ''));
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return ascending ? aNum - bNum : bNum - aNum;
          }

          // Date comparison (YYYY-MM-DD or DD/MM/YYYY patterns)
          var aDate = Date.parse(aText);
          var bDate = Date.parse(bText);
          if (!isNaN(aDate) && !isNaN(bDate)) {
            return ascending ? aDate - bDate : bDate - aDate;
          }

          // String comparison
          var cmp = aText.localeCompare(bText, undefined, { sensitivity: 'base' });
          return ascending ? cmp : -cmp;
        });

        // Re-append sorted rows
        rows.forEach(function (row) { tbody.appendChild(row); });
      });
    });
  });
})();
